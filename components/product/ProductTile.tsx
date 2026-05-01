import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import { swatchFor } from "@/lib/domain/swatch";
import type { Locale } from "@/lib/i18n/config";
import { SellerAvatar } from "@/components/ui/SellerAvatar";
import { TileBookmark } from "./TileBookmark";

export type ProductTileData = {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string | null;
  priceMinor: number;
  currency: string;
  images: { url: string; alt: string | null }[];
  seller: { slug: string; storeNameEn: string; storeNameAr: string | null };
};

export function ProductTile({
  product,
  locale,
  isFavorited,
  authenticated,
}: {
  product: ProductTileData;
  locale: Locale;
  isFavorited: boolean;
  authenticated: boolean;
}) {
  const cover = product.images[0];
  const title = pickLocalized({ en: product.titleEn, ar: product.titleAr }, locale);
  const store = pickLocalized(
    { en: product.seller.storeNameEn, ar: product.seller.storeNameAr },
    locale,
  );

  return (
    <div className="group relative">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[3/4] overflow-hidden rounded-2xl"
        style={{ backgroundColor: swatchFor(product.slug) }}
      >
        {cover && (
          <Image
            src={cover.url}
            alt={cover.alt ?? title}
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.02]"
          />
        )}
      </Link>
      <TileBookmark
        productId={product.id}
        initial={isFavorited}
        authenticated={authenticated}
        locale={locale}
      />
      <div className="mt-3 flex items-start gap-2">
        <SellerAvatar slug={product.seller.slug} name={product.seller.storeNameEn} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink/55">@{product.seller.slug}</p>
          <p className="mt-0.5 truncate text-sm text-ink">{title}</p>
          <p className="mt-0.5 text-xs text-ink/55">
            {formatPrice(product.priceMinor, product.currency, locale)}
          </p>
          <span className="sr-only">{store}</span>
        </div>
      </div>
    </div>
  );
}
