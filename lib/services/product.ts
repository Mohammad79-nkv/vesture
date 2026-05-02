import { prisma } from "@/lib/adapters/prisma";
import { makeSlug } from "@/lib/domain/slug";
import {
  productInputSchema,
  catalogFiltersSchema,
  type ProductInput,
  type CatalogFilters,
} from "@/lib/domain/schemas";
import type { Category, Product, ProductStatus } from "@prisma/client";

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

// Paginated, filterable list for the seller catalog page. Status="ALL"
// means no status filter; otherwise restricts to a specific status.
export async function sellerCatalogList(args: {
  sellerId: string;
  status?: ProductStatus | "ALL";
  category?: Category;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? 25;
  const where = {
    sellerId: args.sellerId,
    ...(args.status && args.status !== "ALL" ? { status: args.status } : {}),
    ...(args.category ? { category: args.category } : {}),
    ...(args.search
      ? {
          OR: [
            { titleEn: { contains: args.search, mode: "insensitive" as const } },
            { titleAr: { contains: args.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { images: { orderBy: { position: "asc" }, take: 1 } },
    }),
    prisma.product.count({ where }),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Per-status counts for the catalog tabs strip. Includes ALL as a synthesized
// total. Statuses with zero rows still appear in the result set.
export async function sellerCatalogStatusCounts(sellerId: string) {
  const groups = await prisma.product.groupBy({
    by: ["status"],
    where: { sellerId },
    _count: { _all: true },
  });
  const counts: Record<ProductStatus | "ALL", number> = {
    ALL: 0,
    PUBLISHED: 0,
    DRAFT: 0,
    PENDING_REVIEW: 0,
    ARCHIVED: 0,
    REJECTED: 0,
  };
  for (const g of groups) {
    counts[g.status] = g._count._all;
    counts.ALL += g._count._all;
  }
  return counts;
}

// Catalog counters for the seller dashboard KPI row.
export async function sellerCatalogCounts(sellerId: string) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [published, drafts, pendingReview, addedThisWeek] = await Promise.all([
    prisma.product.count({ where: { sellerId, status: "PUBLISHED" } }),
    prisma.product.count({ where: { sellerId, status: "DRAFT" } }),
    prisma.product.count({ where: { sellerId, status: "PENDING_REVIEW" } }),
    prisma.product.count({
      where: { sellerId, createdAt: { gte: oneWeekAgo } },
    }),
  ]);
  return { published, drafts, pendingReview, addedThisWeek };
}

// Most-recent published listings — used by the dashboard's recap card.
export function listSellerRecentPublished(sellerId: string, limit = 4) {
  return prisma.product.findMany({
    where: { sellerId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
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
