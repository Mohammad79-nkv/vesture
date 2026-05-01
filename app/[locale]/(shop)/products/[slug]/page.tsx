import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getPublishedProductBySlug } from "@/lib/services/product";
import { getOrCreateDbUser } from "@/lib/auth";
import { isFavorited } from "@/lib/services/favorite";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import { FavoriteButton } from "@/components/product/FavoriteButton";

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
  let initiallyFavorited = false;
  if (clerkId) {
    const me = await getOrCreateDbUser();
    if (me) initiallyFavorited = await isFavorited({ userId: me.id, productId: product.id });
  }

  const contactMessage = encodeURIComponent(
    `Hi ${storeName}, I'm interested in "${title}" — ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${locale}/products/${product.slug}`,
  );
  const whatsappUrl = product.seller.whatsappE164
    ? `https://wa.me/${product.seller.whatsappE164.replace(/^\+/, "")}?text=${contactMessage}`
    : null;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-2">
      <div className="space-y-3">
        {product.images.map((img) => (
          <div key={img.id} className="relative aspect-[3/4] bg-mist">
            <Image
              src={img.url}
              alt={img.alt ?? title}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority={img.position === 0}
            />
          </div>
        ))}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-ink/60">
          <Link
            href={`/sellers/${product.seller.slug}`}
            className="underline-offset-4 hover:underline"
          >
            {storeName}
          </Link>
        </p>
        <h1 className="mb-4 text-3xl font-light">{title}</h1>
        <p className="mb-6 text-xl">
          {formatPrice(product.priceMinor, product.currency, locale)}
        </p>

        <p className="mb-6 whitespace-pre-line text-sm text-ink/80">{description}</p>

        {product.sizes.length > 0 && (
          <Row label={t("sizes")}>{product.sizes.join(" · ")}</Row>
        )}
        {product.colors.length > 0 && (
          <Row label={t("colors")}>{product.colors.join(" · ")}</Row>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-ink py-3 text-center text-sm uppercase tracking-wider text-paper hover:bg-ink/85"
            >
              {t("contactSeller")}
            </a>
          )}
          <FavoriteButton
            productId={product.id}
            initial={initiallyFavorited}
            authenticated={Boolean(clerkId)}
            locale={locale}
          />
        </div>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="mb-1 text-sm">
      <span className="text-xs uppercase tracking-wider text-ink/60">{label}: </span>
      {children}
    </p>
  );
}
