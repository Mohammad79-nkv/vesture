import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { ProductTile, type ProductTileData } from "@/components/product/ProductTile";
import { pickLocalized } from "@/lib/domain/i18n";
import type { Locale } from "@/lib/i18n/config";

export async function MoreFromSeller({
  locale,
  authenticated,
  favoritedIds,
  seller,
  products,
  totalPublished,
}: {
  locale: Locale;
  authenticated: boolean;
  favoritedIds: Set<string>;
  seller: { slug: string; storeNameEn: string; storeNameAr: string | null };
  products: ProductTileData[];
  totalPublished: number;
}) {
  const t = await getTranslations("product");
  if (products.length === 0) return null;

  const storeName = pickLocalized(
    { en: seller.storeNameEn, ar: seller.storeNameAr },
    locale,
  );

  return (
    <section className="mt-16">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-ink/55">
        {t("moreFrom")} @{seller.slug}
      </p>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {t("otherPiecesBy")} <span className="text-primary">{storeName}</span>
        </h2>
        {totalPublished > products.length && (
          <Link
            href={`/sellers/${seller.slug}`}
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink hover:text-primary"
          >
            {t("viewAll", { n: totalPublished })} →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
        {products.map((p) => (
          <ProductTile
            key={p.id}
            product={p}
            locale={locale}
            isFavorited={favoritedIds.has(p.id)}
            authenticated={authenticated}
          />
        ))}
      </div>
    </section>
  );
}
