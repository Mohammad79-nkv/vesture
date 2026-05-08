import { prisma } from "@/lib/adapters/prisma";
import { Prisma } from "@prisma/client";
import {
  conflictingSlots,
  isOutfitSlot,
  type OutfitSlot,
} from "@/lib/domain/outfit-slots";

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
