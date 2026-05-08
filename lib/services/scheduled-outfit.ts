import { prisma } from "@/lib/adapters/prisma";
import type { TimeOfDay } from "@prisma/client";

// Phase 3E.7 · ScheduledOutfit service.
//
// All operations are scoped to a single user. Pieces are stored as
// JSON snapshots ({ slot, pieceId } pairs); the renderer hydrates
// them against the closet at display time so deleted pieces fail
// gracefully (missing thumb) instead of breaking the schedule row.
//
// `scheduledFor` is anchored at noon UTC of the target day so a
// schedule for 2026-05-10 reads consistently regardless of the
// caller's timezone.

export type ScheduledOutfitPieceSnapshot = {
  slot: string;
  pieceId: string;
};

// Normalises any DateTime input to noon-UTC of its date so the
// stored value matches across timezones. Callers can pass either a
// full DateTime or an ISO date string.
export function normalizeScheduledFor(input: Date | string): Date {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

export async function createScheduledOutfit(args: {
  userId: string;
  scheduledFor: Date | string;
  timeOfDay: TimeOfDay;
  pieces: ScheduledOutfitPieceSnapshot[];
  name?: string | null;
  occasion?: string | null;
  savedOutfitId?: string | null;
}) {
  if (args.pieces.length === 0) {
    throw new Error("Cannot schedule an outfit with no pieces");
  }

  // Verify every piece belongs to the user before persisting.
  // Mirrors the exfiltration guard in createOutfit; a forged id
  // would otherwise persist a reference to someone else's piece.
  const owned = await prisma.closetPiece.findMany({
    where: {
      userId: args.userId,
      id: { in: args.pieces.map((p) => p.pieceId) },
    },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((o) => o.id));
  const validPieces = args.pieces.filter((p) => ownedIds.has(p.pieceId));
  if (validPieces.length === 0) {
    throw new Error("None of the pieces in the schedule belong to the user");
  }

  return prisma.scheduledOutfit.create({
    data: {
      userId: args.userId,
      scheduledFor: normalizeScheduledFor(args.scheduledFor),
      timeOfDay: args.timeOfDay,
      name: args.name ?? null,
      occasion: args.occasion?.trim() || null,
      savedOutfitId: args.savedOutfitId ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pieces: validPieces as any,
    },
  });
}

export async function deleteScheduledOutfit(args: {
  userId: string;
  scheduledOutfitId: string;
}) {
  // Scoped delete via where-userId so cross-user deletion is
  // structurally impossible.
  await prisma.scheduledOutfit.deleteMany({
    where: { id: args.scheduledOutfitId, userId: args.userId },
  });
}

// Read all scheduled outfits for `today` (UTC bucket). Used by
// /today to show the "On your calendar" pill.
export async function listScheduledForToday(userId: string) {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59),
  );
  return prisma.scheduledOutfit.findMany({
    where: {
      userId,
      scheduledFor: { gte: start, lte: end },
    },
    orderBy: { timeOfDay: "asc" },
  });
}

// Read upcoming + past schedules for the calendar page. Default
// returns ±14 days around today.
export async function listScheduledRange(args: {
  userId: string;
  rangeDays?: number;
}) {
  const range = args.rangeDays ?? 14;
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - range, 0),
  );
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + range,
      23,
      59,
      59,
    ),
  );
  return prisma.scheduledOutfit.findMany({
    where: {
      userId: args.userId,
      scheduledFor: { gte: start, lte: end },
    },
    orderBy: [{ scheduledFor: "asc" }, { timeOfDay: "asc" }],
  });
}
