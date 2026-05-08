import { z } from "zod";
import {
  cached,
  openrouter,
  todayModel,
  tokensUsed,
} from "@/lib/adapters/openrouter";
import {
  REPORT_SWAP_TOOL,
  TODAY_SWAP_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/today-swap";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";
import type { TodayPiece } from "@/lib/services/today-recommender";

// Phase 3E.5 · Swap suggester service.
//
// One forced tool call per swap. Returns ranked alternatives for
// the tapped slot. The page already snapshotted the closet, so we
// don't re-query Prisma here — caller passes the relevant subset.

const SLOT_CATEGORY: Record<OutfitSlot, string> = {
  TOP: "TOPS",
  BOTTOM: "BOTTOMS",
  DRESS: "DRESSES",
  OUTER: "OUTERWEAR",
  SHOES: "SHOES",
  BAG: "BAGS",
  ACCESSORY: "ACCESSORIES",
};

export type SwapAlternative = {
  pieceId: string;
  reason: string;
  delta: string;
  isBest?: boolean;
};

export type SwapSuggestion = {
  alternatives: SwapAlternative[];
  suggestion?: string;
  tokensUsed: number;
};

const reportSwapSchema = z.object({
  alternatives: z
    .array(
      z.object({
        pieceId: z.string().min(1),
        reason: z.string().min(1).max(40),
        delta: z.string().min(1).max(24),
        isBest: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(5),
  suggestion: z.string().max(160).optional(),
});

export class TodaySwapError extends Error {
  constructor(
    public code:
      | "MODEL_NO_TOOL_CALL"
      | "MODEL_BAD_JSON"
      | "MODEL_BAD_SHAPE"
      | "MODEL_FAILED"
      | "NO_CANDIDATES",
    message: string,
  ) {
    super(message);
    this.name = "TodaySwapError";
  }
}

export async function suggestSwap(args: {
  outfit: {
    name: string;
    mood: string;
    pieces: Array<{ slot: string; pieceId: string }>;
  };
  slot: OutfitSlot;
  currentPieceId: string;
  closet: TodayPiece[];
  locale: string;
}): Promise<SwapSuggestion> {
  const targetCategory = SLOT_CATEGORY[args.slot];
  // Restrict the candidate pool to the slot's category, never the
  // current piece (the prompt warns the model but we defend here
  // too — cheap and bulletproof).
  const candidates = args.closet.filter(
    (p) => p.category === targetCategory && p.id !== args.currentPieceId,
  );

  if (candidates.length === 0) {
    throw new TodaySwapError(
      "NO_CANDIDATES",
      `No ${args.slot} candidates available for swap`,
    );
  }

  const current = args.closet.find((p) => p.id === args.currentPieceId) ?? null;

  const userPayload = JSON.stringify({
    locale: args.locale,
    outfit: args.outfit,
    slot: args.slot,
    current: current
      ? {
          id: current.id,
          name: current.name,
          color: current.color,
          fabric: current.fabric,
          formality: current.formality,
          season: current.season,
          wearCount: current.wearCount,
          lastWornDaysAgo: current.lastWornAt
            ? Math.floor(
                (Date.now() - current.lastWornAt.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
        }
      : null,
    candidates: candidates.map((p) => ({
      id: p.id,
      name: p.name,
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
          content: cached(TODAY_SWAP_SYSTEM_PROMPT) as any,
        },
        {
          role: "user",
          content: `Suggest swaps. Respond in locale "${args.locale}".\n\n${userPayload}`,
        },
      ],
      tools: [REPORT_SWAP_TOOL],
      tool_choice: {
        type: "function",
        function: { name: "report_swap" },
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OpenRouter request failed";
    throw new TodaySwapError("MODEL_FAILED", message);
  }

  const message = completion.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0];
  if (
    !toolCall ||
    toolCall.type !== "function" ||
    toolCall.function.name !== "report_swap"
  ) {
    throw new TodaySwapError(
      "MODEL_NO_TOOL_CALL",
      "Model didn't call report_swap",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new TodaySwapError(
      "MODEL_BAD_JSON",
      "Model returned malformed tool arguments",
    );
  }

  const parsed = reportSwapSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TodaySwapError(
      "MODEL_BAD_SHAPE",
      `Model output failed validation: ${parsed.error.message.slice(0, 200)}`,
    );
  }

  // Filter alternatives whose pieceId isn't actually in the
  // candidate set (defensive — the prompt is clear but a stale
  // model can drift). Then trim repeats.
  const candidateIds = new Set(candidates.map((p) => p.id));
  const seen = new Set<string>();
  const alternatives = parsed.data.alternatives
    .filter((alt) => candidateIds.has(alt.pieceId))
    .filter((alt) => {
      if (seen.has(alt.pieceId)) return false;
      seen.add(alt.pieceId);
      return true;
    });

  if (alternatives.length === 0) {
    throw new TodaySwapError(
      "MODEL_BAD_SHAPE",
      "Model returned alternatives but none referenced known candidates",
    );
  }

  return {
    alternatives,
    suggestion: parsed.data.suggestion,
    tokensUsed: tokensUsed(completion.usage ?? {}),
  };
}
