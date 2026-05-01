import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import type { Locale } from "@/lib/i18n/config";
import { SellerAvatar } from "@/components/ui/SellerAvatar";
import { TileBookmark } from "./TileBookmark";
import type { ProductTileData } from "./ProductTile";

// Mobile masonry tile per the design's PinCard: bookmark overlay top-right,
// seller chip overlay bottom-left, title + price below. Aspect ratio is
// supplied per-tile so the masonry can stagger heights.
export function PinCard({
  product,
  locale,
  isFavorited,
  authenticated,
  aspectClass,
}: {
  product: ProductTileData;
  locale: Locale;
  isFavorited: boolean;
  authenticated: boolean;
  aspectClass: string;
}) {
  const cover = product.images[0];
  const title = pickLocalized({ en: product.titleEn, ar: product.titleAr }, locale);

  return (
    <article className="group">
      <div className={`relative w-full ${aspectClass} overflow-hidden rounded-2xl bg-mist`}>
        <Link href={`/products/${product.slug}`} className="block h-full w-full">
          {cover && (
            <Image
              src={cover.url}
              alt={cover.alt ?? title}
              fill
              sizes="(min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          )}
        </Link>

        <TileBookmark
          productId={product.id}
          initial={isFavorited}
          authenticated={authenticated}
          locale={locale}
        />

        {/* Seller chip overlay — avatar + handle on a translucent pill. */}
        <Link
          href={`/sellers/${product.seller.slug}`}
          className="absolute bottom-2 start-2 inline-flex items-center gap-1.5 rounded-full bg-paper/90 py-1 ps-1 pe-2.5 text-[10px] backdrop-blur transition-colors hover:bg-paper"
        >
          <SellerAvatar slug={product.seller.slug} name={product.seller.storeNameEn} size={18} />
          <span className="font-mono text-ink/90">@{product.seller.slug}</span>
        </Link>
      </div>

      <div className="px-1 pt-2">
        <p className="line-clamp-2 text-[12px] leading-tight text-ink">{title}</p>
        <p className="mt-1 font-mono text-[11px] text-ink/55">
          {formatPrice(product.priceMinor, product.currency, locale)}
        </p>
      </div>
    </article>
  );
}
