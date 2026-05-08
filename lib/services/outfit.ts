import { z } from "zod";
import { prisma } from "@/lib/adapters/prisma";
import { Prisma } from "@prisma/client";
import {
  conflictingSlots,
  isOutfitSlot,
  type OutfitSlot,
} from "@/lib/domain/outfit-slots";
import {
  openrouter,
  stylistModel,
  cached,
} from "@/lib/adapters/openrouter";
import {
  OUTFIT_SCORER_SYSTEM_PROMPT,
  REPORT_SCORE_TOOL,
} from "@/lib/ai/prompts/outfit-scorer";

// SavedOutfit business logic. Slot model:
//
//   TOP, BOTTOM, DRESS, OUTER, SHOES, BAG, ACCESSORY
//
// Slot constants live in lib/domain/outfit-slots so the client builder
// can import them without pulling prisma into the browser bundle. DRESS
// is mutually exclusive with TOP+BOTTOM — placing a DRESS clears TOP and
// BOTTOM in the same write; placing a TOP or BOTTOM clears any DRESS.
// Service enforces this canonically so a forged client request can't
// end up with a dress + pants on the same mannequin.

// Re-export so existing imports of `from "@/lib/services/outfit"` keep
// resolving while we shift towards domain imports gradually.
export {
  OUTFIT_SLOTS,
  defaultSlotForCategory,
  isOutfitSlot,
} from "@/lib/domain/outfit-slots";
export type { OutfitSlot };

// ─── Reads ──────────────────────────────────────────────────────────────

