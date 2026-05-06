import { z } from "zod";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Category } from "@prisma/client";
import { prisma } from "@/lib/adapters/prisma";
import { transformedUrl } from "@/lib/adapters/cloudinary";
import { searchProducts, type ProductSearchResult } from "./search-products";

// `build_outfit` — convenience wrapper over `search_products`. The agent
// could compose an outfit by calling `search_products` once per slot, but
// budget-splitting + slot-pairing is mechanical, so we let the tool handle
// it and free the model to focus on style reasoning.
//
// Logic:
//   1. Fetch the seed (must be PUBLISHED)
//   2. Pick companion slots based on seed.category
//   3. Even-split the remaining budget across slots
//   4. Search each slot inheriting gender / style / occasion / season from
//      the seed, capped by the per-slot budget
//   5. Return [seed, ...slots]; missing slots arrive as `null` so the model
//      can decide whether to ask the user for a wider budget or to drop a
//      category

export const buildOutfitArgs = z.object({
  seedProductId: z.string().min(1),
  budgetMinor: z.number().int().positive(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "currency must be 3-letter ISO 4217 code"),
});

export type BuildOutfitArgs = z.infer<typeof buildOutfitArgs>;

// Companion slots per seed category. Conservative defaults — the model can
// always do a follow-up search_products call for accessories / outerwear.
const COMPANIONS: Record<Category, Category[]> = {
  DRESSES: ["SHOES", "BAGS"],
  TOPS: ["BOTTOMS", "SHOES"],
  BOTTOMS: ["TOPS", "SHOES"],
  OUTERWEAR: ["TOPS", "BOTTOMS", "SHOES"],
  SHOES: ["TOPS", "BOTTOMS"],
  BAGS: ["TOPS", "BOTTOMS", "SHOES"],
  ACCESSORIES: ["TOPS", "BOTTOMS", "SHOES"],
};

export type OutfitSlot = {
  category: Category;
  product: ProductSearchResult | null;
  budgetMinor: number;
};

export type BuildOutfitResult = {
  seed: ProductSearchResult;
  slots: OutfitSlot[];
  budgetMinor: number;
  spentMinor: number;
  currency: string;
};

export const buildOutfitTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "build_outfit",
    description:
      "Anchor an outfit on one piece (the seed) and fill in companion pieces from the catalog within a total budget. Use this AFTER you've found a seed via search_products and the user has shared a budget. Returns the seed plus 2-3 companion products from compatible categories — null entries mean nothing fit the per-slot budget.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["seedProductId", "budgetMinor", "currency"],
      properties: {
        seedProductId: {
          type: "string",
          description:
            "Product `id` returned by a prior search_products call. Must be a PUBLISHED product.",
        },
        budgetMinor: {
          type: "integer",
          minimum: 1,
          description:
            "Total budget for the whole outfit, in minor currency units (e.g. 1500_00 for 1500 AED).",
        },
        currency: {
          type: "string",
          pattern: "^[A-Z]{3}$",
          description: "ISO 4217 code matching the seed's currency.",
        },
      },
    },
  },
};

export async function buildOutfit(rawArgs: unknown): Promise<BuildOutfitResult> {
  const args = buildOutfitArgs.parse(rawArgs);

  const seed = await prisma.product.findFirst({
    where: { id: args.seedProductId, status: "PUBLISHED" },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      seller: { select: { slug: true, storeNameEn: true } },
    },
  });
  if (!seed) {
    throw new Error(
      `seedProductId ${args.seedProductId} not found or not published`,
    );
  }
  if (seed.currency !== args.currency) {
    throw new Error(
      `Currency mismatch: seed is ${seed.currency}, budget is ${args.currency}`,
    );
  }
  if (seed.priceMinor > args.budgetMinor) {
    throw new Error(
      `Seed price (${seed.priceMinor}) exceeds total budget (${args.budgetMinor})`,
    );
  }

  const seedImage = seed.images[0];
  const seedResult: ProductSearchResult = {
    id: seed.id,
    slug: seed.slug,
    titleEn: seed.titleEn,
    titleAr: seed.titleAr,
    priceMinor: seed.priceMinor,
    currency: seed.currency,
    category: seed.category,
    gender: seed.gender,
    style: seed.style,
    occasion: seed.occasion,
    season: seed.season,
    imageUrl: seedImage ? transformedUrl(seedImage.publicId, 400) : null,
    sellerSlug: seed.seller.slug,
    sellerNameEn: seed.seller.storeNameEn,
  };

  const slotCategories = COMPANIONS[seed.category];
  const remaining = args.budgetMinor - seed.priceMinor;
  const perSlot = Math.floor(remaining / Math.max(slotCategories.length, 1));

  const slots: OutfitSlot[] = await Promise.all(
    slotCategories.map(async (category) => {
      const candidates = await searchProducts({
        category,
        gender: seed.gender,
        style: seed.style ?? undefined,
        occasion: seed.occasion ?? undefined,
        season: seed.season ?? undefined,
        currency: seed.currency,
        priceMax: perSlot,
        limit: 1,
      });
      return {
        category,
        budgetMinor: perSlot,
        product: candidates[0] ?? null,
      };
    }),
  );

  const spentMinor =
    seed.priceMinor +
    slots.reduce((sum, s) => sum + (s.product?.priceMinor ?? 0), 0);

  return {
    seed: seedResult,
    slots,
    budgetMinor: args.budgetMinor,
    spentMinor,
    currency: seed.currency,
  };
}
