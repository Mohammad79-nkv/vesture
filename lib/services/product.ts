import { prisma } from "@/lib/adapters/prisma";
import { makeSlug } from "@/lib/domain/slug";
import {
  productInputSchema,
  catalogFiltersSchema,
  type ProductInput,
  type CatalogFilters,
} from "@/lib/domain/schemas";
import type { Product } from "@prisma/client";

// Pagination constant — we never want catalog pages bigger than this for
// performance, and smaller pages encourage filter use.
const PAGE_SIZE = 24;

// ─── Mutations ──────────────────────────────────────────────────────────

export async function createProduct(args: {
  sellerId: string;
  raw: unknown;
}): Promise<Product> {
  const input = productInputSchema.parse(args.raw) satisfies ProductInput;

  return prisma.product.create({
    data: {
      sellerId: args.sellerId,
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      slug: makeSlug(input.titleEn),
      descriptionEn: input.descriptionEn,
      descriptionAr: input.descriptionAr,
      priceMinor: input.priceMinor,
      currency: input.currency,
      category: input.category,
      gender: input.gender,
      season: input.season,
      occasion: input.occasion,
      style: input.style,
      sizes: input.sizes,
      colors: input.colors.map((c) => c.toLowerCase()),
      status: "DRAFT",
      images: {
        create: input.images.map((img, i) => ({
          url: img.url,
          publicId: img.publicId,
          alt: img.alt,
          position: img.position ?? i,
        })),
      },
    },
  });
}

export async function updateProduct(args: {
  sellerId: string;
  productId: string;
  raw: unknown;
}): Promise<Product> {
  const input = productInputSchema.parse(args.raw) satisfies ProductInput;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findFirst({
      where: { id: args.productId, sellerId: args.sellerId },
    });
    if (!existing) throw new Error("Product not found");

    // Replace the image set rather than diffing; the editor sends the full
    // current state of the gallery on each save.
    await tx.productImage.deleteMany({ where: { productId: args.productId } });

    return tx.product.update({
      where: { id: args.productId },
      data: {
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        descriptionEn: input.descriptionEn,
        descriptionAr: input.descriptionAr,
        priceMinor: input.priceMinor,
        currency: input.currency,
        category: input.category,
        gender: input.gender,
        season: input.season,
        occasion: input.occasion,
        style: input.style,
        sizes: input.sizes,
        colors: input.colors.map((c) => c.toLowerCase()),
        images: {
          create: input.images.map((img, i) => ({
            url: img.url,
            publicId: img.publicId,
            alt: img.alt,
            position: img.position ?? i,
          })),
        },
      },
    });
  });
}

export async function publishProduct(args: {
  sellerId: string;
  productId: string;
}): Promise<Product> {
  return prisma.product.update({
    where: { id: args.productId, sellerId: args.sellerId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
}

export async function archiveProduct(args: {
  sellerId: string;
  productId: string;
}): Promise<Product> {
  return prisma.product.update({
    where: { id: args.productId, sellerId: args.sellerId },
    data: { status: "ARCHIVED" },
  });
}

// ─── Queries ────────────────────────────────────────────────────────────

export function listSellerProducts(sellerId: string) {
  return prisma.product.findMany({
    where: { sellerId },
    orderBy: { updatedAt: "desc" },
    include: { images: { orderBy: { position: "asc" }, take: 1 } },
  });
}

export function getProductForEdit(args: {
  sellerId: string;
  productId: string;
}) {
  return prisma.product.findFirst({
    where: { id: args.productId, sellerId: args.sellerId },
    include: { images: { orderBy: { position: "asc" } } },
  });
}

// "More from this seller" — used at the bottom of the product detail page.
export async function listOtherSellerProducts(args: {
  sellerId: string;
  excludeProductId: string;
  limit?: number;
}) {
  const [items, totalPublished] = await Promise.all([
    prisma.product.findMany({
      where: {
        sellerId: args.sellerId,
        status: "PUBLISHED",
        NOT: { id: args.excludeProductId },
      },
      orderBy: { publishedAt: "desc" },
      take: args.limit ?? 6,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        seller: { select: { slug: true, storeNameEn: true, storeNameAr: true } },
      },
    }),
    prisma.product.count({
      where: { sellerId: args.sellerId, status: "PUBLISHED" },
    }),
  ]);
  return { items, totalPublished };
}

export function getPublishedProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug, status: "PUBLISHED" },
    include: {
      images: { orderBy: { position: "asc" } },
      seller: {
        select: {
          id: true,
          slug: true,
          storeNameEn: true,
          storeNameAr: true,
          countryCode: true,
          whatsappE164: true,
          instagramUrl: true,
        },
      },
    },
  });
}

export async function listPublishedProducts(rawFilters: unknown) {
  const f = catalogFiltersSchema.parse(rawFilters) satisfies CatalogFilters;

  const where = {
    status: "PUBLISHED" as const,
    ...(f.category && { category: f.category }),
    ...(f.gender && { gender: f.gender }),
    ...(f.currency && { currency: f.currency }),
    ...((f.minPrice !== undefined || f.maxPrice !== undefined) && {
      priceMinor: {
        ...(f.minPrice !== undefined && { gte: f.minPrice }),
        ...(f.maxPrice !== undefined && { lte: f.maxPrice }),
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        seller: { select: { slug: true, storeNameEn: true, storeNameAr: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page: f.page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
