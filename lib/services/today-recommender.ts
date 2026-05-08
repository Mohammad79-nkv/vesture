import { z } from "zod";
import {
  cached,
  openrouter,
  todayModel,
  tokensUsed,
} from "@/lib/adapters/openrouter";
import { prisma } from "@/lib/adapters/prisma";
import {
  REPORT_OUTFITS_TOOL,
  TODAY_RECOMMENDER_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/today-recommender";
import {
  getCachedTodayRecommendations,
  saveTodayRecommendations,
  type TodayOutfit,
  type TodayRecommendationsPayload,
} from "@/lib/services/today-cache";
import type { CurrentWeather } from "@/lib/adapters/weather";

// Phase 3E.2 · Today recommender service.
//
// Pipeline:
//   1. Look up the cached recommendation for (userId, today, closet
//      version, tempBucket). Hit → return.
//   2. Miss → snapshot the user's closet + headline context,
//      forced-tool-call the model, parse + validate, save to cache,
//      return.
//
// We don't gate this on the daily token budget the way score / chat
// do because the daily cache means a user hits OpenRouter at most
// once per (closetVersion × tempBucket) combination per day — even
// a feverishly active user generates a small handful of calls. If
// budget pressure shows up in telemetry we add the gate then.

const piecesSelect = {
  id: true,
  name: true,
  category: true,
  color: true,
  swatchHex: true,
  fabric: true,
  formality: true,
  season: true,
  wearCount: true,
  lastWornAt: true,
  publicId: true,
  imageUrl: true,
} as const;

export type TodayPiece = {
  id: string;
  name: string | null;
  category: string;
  color: string | null;
  swatchHex: string | null;
  fabric: string | null;
  formality: string | null;
  season: string | null;
  wearCount: number;
  lastWornAt: Date | null;
  publicId: string;
  imageUrl: string;
};

export type TimeOfDay = "morning" | "afternoon" | "evening";

export class TodayRecommenderError extends Error {
  constructor(
    public code:
      | "MODEL_NO_TOOL_CALL"
      | "MODEL_BAD_JSON"
      | "MODEL_BAD_SHAPE"
      | "MODEL_FAILED"
      | "EMPTY_CLOSET",
    message: string,
  ) {
    super(message);
    this.name = "TodayRecommenderError";
  }
}

// Validation schema for the model's tool output. Mirrors the JSON
// schema in REPORT_OUTFITS_TOOL but with zod's runtime-friendly types.
const reportOutfitsSchema = z.object({
  outfits: z
    .array(
      z.object({
        name: z.string().min(1).max(24),
        mood: z.string().min(1).max(40),
        pieces: z
          .array(
            z.object({
              slot: z.enum([
                "TOP",
                "BOTTOM",
                "DRESS",
                "OUTER",
                "SHOES",
                "BAG",
                "ACCESSORY",
              ]),
              pieceId: z.string().min(1),
            }),
          )
          .min(2)
          .max(6),
        why: z.string().max(140).optional(),
        badge: z.enum(["ALL_OWN", "BUY"]).optional(),
      }),
    )
    .min(1)
    .max(3),
  headline: z.object({
    kicker: z.string().min(1).max(60),
    title: z.string().min(1).max(120),
    sub: z.string().max(200).optional(),
  }),
});

// Drop pieces from any combo that referenced an id outside the
// closet snapshot. The model should never do this thanks to the
// system prompt, but a stale cache + a piece deletion could leak
// one through; this keeps the renderer from rendering a ghost slot.
function pruneToKnownPieces(
  outfits: TodayOutfit[],
  knownIds: Set<string>,
): TodayOutfit[] {
  return outfits
    .map((o) => ({
      ...o,
      pieces: o.pieces.filter((p) => knownIds.has(p.pieceId)),
    }))
    .filter((o) => o.pieces.length >= 2);
}

// Generate fresh recommendations + persist to the cache. Caller is
// responsible for the cache lookup (so they can decide whether to
// regenerate); this fn always hits the model.
export async function generateTodayRecommendations(args: {
  userId: string;
  pieces: TodayPiece[];
  weather: CurrentWeather | null;
  timeOfDay: TimeOfDay;
  locale: string;
  closetVersion: number;
}): Promise<{ payload: TodayRecommendationsPayload; tokensUsed: number }> {
  if (args.pieces.length === 0) {
    throw new TodayRecommenderError(
      "EMPTY_CLOSET",
      "Cannot recommend outfits from an empty closet",
    );
  }

  const userPayload = JSON.stringify({
    locale: args.locale,
    timeOfDay: args.timeOfDay,
    weather: args.weather
      ? {
          tempC: Math.round(args.weather.tempC),
          condition: args.weather.condition,
          isDay: args.weather.isDay,
        }
      : null,
    closet: args.pieces.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      color: p.color,
      fabric: p.fabric,
      formality: p.formality,
      season: p.season,
      wearCount: p.wearCount,
      lastWornDaysAgo: p.lastWornAt
        ? Math.floor(
            (Date.now() - p.lastWornAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null,
    })),
  });

  let completion;
  try {
    completion = await openrouter().chat.completions.create({
      model: todayModel(),
      messages: [
        {
          role: "system",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: cached(TODAY_RECOMMENDER_SYSTEM_PROMPT) as any,
        },
        {
          role: "user",
          content: `Pick today's outfits. Respond in locale "${args.locale}".\n\n${userPayload}`,
        },
      ],
      tools: [REPORT_OUTFITS_TOOL],
      tool_choice: {
        type: "function",
        function: { name: "report_outfits" },
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OpenRouter request failed";
    throw new TodayRecommenderError("MODEL_FAILED", message);
  }

  const message = completion.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0];
  if (
    !toolCall ||
    toolCall.type !== "function" ||
    toolCall.function.name !== "report_outfits"
  ) {
    throw new TodayRecommenderError(
      "MODEL_NO_TOOL_CALL",
      "Model didn't call report_outfits",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new TodayRecommenderError(
      "MODEL_BAD_JSON",
      "Model returned malformed tool arguments",
    );
  }

  const parsed = reportOutfitsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TodayRecommenderError(
      "MODEL_BAD_SHAPE",
      `Model output failed validation: ${parsed.error.message.slice(0, 200)}`,
    );
  }

  const knownIds = new Set(args.pieces.map((p) => p.id));
  const cleanedOutfits = pruneToKnownPieces(parsed.data.outfits, knownIds);

  if (cleanedOutfits.length === 0) {
    throw new TodayRecommenderError(
      "MODEL_BAD_SHAPE",
      "Model returned outfits but none referenced known pieces",
    );
  }

  const payload: TodayRecommendationsPayload = {
    outfits: cleanedOutfits,
    headline: parsed.data.headline,
    weather: args.weather
      ? {
          tempC: Math.round(args.weather.tempC),
          condition: args.weather.condition,
          label: null,
        }
      : { tempC: 0, condition: "clear", label: null },
  };

  // Persist to the cache. tempBucket=-1 sentinel when no weather is
  // available so a future cache hit only matches the same no-weather
  // state — once the user enables location, the bucket becomes a
  // real number and this row falls out naturally.
  await saveTodayRecommendations({
    userId: args.userId,
    closetVersion: args.closetVersion,
    tempBucket: args.weather ? args.weather.tempBucket : -1,
    payload,
  });

  return {
    payload,
    tokensUsed: tokensUsed(completion.usage ?? {}),
  };
}

// Convenience: read-or-generate. Pages call this; it handles the
// cache-hit fast path and falls back to AI generation on miss.
//
// The page fetches `pieces` + `closetVersion` itself (it needs the
// piece records to render the cards either way) and passes them in
// so we don't duplicate the round-trip when there's a cache miss.
export async function getOrGenerateTodayRecommendations(args: {
  userId: string;
  pieces: TodayPiece[];
  closetVersion: number;
  weather: CurrentWeather | null;
  timeOfDay: TimeOfDay;
  locale: string;
}): Promise<{
  payload: TodayRecommendationsPayload;
  source: "cache" | "fresh";
}> {
  const tempBucket = args.weather ? args.weather.tempBucket : -1;

  const cached = await getCachedTodayRecommendations({
    userId: args.userId,
    closetVersion: args.closetVersion,
    tempBucket,
  });
  if (cached) {
    return { payload: cached, source: "cache" };
  }

  const { payload } = await generateTodayRecommendations({
    userId: args.userId,
    pieces: args.pieces,
    weather: args.weather,
    timeOfDay: args.timeOfDay,
    locale: args.locale,
    closetVersion: args.closetVersion,
  });
  return { payload, source: "fresh" };
}

// Helper to fetch the piece set + closetVersion the recommender +
// page rendering both need. Centralises the select shape.
export async function fetchTodayPieces(userId: string): Promise<{
  pieces: TodayPiece[];
  closetVersion: number;
}> {
  const [pieces, user] = await Promise.all([
    prisma.closetPiece.findMany({
      where: { userId, status: "IN_CLOSET" },
      select: piecesSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { closetVersion: true },
    }),
  ]);
  return { pieces, closetVersion: user?.closetVersion ?? 0 };
}

// Resolve time-of-day from a Date. Threshold is 16:00 local —
// matches the user's configured cutoff. Caller passes a Date in
// the user's local timezone (or accepts UTC drift).
export function timeOfDayFor(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 16) return "afternoon";
  return "evening";
}
