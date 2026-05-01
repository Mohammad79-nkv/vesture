import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { isLocale } from "@/lib/i18n/config";
import {
  getPublishedProductBySlug,
  listOtherSellerProducts,
} from "@/lib/services/product";
import { getOrCreateDbUser } from "@/lib/auth";
import { isFavorited } from "@/lib/services/favorite";
import { prisma } from "@/lib/adapters/prisma";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import { ProductBreadcrumb } from "@/components/product/ProductBreadcrumb";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductMeta } from "@/components/product/ProductMeta";
import { SizeAndContact } from "@/components/product/SizeAndContact";
import { SellerCard } from "@/components/product/SellerCard";
import { MoreFromSeller } from "@/components/product/MoreFromSeller";
import { StylistCallout } from "@/components/marketing/StylistCallout";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();

  const t = await getTranslations("product");
  const title = pickLocalized({ en: product.titleEn, ar: product.titleAr }, locale);
  const description = pickLocalized(
    { en: product.descriptionEn, ar: product.descriptionAr },
    locale,
  );

  const { userId: clerkId } = await auth();
  const authenticated = Boolean(clerkId);
  let initiallyFavorited = false;
  if (clerkId) {
    const me = await getOrCreateDbUser();
    if (me) initiallyFavorited = await isFavorited({ userId: me.id, productId: product.id });
  }

  // "More from this seller" + favorited set scoped to those products.
  const others = await listOtherSellerProducts({
    sellerId: product.seller.id,
    excludeProductId: product.id,
    limit: 6,
  });

  let othersFavoritedIds = new Set<string>();
  if (clerkId && others.items.length > 0) {
    const me = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (me) {
      const favs = await prisma.favorite.findMany({
        where: { userId: me.id, productId: { in: others.items.map((p) => p.id) } },
        select: { productId: true },
      });
      othersFavoritedIds = new Set(favs.map((f) => f.productId));
    }
  }

  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${locale}/products/${product.slug}`;

  // Hashtag chips: aiTags (Phase 3) plus deterministic ones from taxonomy so
  // we always have something to show.
  const hashtags = [
    ...(product.aiTags ?? []),
    product.category.toLowerCase(),
    product.style?.toLowerCase(),
    product.occasion?.toLowerCase(),
  ].filter((s): s is string => Boolean(s));

  return (
    <main className="flex flex-1 flex-col bg-mist">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-8">
        <ProductBreadcrumb
          trail={[
            { label: t("breadcrumbDiscover"), href: "/products" },
            { label: product.category },
            { label: title },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Gallery + info */}
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
            <ProductGallery images={product.images} title={title} />

            <div className="flex flex-col">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-ink/55">
                {t("eyebrowNewIn")} · {product.category}
              </p>
              <ProductTitle title={title} />

              <p className="mt-6 max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/75">
                {description}
              </p>

              <div className="my-8 h-px bg-ink/10" />

              <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
                <p className="text-3xl font-extrabold tracking-tight">
                  {formatPrice(product.priceMinor, product.currency, locale)}
                </p>
                <span className="rounded-full bg-secondary/15 px-3 py-1 text-xs font-medium text-secondary">
                  {t("available")}
                </span>
              </div>

              <SizeAndContact
                productId={product.id}
                productTitle={title}
                productUrl={productUrl}
                sizes={product.sizes}
                sellerHandle={product.seller.slug}
                whatsappE164={product.seller.whatsappE164}
                instagramUrl={product.seller.instagramUrl}
                initiallyFavorited={initiallyFavorited}
                authenticated={authenticated}
                locale={locale}
              />

              <div className="mt-8">
                <ProductMeta />
              </div>

              {hashtags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {hashtags.slice(0, 6).map((tag) => (
                    <span key={tag} className="text-xs text-primary">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Seller side card */}
          <SellerCard seller={product.seller} locale={locale}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/55">
              {t("recentBuyers")}
            </p>
            <p className="mt-2 text-sm text-ink/55">{t("noReviews")}</p>
          </SellerCard>
        </div>

        <StylistCallout />

        <MoreFromSeller
          locale={locale}
          authenticated={authenticated}
          favoritedIds={othersFavoritedIds}
          seller={{
            slug: product.seller.slug,
            storeNameEn: product.seller.storeNameEn,
            storeNameAr: product.seller.storeNameAr,
          }}
          products={others.items}
          totalPublished={others.totalPublished}
        />
      </div>
    </main>
  );
}

// Splits the title's last word and renders it in primary, matching the design's
// "Cropped boucle [jacket]" treatment. Falls back to plain title for one word.
function ProductTitle({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) {
    return <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>;
  }
  const last = words[words.length - 1];
  const head = words.slice(0, -1).join(" ");
  return (
    <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
      {head} <span className="text-primary">{last}</span>
    </h1>
  );
}
