import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { customAlphabet } from "nanoid";
import "dotenv/config";

const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

const adapter = new PrismaPg({
  connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL) as string,
});
const prisma = new PrismaClient({ adapter });

// ─── Sample imagery ──────────────────────────────────────────────────────
// We seed real fashion-product imagery from DummyJSON's public CDN so the
// catalog ships with category-appropriate photos out of the box. Each Vesture
// product picks (deterministically by slug) one DummyJSON product from a
// matching category and uses up to 3 of its images.
//
// If the network is unavailable at seed time, we fall back to Lorem Picsum so
// the script still completes. Replace with real seller uploads once the
// dashboard is in active use.

type DummyProduct = { images: string[] };

const DUMMY_CATEGORIES_BY_VESTURE: Record<string, { men: string[]; women: string[]; unisex: string[] }> = {
  TOPS:        { men: ["mens-shirts"], women: ["tops"], unisex: ["tops", "mens-shirts"] },
  BOTTOMS:     { men: ["mens-shirts"], women: ["womens-dresses"], unisex: ["womens-dresses"] },
  DRESSES:     { men: ["womens-dresses"], women: ["womens-dresses"], unisex: ["womens-dresses"] },
  OUTERWEAR:   { men: ["mens-shirts"], women: ["tops"], unisex: ["tops", "mens-shirts"] },
  SHOES:       { men: ["mens-shoes"], women: ["womens-shoes"], unisex: ["mens-shoes", "womens-shoes"] },
  BAGS:        { men: ["womens-bags"], women: ["womens-bags"], unisex: ["womens-bags"] },
  ACCESSORIES: { men: ["mens-watches", "sunglasses"], women: ["womens-watches", "sunglasses"], unisex: ["sunglasses"] },
};

const dummyCache = new Map<string, DummyProduct[]>();

async function fetchCategory(slug: string): Promise<DummyProduct[]> {
  if (dummyCache.has(slug)) return dummyCache.get(slug)!;
  try {
    const res = await fetch(
      `https://dummyjson.com/products/category/${slug}?limit=30&select=images`,
    );
    if (!res.ok) throw new Error(`${slug} → ${res.status}`);
    const data = (await res.json()) as { products: DummyProduct[] };
    dummyCache.set(slug, data.products);
    return data.products;
  } catch (e) {
    console.warn(`  ⚠ DummyJSON ${slug} unavailable, falling back to picsum:`, e);
    dummyCache.set(slug, []);
    return [];
  }
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

async function imagesForProduct(args: {
  slug: string;
  category: string;
  gender: "MEN" | "WOMEN" | "UNISEX" | "KIDS";
}) {
  const map = DUMMY_CATEGORIES_BY_VESTURE[args.category];
  const genderKey = args.gender === "MEN" ? "men" : args.gender === "WOMEN" ? "women" : "unisex";
  const candidateCategories = map?.[genderKey] ?? ["tops"];

  // Pool every DummyJSON product across the candidate categories.
  const pool: DummyProduct[] = [];
  for (const cat of candidateCategories) {
    pool.push(...(await fetchCategory(cat)));
  }

  if (pool.length === 0) {
    // Fallback: deterministic picsum photos.
    return [0, 1, 2].map((i) => ({
      url: `https://picsum.photos/seed/${encodeURIComponent(args.slug)}-${i}/720/900`,
      publicId: `picsum/${args.slug}-${i}`,
      position: i,
    }));
  }

  const picked = pool[hash(args.slug) % pool.length]!;
  const urls = picked.images.slice(0, 3);
  return urls.map((url, i) => ({
    url,
    publicId: `dummyjson/${args.slug}-${i}`,
    position: i,
  }));
}

// ─── Seed data ───────────────────────────────────────────────────────────

const sellers = [
  {
    clerkId: "seed_user_atelier",
    email: "atelier@example.com",
    storeNameEn: "Atelier Noir",
    storeNameAr: "أتيلييه نوار",
    bioEn: "Minimalist eveningwear handcrafted in Dubai.",
    bioAr: "ملابس سهرة بسيطة مصنوعة يدوياً في دبي.",
    countryCode: "AE",
    defaultCurrency: "AED",
    instagramUrl: "https://instagram.com/atelier.noir",
    whatsappE164: "+971501234567",
  },
  {
    clerkId: "seed_user_kohl",
    email: "kohl@example.com",
    storeNameEn: "Kohl & Linen",
    storeNameAr: "كحل ولينين",
    bioEn: "Slow fashion essentials from Riyadh.",
    bioAr: "أساسيات الموضة البطيئة من الرياض.",
    countryCode: "SA",
    defaultCurrency: "SAR",
    instagramUrl: "https://instagram.com/kohl.linen",
    whatsappE164: "+966551234567",
  },
  {
    clerkId: "seed_user_souk",
    email: "souk@example.com",
    storeNameEn: "Souk Studio",
    storeNameAr: "ستوديو السوق",
    bioEn: "Cairo streetwear with a vintage edge.",
    bioAr: "ملابس الشارع من القاهرة بلمسة كلاسيكية.",
    countryCode: "EG",
    defaultCurrency: "EGP",
    instagramUrl: "https://instagram.com/souk.studio",
    whatsappE164: "+201001234567",
  },
];

type SeedProduct = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priceMajor: number;
  category: Prisma.ProductCreateInput["category"];
  gender: Prisma.ProductCreateInput["gender"];
  season?: Prisma.ProductCreateInput["season"];
  occasion?: Prisma.ProductCreateInput["occasion"];
  style?: Prisma.ProductCreateInput["style"];
  sizes: string[];
  colors: string[];
};

