import { z } from "zod";

// ─── Shared atoms ───────────────────────────────────────────────────────

const trimmedString = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

// ISO 4217 — three uppercase letters. We don't validate against a list because
// new currencies appear and we want sellers to use their local one. The form's
// CSS uppercase class only changes display, not the submitted value, so we
// normalize to uppercase before the regex check.
const currencyCode = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code"),
  );

// ISO 3166-1 alpha-2. Same uppercase normalization as currency.
const countryCode = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{2}$/, "Country must be a 2-letter ISO 3166-1 code"),
  );

// E.164 — leading +, then 8–15 digits. Strip whitespace + dashes seller may
// have typed (common when copy-pasting from a phone book).
const e164Phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\+\d{8,15}$/, "Phone must be in E.164 format (e.g. +971501234567)"),
  );

// ─── Seller onboarding ──────────────────────────────────────────────────

export const sellerOnboardingSchema = z.object({
  storeNameEn: trimmedString(2, 60),
  storeNameAr: trimmedString(2, 60).optional().or(z.literal("").transform(() => undefined)),
  bioEn: trimmedString(0, 500).optional(),
  bioAr: trimmedString(0, 500).optional(),
  countryCode,
  defaultCurrency: currencyCode,
  instagramUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  whatsappE164: e164Phone.optional().or(z.literal("").transform(() => undefined)),
});

export type SellerOnboardingInput = z.infer<typeof sellerOnboardingSchema>;

// ─── Product ────────────────────────────────────────────────────────────

export const productCategoryEnum = z.enum([
  "TOPS",
  "BOTTOMS",
  "DRESSES",
  "OUTERWEAR",
  "SHOES",
  "BAGS",
  "ACCESSORIES",
]);
export const productGenderEnum = z.enum(["WOMEN", "MEN", "UNISEX", "KIDS"]);
export const productSeasonEnum = z.enum(["SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"]);
export const productOccasionEnum = z.enum([
  "CASUAL",
  "WORK",
  "FORMAL",
  "EVENING",
  "WEDDING",
  "VACATION",
  "SPORT",
]);
export const productStyleEnum = z.enum([
  "MINIMAL",
  "STREETWEAR",
  "CLASSIC",
  "BOHO",
  "LUXURY",
  "VINTAGE",
  "EDGY",
]);

export const productImageInputSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  alt: z.string().max(140).optional(),
  position: z.number().int().min(0).max(20),
});

export const productInputSchema = z.object({
  titleEn: trimmedString(3, 120),
  titleAr: trimmedString(3, 120).optional().or(z.literal("").transform(() => undefined)),
  descriptionEn: trimmedString(10, 2000),
  descriptionAr: trimmedString(10, 2000).optional().or(z.literal("").transform(() => undefined)),
  priceMinor: z.number().int().positive().max(100_000_000),
  currency: currencyCode,
  category: productCategoryEnum,
  gender: productGenderEnum,
  season: productSeasonEnum.optional(),
  occasion: productOccasionEnum.optional(),
  style: productStyleEnum.optional(),
  sizes: z.array(z.string().trim().min(1).max(12)).max(20),
  colors: z.array(z.string().trim().min(1).max(24)).max(12),
  images: z.array(productImageInputSchema).min(1).max(10),
});

export type ProductInput = z.infer<typeof productInputSchema>;

// ─── Catalog filters ────────────────────────────────────────────────────

export const catalogFiltersSchema = z.object({
  category: productCategoryEnum.optional(),
  gender: productGenderEnum.optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  currency: currencyCode.optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

// ─── Closet ─────────────────────────────────────────────────────────────

export const formalityEnum = z.enum(["CASUAL", "SMART_CASUAL", "FORMAL"]);
export const pieceStatusEnum = z.enum([
  "IN_CLOSET",
  "LENT",
  "CLEANER",
  "STORAGE",
  "DONATED",
  "ARCHIVED",
]);

const optionalText = (max: number) =>
  trimmedString(0, max)
    .optional()
    .or(z.literal("").transform(() => undefined));

const hexSwatch = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Swatch must be a 6-digit hex like #C9CDD6")
  .optional()
  .or(z.literal("").transform(() => undefined));

// Used by the add-piece form. `imageUrl` + `publicId` come from the Cloudinary
// signed upload step; everything else is the user's manual tagging.
export const closetPieceInputSchema = z.object({
  imageUrl: z.string().url(),
  publicId: z.string().min(1),
  name: optionalText(80),
  category: productCategoryEnum,
  color: optionalText(24),
  swatchHex: hexSwatch,
  fabric: optionalText(40),
  formality: formalityEnum.optional(),
  season: productSeasonEnum.optional(),
  brand: optionalText(40),
  notes: optionalText(280),
});

export type ClosetPieceInput = z.infer<typeof closetPieceInputSchema>;

export const closetFiltersSchema = z.object({
  category: productCategoryEnum.optional(),
  status: pieceStatusEnum.optional(),
});

export type ClosetFilters = z.infer<typeof closetFiltersSchema>;
