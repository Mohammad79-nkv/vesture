import { z } from "zod";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/adapters/prisma";
import { transformedUrl } from "@/lib/adapters/cloudinary";

// `search_products` — the workhorse tool for the stylist. Structured filters
// only (no free-text); the agent translates fuzzy intent like "minimalist
// summer wedding" into category/style/occasion/season picks before calling.
//
// Phase 3 will swap the Postgres scan for a hybrid pgvector cosine + filter
// query. Same input shape, same output shape — just a different query body.

export const searchProductsArgs = z.object({
  category: z
    .enum(["TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "BAGS", "ACCESSORIES"])
    .optional(),
  gender: z.enum(["WOMEN", "MEN", "UNISEX", "KIDS"]).optional(),
  season: z
    .enum(["SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"])
    .optional(),
  occasion: z
    .enum(["CASUAL", "WORK", "FORMAL", "EVENING", "WEDDING", "VACATION", "SPORT"])
    .optional(),
  style: z
    .enum(["MINIMAL", "STREETWEAR", "CLASSIC", "BOHO", "LUXURY", "VINTAGE", "EDGY"])
    .optional(),
  // Prices are MINOR units (fils, halala, cents, …). Same convention as the
  // catalog filters so we can pass values straight through.
  priceMin: z.number().int().nonnegative().optional(),
  priceMax: z.number().int().positive().optional(),
  // ISO 4217 — one currency per query so the budget filter is meaningful.
  // The stylist asks the user up front if they care; otherwise it omits.
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "currency must be 3-letter ISO 4217 code")
    .optional(),
  limit: z.number().int().min(1).max(12).default(6),
});

export type SearchProductsArgs = z.infer<typeof searchProductsArgs>;

export type ProductSearchResult = {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string | null;
  priceMinor: number;
  currency: string;
  category: string;
  gender: string;
  style: string | null;
  occasion: string | null;
  season: string | null;
  imageUrl: string | null;
  sellerSlug: string;
  sellerNameEn: string;
};

// JSON-schema definition handed to the model. Descriptions are critical —
// the model uses them to decide WHEN to call vs ask the user; keep them
// short, action-oriented, and concrete about the enum vocab.
export const searchProductsTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_products",
    description:
      "Search the live Vesture catalog with structured filters. Use this whenever you need real products to recommend. All filters are optional — combine the ones the user has expressed or strongly implied. Returns up to `limit` products newest-first.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: {
          type: "string",
          enum: ["TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "BAGS", "ACCESSORIES"],
          description: "Garment category. Pick one when the user names a slot.",
        },
        gender: {
          type: "string",
          enum: ["WOMEN", "MEN", "UNISEX", "KIDS"],
          description: "Default to the user's stated gender; UNISEX matches everyone.",
        },
        season: {
          type: "string",
          enum: ["SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"],
        },
        occasion: {
          type: "string",
          enum: ["CASUAL", "WORK", "FORMAL", "EVENING", "WEDDING", "VACATION", "SPORT"],
        },
        style: {
          type: "string",
          enum: ["MINIMAL", "STREETWEAR", "CLASSIC", "BOHO", "LUXURY", "VINTAGE", "EDGY"],
          description:
            "Aesthetic vibe — derive from the user's brief (\"quiet luxury\" → LUXURY, \"clean lines\" → MINIMAL).",
        },
        priceMin: {
          type: "integer",
          minimum: 0,
          description: "Lower bound, in minor currency units (e.g. fils for AED).",
        },
        priceMax: {
          type: "integer",
          minimum: 1,
          description:
            "Upper bound, minor currency units. Use this to honour the user's budget.",
        },
        currency: {
          type: "string",
          pattern: "^[A-Z]{3}$",
          description:
            "ISO 4217 code (AED, SAR, EGP, USD, ...). Required when priceMin / priceMax is set, otherwise omit.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 12,
          default: 6,
          description: "How many products to return. Keep small (3-6) for outfit briefs.",
        },
      },
    },
  },
};

export async function searchProducts(
  rawArgs: unknown,
): Promise<ProductSearchResult[]> {
  const args = searchProductsArgs.parse(rawArgs);

  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    ...(args.category && { category: args.category }),
    ...(args.gender && { gender: args.gender }),
    ...(args.season && { season: args.season }),
    ...(args.occasion && { occasion: args.occasion }),
    ...(args.style && { style: args.style }),
    ...(args.currency && { currency: args.currency }),
  };
  if (args.priceMin !== undefined || args.priceMax !== undefined) {
    where.priceMinor = {
      ...(args.priceMin !== undefined && { gte: args.priceMin }),
      ...(args.priceMax !== undefined && { lte: args.priceMax }),
    };
  }

  const rows = await prisma.product.findMany({
    where,
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      seller: { select: { slug: true, storeNameEn: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: args.limit,
  });

  return rows.map((p) => {
    const image = p.images[0];
    return {
      id: p.id,
      slug: p.slug,
      titleEn: p.titleEn,
      titleAr: p.titleAr,
      priceMinor: p.priceMinor,
      currency: p.currency,
      category: p.category,
      gender: p.gender,
      style: p.style,
      occasion: p.occasion,
      season: p.season,
      imageUrl: image ? transformedUrl(image.publicId, 400) : null,
      sellerSlug: p.seller.slug,
      sellerNameEn: p.seller.storeNameEn,
    };
  });
}
