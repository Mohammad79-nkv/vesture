import { prisma } from "@/lib/adapters/prisma";

export async function toggleFavorite(args: {
  userId: string;
  productId: string;
}): Promise<{ favorited: boolean }> {
  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: args.userId, productId: args.productId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  await prisma.favorite.create({
    data: { userId: args.userId, productId: args.productId },
  });
  return { favorited: true };
}

export function listFavorites(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          images: { orderBy: { position: "asc" }, take: 1 },
          seller: { select: { slug: true, storeNameEn: true, storeNameAr: true } },
        },
      },
    },
  });
}

export async function isFavorited(args: {
  userId: string;
  productId: string;
}): Promise<boolean> {
  const fav = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: args.userId, productId: args.productId } },
  });
  return fav !== null;
}
