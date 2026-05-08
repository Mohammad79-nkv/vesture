import { prisma } from "@/lib/adapters/prisma";

// Today recommendation cache layer. The actual recommendation
// generator (deterministic v1, AI v2) lives elsewhere — this file is
// the I/O boundary between "what we want to show today" and the
// TodayRecommendation row that may already have it.
//
// Cache key:
//   userId       — one row per user
//   dateUtc      — yyyy-mm-dd; rolls over at 00:00 UTC every day
//   closetVersion — bumped by lib/services/closet on every mutation
//   tempBucket   — 5°C bucket from lib/adapters/weather
//
// Lookup is a single findUnique on (userId, dateUtc); the row is
// fresh only when its closetVersion + tempBucket match the request,
// otherwise it gets overwritten by the next saveTodayRecommendations
// call. We don't keep historical buckets because Today is by
// definition ephemeral.

export type TodayOutfit = {
  // Short evocative name shown on the card ("Soft", "Sharp", "Soft+1").
  name: string;
  // Mood phrase ("quiet · warm", "precise"). UI displays in a
  // monospace caption next to the name.
  mood: string;
  // Slot → pieceId map. Slot vocabulary mirrors lib/domain/outfit-slots
  // (TOP, BOTTOM, DRESS, OUTER, SHOES, BAG, ACCESSORY).
  pieces: Array<{ slot: string; pieceId: string }>;
  // Single-line "why this look" used in the floating callout. The
  // dark sheet (frame 07) expands to a full reasoning grid populated
  // separately by the outfit scorer.
  why?: string;
  // ALL_OWN / BUY badge — Today's recs are always ALL_OWN today, but
  // we keep the field so a future "+ buy this missing piece"
  // suggestion can ride the same shape.
  badge?: "ALL_OWN" | "BUY";
};

export type TodayRecommendationsPayload = {
  outfits: TodayOutfit[];
  // The headline copy varies by time of day + closet size. We cache
  // it alongside the outfits so the UI doesn't have to re-derive on
  // every render.
  headline: { kicker: string; title: string; sub?: string };
  // Pre-baked weather snapshot at generation time so the chip in the
  // header reads consistently with the recs even if the live temp
  // drifted slightly within the same bucket.
  weather: { tempC: number; condition: string; label: string | null };
};

// UTC-day bucket — call this anywhere we need a stable date key.
export function todayUtc(now: Date = new Date()): string {
  // toISOString returns YYYY-MM-DDTHH:MM:SS.sssZ — the first 10 chars
  // are the UTC date which is exactly what we want.
  return now.toISOString().slice(0, 10);
}

export async function getCachedTodayRecommendations(args: {
  userId: string;
  closetVersion: number;
  tempBucket: number;
  dateUtc?: string;
}): Promise<TodayRecommendationsPayload | null> {
  const dateUtc = args.dateUtc ?? todayUtc();
  const row = await prisma.todayRecommendation.findUnique({
    where: { userId_dateUtc: { userId: args.userId, dateUtc } },
  });
  if (!row) return null;
  if (row.closetVersion !== args.closetVersion) return null;
  if (row.tempBucket !== args.tempBucket) return null;
  // Trust the JSON shape — we own both the writer and the reader. If
  // a deploy ever changes the payload schema, bumping the dateUtc
  // (or wiping the table in the migration) is the easy invalidation
  // path; we keep this read fast.
  return row.recommendations as unknown as TodayRecommendationsPayload;
}

export async function saveTodayRecommendations(args: {
  userId: string;
  closetVersion: number;
  tempBucket: number;
  payload: TodayRecommendationsPayload;
  dateUtc?: string;
}): Promise<void> {
  const dateUtc = args.dateUtc ?? todayUtc();
  await prisma.todayRecommendation.upsert({
    where: { userId_dateUtc: { userId: args.userId, dateUtc } },
    create: {
      userId: args.userId,
      dateUtc,
      closetVersion: args.closetVersion,
      tempBucket: args.tempBucket,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recommendations: args.payload as any,
    },
    update: {
      closetVersion: args.closetVersion,
      tempBucket: args.tempBucket,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recommendations: args.payload as any,
    },
  });
}

// Force-invalidate today's row for a user. Pull-to-refresh routes here
// before kicking off a fresh generation; the next read miss then
// re-populates. We leave the row in place rather than deleting because
// Postgres can clobber it cheaper than re-create + index.
export async function invalidateTodayRecommendations(args: {
  userId: string;
  dateUtc?: string;
}): Promise<void> {
  const dateUtc = args.dateUtc ?? todayUtc();
  // Set closetVersion to a sentinel that no real version will ever
  // match (-1) so the next lookup misses without depending on string
  // comparisons.
  await prisma.todayRecommendation
    .update({
      where: { userId_dateUtc: { userId: args.userId, dateUtc } },
      data: { closetVersion: -1 },
    })
    .catch(() => {
      // No row yet — nothing to invalidate, no-op.
    });
}