const productsPerSeller: SeedProduct[][] = [
  // Atelier Noir
  [
    { titleEn: "Silk slip dress", titleAr: "فستان حريري انسيابي", descriptionEn: "Bias-cut silk in deep noir.", descriptionAr: "حرير مقصوص بأسلوب مائل بلون أسود عميق.", priceMajor: 1800, category: "DRESSES", gender: "WOMEN", season: "ALL_SEASON", occasion: "EVENING", style: "MINIMAL", sizes: ["S","M","L"], colors: ["black"] },
    { titleEn: "Pearl-collar blouse", titleAr: "بلوزة بياقة لؤلؤية", descriptionEn: "Hand-stitched freshwater pearls.", descriptionAr: "لآلئ مياه عذبة مخيطة يدوياً.", priceMajor: 950, category: "TOPS", gender: "WOMEN", season: "ALL_SEASON", occasion: "FORMAL", style: "CLASSIC", sizes: ["XS","S","M"], colors: ["ivory"] },
    { titleEn: "Wool tuxedo trouser", titleAr: "بنطلون تكسيدو صوفي", descriptionEn: "Sharp tailoring, satin side stripe.", descriptionAr: "تفصيل حاد مع شريط ساتان جانبي.", priceMajor: 1200, category: "BOTTOMS", gender: "WOMEN", season: "FALL", occasion: "FORMAL", style: "CLASSIC", sizes: ["S","M","L"], colors: ["black"] },
    { titleEn: "Cashmere column gown", titleAr: "فستان كشمير طويل", descriptionEn: "Floor-length, sleeveless.", descriptionAr: "بطول الأرض، بدون أكمام.", priceMajor: 3500, category: "DRESSES", gender: "WOMEN", season: "WINTER", occasion: "WEDDING", style: "LUXURY", sizes: ["S","M"], colors: ["camel"] },
    { titleEn: "Patent leather pump", titleAr: "حذاء براءة جلدي", descriptionEn: "85mm Italian sole.", descriptionAr: "نعل إيطالي 85 ملم.", priceMajor: 1450, category: "SHOES", gender: "WOMEN", season: "ALL_SEASON", occasion: "EVENING", style: "CLASSIC", sizes: ["37","38","39","40"], colors: ["black"] },
    { titleEn: "Velvet evening clutch", titleAr: "حقيبة سهرة مخملية", descriptionEn: "Brass-tipped frame.", descriptionAr: "إطار بأطراف نحاسية.", priceMajor: 750, category: "BAGS", gender: "WOMEN", season: "ALL_SEASON", occasion: "EVENING", style: "LUXURY", sizes: [], colors: ["burgundy"] },
    { titleEn: "Crepe jumpsuit", titleAr: "جمبسوت كريب", descriptionEn: "Wide leg, V-neck.", descriptionAr: "رجل واسعة، رقبة على شكل V.", priceMajor: 1650, category: "DRESSES", gender: "WOMEN", season: "SUMMER", occasion: "EVENING", style: "MINIMAL", sizes: ["S","M","L"], colors: ["black"] },
    { titleEn: "Mohair coat", titleAr: "معطف موهير", descriptionEn: "Oversized double-breasted.", descriptionAr: "مزدوج الصدر بقصة فضفاضة.", priceMajor: 2900, category: "OUTERWEAR", gender: "WOMEN", season: "WINTER", occasion: "WORK", style: "LUXURY", sizes: ["S","M","L"], colors: ["camel"] },
    { titleEn: "Statement earrings", titleAr: "أقراط مميزة", descriptionEn: "Sculptural drop, gold-vermeil.", descriptionAr: "تصميم نحتي بطلاء ذهبي.", priceMajor: 480, category: "ACCESSORIES", gender: "WOMEN", style: "LUXURY", sizes: [], colors: ["gold"] },
    { titleEn: "Silk scarf", titleAr: "وشاح حريري", descriptionEn: "Hand-rolled edges, 90×90cm.", descriptionAr: "حواف ملفوفة يدوياً، ٩٠×٩٠ سم.", priceMajor: 320, category: "ACCESSORIES", gender: "UNISEX", style: "CLASSIC", sizes: [], colors: ["ivory"] },
  ],
  // Kohl & Linen
  [
    { titleEn: "Linen kaftan", titleAr: "قفطان من الكتان", descriptionEn: "Loose-cut breathable linen.", descriptionAr: "كتان فضفاض ومريح.", priceMajor: 540, category: "DRESSES", gender: "WOMEN", season: "SUMMER", occasion: "VACATION", style: "BOHO", sizes: ["S","M","L","XL"], colors: ["sand"] },
    { titleEn: "Cotton wide-leg trouser", titleAr: "بنطلون قطن واسع", descriptionEn: "Heavyweight cotton, side pockets.", descriptionAr: "قطن ثقيل بجيوب جانبية.", priceMajor: 380, category: "BOTTOMS", gender: "UNISEX", season: "ALL_SEASON", occasion: "CASUAL", style: "MINIMAL", sizes: ["S","M","L"], colors: ["bone"] },
    { titleEn: "Embroidered tunic", titleAr: "تونيك مطرز", descriptionEn: "Hand-embroidered neckline.", descriptionAr: "رقبة مطرزة يدوياً.", priceMajor: 460, category: "TOPS", gender: "WOMEN", season: "SUMMER", occasion: "CASUAL", style: "BOHO", sizes: ["S","M","L"], colors: ["white"] },
    { titleEn: "Linen blazer", titleAr: "بليزر كتان", descriptionEn: "Unstructured, half-lined.", descriptionAr: "غير مهيكل، مبطن جزئياً.", priceMajor: 720, category: "OUTERWEAR", gender: "UNISEX", season: "SPRING", occasion: "WORK", style: "MINIMAL", sizes: ["M","L","XL"], colors: ["beige"] },
    { titleEn: "Suede mule", titleAr: "حذاء سويدي بدون كعب", descriptionEn: "Hand-finished leather sole.", descriptionAr: "نعل جلدي معالج يدوياً.", priceMajor: 480, category: "SHOES", gender: "WOMEN", season: "SUMMER", occasion: "CASUAL", style: "MINIMAL", sizes: ["37","38","39","40","41"], colors: ["tan"] },
    { titleEn: "Woven leather tote", titleAr: "حقيبة جلدية مضفرة", descriptionEn: "Handwoven full-grain leather.", descriptionAr: "جلد طبيعي مضفر يدوياً.", priceMajor: 1100, category: "BAGS", gender: "WOMEN", season: "ALL_SEASON", occasion: "CASUAL", style: "CLASSIC", sizes: [], colors: ["caramel"] },
    { titleEn: "Cotton-poplin shirt", titleAr: "قميص قطن بوبلين", descriptionEn: "Spread collar, French cuffs.", descriptionAr: "ياقة منتشرة وأكمام فرنسية.", priceMajor: 290, category: "TOPS", gender: "MEN", season: "ALL_SEASON", occasion: "WORK", style: "CLASSIC", sizes: ["M","L","XL"], colors: ["white"] },
    { titleEn: "Pleated maxi skirt", titleAr: "تنورة طويلة بثنيات", descriptionEn: "Knife pleats in flowing crepe.", descriptionAr: "ثنيات حادة بقماش كريب انسيابي.", priceMajor: 510, category: "BOTTOMS", gender: "WOMEN", season: "SPRING", occasion: "CASUAL", style: "MINIMAL", sizes: ["S","M","L"], colors: ["bone"] },
    { titleEn: "Leather belt", titleAr: "حزام جلدي", descriptionEn: "Brushed brass buckle.", descriptionAr: "إبزيم نحاسي مصقول.", priceMajor: 195, category: "ACCESSORIES", gender: "UNISEX", style: "MINIMAL", sizes: [], colors: ["black"] },
    { titleEn: "Hand-loomed scarf", titleAr: "وشاح منسوج يدوياً", descriptionEn: "Wool-cotton blend.", descriptionAr: "مزيج صوف وقطن.", priceMajor: 240, category: "ACCESSORIES", gender: "UNISEX", season: "WINTER", style: "BOHO", sizes: [], colors: ["rust"] },
  ],
  // Souk Studio
  [
    { titleEn: "Vintage band tee", titleAr: "قميص فرقة موسيقية", descriptionEn: "Reworked '90s rock tee.", descriptionAr: "قميص روك مُعاد تصميمه من التسعينات.", priceMajor: 850, category: "TOPS", gender: "UNISEX", season: "ALL_SEASON", occasion: "CASUAL", style: "VINTAGE", sizes: ["S","M","L","XL"], colors: ["black"] },
    { titleEn: "Cargo pant", titleAr: "بنطلون كارجو", descriptionEn: "Y2K silhouette with utility pockets.", descriptionAr: "تصميم الألفينات مع جيوب عملية.", priceMajor: 1200, category: "BOTTOMS", gender: "UNISEX", season: "ALL_SEASON", occasion: "CASUAL", style: "STREETWEAR", sizes: ["S","M","L"], colors: ["khaki"] },
    { titleEn: "Cropped denim jacket", titleAr: "جاكيت دنيم قصير", descriptionEn: "Acid-washed cotton denim.", descriptionAr: "دنيم قطني مغسول بطريقة الأسيد.", priceMajor: 1450, category: "OUTERWEAR", gender: "WOMEN", season: "SPRING", occasion: "CASUAL", style: "STREETWEAR", sizes: ["S","M"], colors: ["blue"] },
    { titleEn: "Mesh layering top", titleAr: "بلوزة شبكية للطبقات", descriptionEn: "Sheer mesh, long sleeves.", descriptionAr: "شبكي شفاف بأكمام طويلة.", priceMajor: 620, category: "TOPS", gender: "WOMEN", season: "SUMMER", occasion: "EVENING", style: "EDGY", sizes: ["XS","S","M"], colors: ["black"] },
    { titleEn: "Chunky platform sneaker", titleAr: "حذاء رياضي بنعل سميك", descriptionEn: "Recycled rubber sole.", descriptionAr: "نعل من المطاط المعاد تدويره.", priceMajor: 1850, category: "SHOES", gender: "UNISEX", season: "ALL_SEASON", occasion: "CASUAL", style: "STREETWEAR", sizes: ["38","39","40","41","42","43"], colors: ["white"] },
    { titleEn: "Mini shoulder bag", titleAr: "حقيبة كتف صغيرة", descriptionEn: "Y2K silver hardware.", descriptionAr: "إكسسوار فضي بطراز الألفينات.", priceMajor: 980, category: "BAGS", gender: "WOMEN", season: "ALL_SEASON", occasion: "EVENING", style: "VINTAGE", sizes: [], colors: ["silver"] },
    { titleEn: "Bias mini skirt", titleAr: "تنورة قصيرة مائلة", descriptionEn: "Satin with raw edge hem.", descriptionAr: "ساتان بحاشية مكشوفة.", priceMajor: 580, category: "BOTTOMS", gender: "WOMEN", season: "SPRING", occasion: "EVENING", style: "EDGY", sizes: ["XS","S","M"], colors: ["champagne"] },
    { titleEn: "Bucket hat", titleAr: "قبعة بصدفية", descriptionEn: "Reversible cotton twill.", descriptionAr: "قطن قابل للقلب.", priceMajor: 320, category: "ACCESSORIES", gender: "UNISEX", season: "SUMMER", occasion: "CASUAL", style: "STREETWEAR", sizes: [], colors: ["green"] },
    { titleEn: "Oversized varsity jacket", titleAr: "جاكيت جامعي فضفاض", descriptionEn: "Wool body, leather sleeves.", descriptionAr: "جسم صوفي بأكمام جلدية.", priceMajor: 2400, category: "OUTERWEAR", gender: "UNISEX", season: "FALL", occasion: "CASUAL", style: "VINTAGE", sizes: ["M","L","XL"], colors: ["cream"] },
    { titleEn: "Print silk shirt", titleAr: "قميص حريري مطبوع", descriptionEn: "Archive print, mother-of-pearl buttons.", descriptionAr: "طباعة من الأرشيف بأزرار من اللؤلؤ.", priceMajor: 1300, category: "TOPS", gender: "MEN", season: "SUMMER", occasion: "EVENING", style: "VINTAGE", sizes: ["M","L"], colors: ["multi"] },
  ],
];