export function listMyOutfits(args: { userId: string; take?: number }) {
  return prisma.savedOutfit.findMany({
    where: { userId: args.userId },
    include: {
      pieces: {
        include: {
          piece: {
            select: {
              id: true,
              category: true,
              swatchHex: true,
              publicId: true,
              imageUrl: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: args.take ?? 50,
  });
}

export function getOutfit(args: { userId: string; outfitId: string }) {
  return prisma.savedOutfit.findFirst({
    where: { id: args.outfitId, userId: args.userId },
    include: {
      pieces: {
        include: {
          piece: true,
        },
      },
    },
  });
}

// ─── Writes ─────────────────────────────────────────────────────────────

export type OutfitPieceInput = { slot: OutfitSlot; pieceId: string };

export async function createOutfit(args: {
  userId: string;
  name?: string;
  occasion?: string;
  pieces: OutfitPieceInput[];
}) {
  // Verify every piece belongs to this user (prevents using a borrowed id
  // to exfiltrate or attach someone else's piece). One IN query.
  if (args.pieces.length > 0) {
    const owned = await prisma.closetPiece.findMany({
      where: {
        userId: args.userId,
        id: { in: args.pieces.map((p) => p.pieceId) },
      },
      select: { id: true },
    });
    if (owned.length !== args.pieces.length) {
      throw new Error("One or more pieces are not in your closet");
    }
  }

  const cleaned = applySlotConflicts(args.pieces);

  return prisma.savedOutfit.create({
    data: {
      userId: args.userId,
      name: args.name ?? null,
      occasion: validOccasion(args.occasion),
      pieces: {
        create: cleaned.map((p) => ({ pieceId: p.pieceId, slot: p.slot })),
      },
    },
    include: { pieces: { include: { piece: true } } },
  });
}

export async function updateOutfit(args: {
  userId: string;
  outfitId: string;
  name?: string | null;
  occasion?: string | null;
  pieces?: OutfitPieceInput[];
}) {
  const outfit = await prisma.savedOutfit.findFirst({
    where: { id: args.outfitId, userId: args.userId },
    select: { id: true },
  });
  if (!outfit) throw new Error("Outfit not found");

  const data: Prisma.SavedOutfitUpdateInput = {};
  if (args.name !== undefined) data.name = args.name;
  if (args.occasion !== undefined) data.occasion = validOccasion(args.occasion);

  // Editing pieces also invalidates any prior AI score — the look is now
  // structurally different, so old scores are misleading. Phase 3B will
  // surface this as a "RE-SCORE?" badge but at write-time we just nuke the
  // cached score so the UI never reads stale numbers.
  if (args.pieces) {
    const ownership = await prisma.closetPiece.findMany({
      where: {
        userId: args.userId,
        id: { in: args.pieces.map((p) => p.pieceId) },
      },
      select: { id: true },
    });
    if (ownership.length !== args.pieces.length) {
      throw new Error("One or more pieces are not in your closet");
    }
    const cleaned = applySlotConflicts(args.pieces);

    return prisma.$transaction(async (tx) => {
      await tx.savedOutfitPiece.deleteMany({ where: { outfitId: outfit.id } });
      return tx.savedOutfit.update({
        where: { id: outfit.id },
        data: {
          ...data,
          compositeScore: null,
          subScores: Prisma.DbNull,
          verdict: Prisma.DbNull,
          whatWorking: Prisma.DbNull,
          whatToTry: Prisma.DbNull,
          scoredAt: null,
          pieces: {
            create: cleaned.map((p) => ({ pieceId: p.pieceId, slot: p.slot })),
          },
        },
        include: { pieces: { include: { piece: true } } },
      });
    });
  }

  return prisma.savedOutfit.update({
    where: { id: outfit.id },
    data,
    include: { pieces: { include: { piece: true } } },
  });
}

export async function logOutfitWear(args: { userId: string; outfitId: string }) {
  const outfit = await prisma.savedOutfit.findFirst({
    where: { id: args.outfitId, userId: args.userId },
    select: { id: true },
  });
  if (!outfit) throw new Error("Outfit not found");

  return prisma.savedOutfit.update({
    where: { id: outfit.id },
    data: {
      wearCount: { increment: 1 },
      lastWornAt: new Date(),
    },
  });
}

export async function deleteOutfit(args: { userId: string; outfitId: string }) {
  const outfit = await prisma.savedOutfit.findFirst({
    where: { id: args.outfitId, userId: args.userId },
    select: { id: true },
  });
  if (!outfit) throw new Error("Outfit not found");
  await prisma.savedOutfit.delete({ where: { id: outfit.id } });
}

// ─── Helpers ────────────────────────────────────────────────────────────

// Drop conflicting slot pairs from a piece list. DRESS wins over TOP+BOTTOM
// when both are present; otherwise the order in the input wins (TOP after
// DRESS removes the DRESS, etc.). We process in input order so the user's
// most recent placement is the one that survives.
function applySlotConflicts(
  pieces: OutfitPieceInput[],
): OutfitPieceInput[] {
  const bySlot = new Map<OutfitSlot, OutfitPieceInput>();
  for (const p of pieces) {
    if (!isOutfitSlot(p.slot)) continue;
    for (const conflicting of conflictingSlots(p.slot)) {
      bySlot.delete(conflicting);
    }
    bySlot.set(p.slot, p);
  }
  return [...bySlot.values()];
}

// Narrow a free-form occasion string into the Prisma Occasion enum or null.
// Outfit occasion mirrors Product.occasion so future "find me products for
// this look's occasion" queries can join cleanly.
const VALID_OCCASIONS = [
  "CASUAL",
  "WORK",
  "FORMAL",
  "EVENING",
  "WEDDING",
  "VACATION",
  "SPORT",
] as const;
function validOccasion(
  raw: string | null | undefined,
): (typeof VALID_OCCASIONS)[number] | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return (VALID_OCCASIONS as readonly string[]).includes(upper)
    ? (upper as (typeof VALID_OCCASIONS)[number])
    : null;
}

// ─── AI scoring (Phase 3B) ──────────────────────────────────────────────
//
// Single-shot LLM call that returns a structured OutfitScore via a forced
// tool call (`report_score`) on Anthropic Sonnet 4.5 through OpenRouter.
// Persists the result to the SavedOutfit's nullable AI columns so the
// detail page can render the same score on every subsequent visit
// without burning tokens.
//
// Token cost (Sonnet 4.5 via OpenRouter, current pricing):
//   - System prompt + tool def: ~900 tokens (cached after first call)
//   - User payload (outfit pieces + closet snapshot): ~2300 tokens fresh
//   - Tool-call output: ~400 tokens
// → ~$0.015 cold / ~$0.009 warm per scoring.

export const outfitScoreSchema = z.object({
  composite: z.number().int().min(0).max(100),
  label: z.enum(["STRONG", "GOOD", "OK", "WEAK"]),
  verdict: z.object({
    headline: z.string().max(60),
    body: z.string().max(280),
  }),
  subScores: z.object({
    harmony: z.number().int().min(0).max(100),
    fit: z.number().int().min(0).max(100),
    occasion: z.number().int().min(0).max(100),
  }),
  whatWorking: z
    .array(
      z.object({
        tone: z.enum(["color", "fabric", "occasion", "fit"]),
        body: z.string().max(200),
      }),
    )
    .min(1)
    .max(6),
  whatToTry: z
    .array(
      z.union([
        z.object({
          kind: z.literal("swap"),
          pieceId: z.string().min(1),
          targetCategory: z.enum([
            "TOP",
            "BOTTOM",
            "DRESS",
            "OUTER",
            "SHOES",
            "BAG",
            "ACCESSORY",
          ]),
          suggestion: z.string().max(220),
          harmonyDelta: z.number().int().min(0).max(100),
          source: z.literal("closet"),
        }),
        z.object({
          kind: z.literal("shop"),
          targetCategory: z.enum([
            "TOP",
            "BOTTOM",
            "DRESS",
            "OUTER",
            "SHOES",
            "BAG",
            "ACCESSORY",
          ]),
          suggestion: z.string().max(220),
          deltaHint: z.string().max(120),
        }),
      ]),
    )
    .min(1)
    .max(4),
});

export type OutfitScore = z.infer<typeof outfitScoreSchema>;

export class OutfitScoreError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "EMPTY"
      | "MODEL_NO_TOOL_CALL"
      | "MODEL_BAD_JSON"
      | "MODEL_BAD_SHAPE",
    message: string,
  ) {
    super(message);
    this.name = "OutfitScoreError";
  }
}

// Score one outfit. Caller is responsible for the daily-token-budget
// pre-flight check (see /api/closet/outfit/score) — this function does
// the LLM call unconditionally and returns the parsed score + the
// total token count for budget bookkeeping.
export async function scoreOutfit(args: {
  userId: string;
  outfitId: string;
  locale: string;
}): Promise<{ score: OutfitScore; tokensUsed: number }> {
  const outfit = await prisma.savedOutfit.findFirst({
    where: { id: args.outfitId, userId: args.userId },
    include: {
      pieces: { include: { piece: true } },
    },
  });
  if (!outfit) {
    throw new OutfitScoreError("NOT_FOUND", "Outfit not found");
  }
  if (outfit.pieces.length === 0) {
    throw new OutfitScoreError("EMPTY", "Outfit has no pieces");
  }

  // Closet snapshot — pieces NOT in this outfit, capped at 30 by recency
  // so we don't blow the input-token budget on heavy closets.
  const inOutfitIds = new Set(outfit.pieces.map((p) => p.pieceId));
  const closetSnapshot = await prisma.closetPiece.findMany({
    where: {
      userId: args.userId,
      status: "IN_CLOSET",
      id: { notIn: [...inOutfitIds] },
    },
    orderBy: [{ wearCount: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  const userPayload = JSON.stringify({
    locale: args.locale,
    occasion: outfit.occasion,
    outfit: outfit.pieces.map((p) => ({
      slot: p.slot,
      piece: {
        id: p.piece.id,
        name: p.piece.name,
        category: p.piece.category,
        color: p.piece.color,
        fabric: p.piece.fabric,
        formality: p.piece.formality,
        season: p.piece.season,
      },
    })),
    closetSnapshot: closetSnapshot.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      color: p.color,
      fabric: p.fabric,
      formality: p.formality,
      season: p.season,
    })),
  });

  const completion = await openrouter().chat.completions.create({
    model: stylistModel(),
    // System prompt wrapped in cached() so the cache_control marker
    // forwards to Anthropic — second scoring of the session is ~40%
    // cheaper.
    messages: [
      {
        role: "system",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: cached(OUTFIT_SCORER_SYSTEM_PROMPT) as any,
      },
      {
        role: "user",
        content: `Score this outfit. The user is writing in locale "${args.locale}" — return verdict + whatWorking + whatToTry text in that locale.\n\n${userPayload}`,
      },
    ],
    tools: [REPORT_SCORE_TOOL],
    tool_choice: {
      type: "function",
      function: { name: "report_score" },
    },
  });

  const message = completion.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== "report_score") {
    throw new OutfitScoreError(
      "MODEL_NO_TOOL_CALL",
      "Model didn't call report_score",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new OutfitScoreError(
      "MODEL_BAD_JSON",
      "Model returned malformed tool arguments",
    );
  }

  const parsed = outfitScoreSchema.safeParse(raw);
  if (!parsed.success) {
    throw new OutfitScoreError(
      "MODEL_BAD_SHAPE",
      `Model output failed validation: ${parsed.error.message.slice(0, 200)}`,
    );
  }

  // Drop swap suggestions whose pieceId isn't in the closet snapshot.
  // The system prompt forbids inventing pieces but Claude occasionally
  // hallucinates IDs; safer to filter than to surface a broken link.
  const validPieceIds = new Set(closetSnapshot.map((p) => p.id));
  const cleanedScore: OutfitScore = {
    ...parsed.data,
    whatToTry: parsed.data.whatToTry.filter((entry) => {
      if (entry.kind === "swap") return validPieceIds.has(entry.pieceId);
      return true;
    }),
  };

  // Persist. The 6 nullable AI columns were added in Phase 3A's
  // migration so this write doesn't need a schema change.
  await prisma.savedOutfit.update({
    where: { id: outfit.id },
    data: {
      compositeScore: cleanedScore.composite,
      subScores: cleanedScore.subScores as unknown as Prisma.InputJsonValue,
      verdict: cleanedScore.verdict as unknown as Prisma.InputJsonValue,
      whatWorking: cleanedScore.whatWorking as unknown as Prisma.InputJsonValue,
      whatToTry: cleanedScore.whatToTry as unknown as Prisma.InputJsonValue,
      scoredAt: new Date(),
    },
  });

  const usage = completion.usage;
  const tokensUsed =
    (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

  return { score: cleanedScore, tokensUsed };
}
