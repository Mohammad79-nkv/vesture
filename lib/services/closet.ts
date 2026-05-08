import { prisma } from "@/lib/adapters/prisma";
import type { Category, PieceStatus } from "@prisma/client";
import type { ClosetPieceInput } from "@/lib/domain/schemas";

// All closet operations are scoped to a single user — every query carries the
// userId and Prisma's onDelete: Cascade on the User → ClosetPiece relation
// keeps things tidy when an account goes away.

// Phase 3E foundation — bumping User.closetVersion on every meaningful
// closet mutation lets the TodayRecommendation cache invalidate cheaply
// (key comparison vs. recomputing a hash of all pieces). We bump after
// the underlying mutation succeeds; a failed bump leaves the closet
// edit in place but may serve a stale recommendation for ~one cycle —
// preferable to rolling back the user's actual edit on a cache hiccup.
async function bumpClosetVersion(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { closetVersion: { increment: 1 } },
  });
}

export function listMyPieces(args: {
  userId: string;
  category?: Category;
  status?: PieceStatus;
}) {
  const status = args.status ?? "IN_CLOSET";
  return prisma.closetPiece.findMany({
    where: {
      userId: args.userId,
      status,
      ...(args.category ? { category: args.category } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function getPiece(args: { userId: string; pieceId: string }) {
  return prisma.closetPiece.findFirst({
    where: { id: args.pieceId, userId: args.userId },
  });
}

export async function createPiece(args: {
  userId: string;
  input: ClosetPieceInput;
}) {
  const { input } = args;
  const piece = await prisma.closetPiece.create({
    data: {
      userId: args.userId,
      imageUrl: input.imageUrl,
      publicId: input.publicId,
      name: input.name,
      category: input.category,
      color: input.color,
      swatchHex: input.swatchHex,
      fabric: input.fabric,
      formality: input.formality,
      season: input.season,
      brand: input.brand,
      notes: input.notes,
    },
  });
  await bumpClosetVersion(args.userId);
  return piece;
}

export async function updatePiece(args: {
  userId: string;
  pieceId: string;
  input: Partial<ClosetPieceInput>;
}) {
  // Force the userId match in the where clause so we can never overwrite
  // someone else's piece even if a wrong id is forged.
  const piece = await prisma.closetPiece.findFirst({
    where: { id: args.pieceId, userId: args.userId },
    select: { id: true },
  });
  if (!piece) throw new Error("Piece not found");

  const { input } = args;
  const updated = await prisma.closetPiece.update({
    where: { id: piece.id },
    data: {
      name: input.name,
      category: input.category,
      color: input.color,
      swatchHex: input.swatchHex,
      fabric: input.fabric,
      formality: input.formality,
      season: input.season,
      brand: input.brand,
      notes: input.notes,
    },
  });
  await bumpClosetVersion(args.userId);
  return updated;
}

export async function setPieceStatus(args: {
  userId: string;
  pieceId: string;
  status: PieceStatus;
}) {
  const piece = await prisma.closetPiece.findFirst({
    where: { id: args.pieceId, userId: args.userId },
    select: { id: true },
  });
  if (!piece) throw new Error("Piece not found");

  const updated = await prisma.closetPiece.update({
    where: { id: piece.id },
    data: { status: args.status },
  });
  await bumpClosetVersion(args.userId);
  return updated;
}

// "I wore this today" → bumps wearCount + updates lastWornAt. We don't need a
// dedicated WearLog table until the calendar / pair-history features land.
export async function logWear(args: { userId: string; pieceId: string }) {
  const piece = await prisma.closetPiece.findFirst({
    where: { id: args.pieceId, userId: args.userId },
    select: { id: true },
  });
  if (!piece) throw new Error("Piece not found");

  const updated = await prisma.closetPiece.update({
    where: { id: piece.id },
    data: {
      wearCount: { increment: 1 },
      lastWornAt: new Date(),
    },
  });
  await bumpClosetVersion(args.userId);
  return updated;
}

export async function deletePiece(args: { userId: string; pieceId: string }) {
  const piece = await prisma.closetPiece.findFirst({
    where: { id: args.pieceId, userId: args.userId },
    select: { id: true },
  });
  if (!piece) throw new Error("Piece not found");

  await prisma.closetPiece.delete({ where: { id: piece.id } });
  await bumpClosetVersion(args.userId);
}

// Stats strip on the gallery: total pieces, unworn count, most worn,
// "forgotten" (no wear in 6 months), and the dominant color cluster.
export async function getClosetStats(userId: string) {
  const [pieces, mostWorn, dominantColor] = await Promise.all([
    prisma.closetPiece.findMany({
      where: { userId, status: "IN_CLOSET" },
      select: {
        id: true,
        wearCount: true,
        lastWornAt: true,
        color: true,
        name: true,
      },
    }),
    prisma.closetPiece.findFirst({
      where: { userId, status: "IN_CLOSET", wearCount: { gt: 0 } },
      orderBy: { wearCount: "desc" },
      select: { id: true, name: true, wearCount: true },
    }),
    prisma.closetPiece.groupBy({
      by: ["color"],
      where: { userId, status: "IN_CLOSET", color: { not: null } },
      _count: { color: true },
      orderBy: { _count: { color: "desc" } },
      take: 2,
    }),
  ]);

  const total = pieces.length;
  const unworn = pieces.filter((p) => p.wearCount === 0).length;

  // "Forgotten" = a piece worn at least once but not in the last ~6 months.
  // Skips pieces with no wear log entirely (those count as unworn).
  const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6);
  const forgotten = pieces
    .filter((p) => p.lastWornAt && p.lastWornAt < sixMonthsAgo)
    .sort((a, b) => (a.lastWornAt?.getTime() ?? 0) - (b.lastWornAt?.getTime() ?? 0))[0];

  const colorCore = dominantColor
    .map((row) => row.color)
    .filter((c): c is string => Boolean(c))
    .slice(0, 2);
  const colorCorePct = total
    ? Math.round((dominantColor.reduce((s, r) => s + r._count.color, 0) / total) * 100)
    : 0;

  return {
    total,
    unworn,
    mostWorn,
    forgotten: forgotten ?? null,
    colorCore,
    colorCorePct,
  };
}