// ─── Run ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("⏳ Seeding Vesture…");

  // Idempotency: wipe products from prior seed runs (only seed sellers — leaves
  // any real-user uploads untouched). Image rows cascade-delete via the schema.
  const wiped = await prisma.product.deleteMany({
    where: { seller: { user: { clerkId: { startsWith: "seed_user_" } } } },
  });
  if (wiped.count > 0) console.log(`  ↺ cleared ${wiped.count} prior seed products`);

  for (let i = 0; i < sellers.length; i++) {
    const s = sellers[i]!;
    const products = productsPerSeller[i]!;

    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: { clerkId: s.clerkId, email: s.email, role: "SELLER" },
      update: { role: "SELLER" },
    });

    const seller = await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        slug: `${slugify(s.storeNameEn)}-${slugSuffix()}`,
        status: "APPROVED",
        approvedAt: new Date(),
        storeNameEn: s.storeNameEn,
        storeNameAr: s.storeNameAr,
        bioEn: s.bioEn,
        bioAr: s.bioAr,
        countryCode: s.countryCode,
        defaultCurrency: s.defaultCurrency,
        instagramUrl: s.instagramUrl,
        whatsappE164: s.whatsappE164,
      },
      update: {
        storeNameEn: s.storeNameEn,
        storeNameAr: s.storeNameAr,
        status: "APPROVED",
      },
    });

    for (const p of products) {
      const productSlug = `${slugify(p.titleEn)}-${slugSuffix()}`;
      const images = await imagesForProduct({
        slug: productSlug,
        category: p.category as string,
        gender: p.gender as "MEN" | "WOMEN" | "UNISEX" | "KIDS",
      });
      await prisma.product.create({
        data: {
          sellerId: seller.id,
          titleEn: p.titleEn,
          titleAr: p.titleAr,
          slug: productSlug,
          descriptionEn: p.descriptionEn,
          descriptionAr: p.descriptionAr,
          priceMinor: p.priceMajor * 100,
          currency: s.defaultCurrency,
          category: p.category,
          gender: p.gender,
          season: p.season,
          occasion: p.occasion,
          style: p.style,
          sizes: p.sizes,
          colors: p.colors,
          status: "PUBLISHED",
          publishedAt: new Date(),
          images: { create: images },
        },
      });
    }

    console.log(`  ✓ ${s.storeNameEn}: ${products.length} products`);
  }

  console.log("✅ Seed complete.");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
