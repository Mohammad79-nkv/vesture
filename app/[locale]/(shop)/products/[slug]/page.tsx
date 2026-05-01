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
import { Link } from "@/lib/i18n/navigation";
import { ProductBreadcrumb } from "@/components/product/ProductBreadcrumb";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductMeta } from "@/components/product/ProductMeta";
import { SizeAndContact } from "@/components/product/SizeAndContact";
import { SellerCard } from "@/components/product/SellerCard";
import { MoreFromSeller } from "@/components/product/MoreFromSeller";
import { StylistCallout } from "@/components/marketing/StylistCallout";
import { MobileProductGallery } from "@/components/product/MobileProductGallery";
import { MobileProductFooter } from "@/components/product/MobileProductFooter";
import { SellerAvatar } from "@/components/ui/SellerAvatar";

const COUNTRY_CITY: Record<string, string> = {
  AE: "Dubai",
  SA: "Riyadh",
  EG: "Cairo",
  IR: "Tehran",
  TR: "Istanbul",
};

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
  const storeName = pickLocalized(
    { en: product.seller.storeNameEn, ar: product.seller.storeNameAr },
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
  const outgoingMessage = `Hi @${product.seller.slug} — found you on Vesture. Is the ${title} still available?\n${productUrl}`;
  const channelUrl = product.seller.whatsappE164
    ? `https://wa.me/${product.seller.whatsappE164.replace(/^\+/, "")}?text=${encodeURIComponent(outgoingMessage)}`
    : product.seller.instagramUrl ?? null;

  const cityLabel = COUNTRY_CITY[product.seller.countryCode] ?? product.seller.countryCode;

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
      {/* ─── Mobile path ─── */}
      <div className="lg:hidden">
        <div className="relative">
          <MobileProductGallery images={product.images} title={title} />

          {/* Back + Share controls floating over the hero */}
          <Link
            href="/products"
            aria-label={t("back")}
            className="absolute start-4 top-12 grid h-9 w-9 place-items-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <button
            type="button"
            aria-label={t("share")}
            className="absolute end-4 top-12 grid h-9 w-9 place-items-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur"
            disabled
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>

        {/* Tags + title + price */}
        <section className="px-5 pt-5">
          {hashtags.length > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {hashtags.slice(0, 4).join(" · ")}
            </p>
          )}
          <h1 className="mt-1.5 text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="mt-1 font-mono text-sm text-ink">
            {formatPrice(product.priceMinor, product.currency, locale)}
          </p>
        </section>

        {/* Compact seller card */}
        <Link
          href={`/sellers/${product.seller.slug}`}
          className="mx-3.5 mt-4 flex items-center gap-3 rounded-2xl bg-paper p-3.5"
        >
          <SellerAvatar slug={product.seller.slug} name={product.seller.storeNameEn} size={42} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-medium">{storeName}</span>
              <span
                className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-secondary text-paper"
                aria-label="Verified"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </div>
            <p className="truncate font-mono text-[11px] text-muted">
              @{product.seller.slug} · {cityLabel}
            </p>
          </div>
          <span className="rounded-full border border-ink/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink">
            {t("follow")}
          </span>
        </Link>

        {/* Description + 4-cell detail grid */}
        <section className="px-5 pt-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {t("thePiece")}
          </h3>
          <p className="mt-2.5 whitespace-pre-line text-[13.5px] leading-[1.55] text-ink-soft">
            {description}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <DetailCell label={t("sizes")} value={product.sizes.join(" / ") || undefined} />
            <DetailCell label={t("material")} />
            <DetailCell label={t("ships")} />
            <DetailCell label={t("returns")} />
          </div>
        </section>

        {/* Bottom spacer so content isn't hidden behind sticky footer */}
        <div className="h-32" />

        <MobileProductFooter
          productId={product.id}
          initiallyFavorited={initiallyFavorited}
          authenticated={authenticated}
          locale={locale}
          sellerHandle={product.seller.slug}
          channelUrl={channelUrl}
        />
      </div>

      {/* ─── Desktop path ─── */}
      <div className="mx-auto hidden w-full max-w-[1400px] px-6 py-8 lg:block">
        <ProductBreadcrumb
          trail={[
            { label: t("breadcrumbDiscover"), href: "/products" },
            { label: product.category },
            { label: title },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
            <ProductGallery images={product.images} title={title} />

            <div className="flex flex-col">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
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

          <SellerCard seller={product.seller} locale={locale}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
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

function DetailCell({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      {value && <p className="mt-0.5 text-[12px] text-ink">{value}</p>}
    </div>
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
