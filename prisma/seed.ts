import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { customAlphabet } from "nanoid";
import "dotenv/config";

const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

const adapter = new PrismaPg({
  connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL) as string,
});
const prisma = new PrismaClient({ adapter });

// ─── Test Cloudinary URLs ────────────────────────────────────────────────
// Public Cloudinary demo asset that always works for development. Replace
// with seller-specific images when real catalogs are seeded.
const SAMPLE_IMG =
  "https://res.cloudinary.com/demo/image/upload/w_800,c_fill,q_auto,f_auto/sample.jpg";
const SAMPLE_PUBLIC_ID = "demo/sample";

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
      await prisma.product.create({
        data: {
          sellerId: seller.id,
          titleEn: p.titleEn,
          titleAr: p.titleAr,
          slug: `${slugify(p.titleEn)}-${slugSuffix()}`,
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
          images: {
            create: [
              { url: SAMPLE_IMG, publicId: SAMPLE_PUBLIC_ID, position: 0 },
            ],
          },
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
