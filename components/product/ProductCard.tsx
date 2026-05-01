import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import type { Locale } from "@/lib/i18n/config";

export type ProductCardData = {
  slug: string;
  titleEn: string;
  titleAr: string | null;
  priceMinor: number;
  currency: string;
  images: { url: string; alt: string | null }[];
  seller: { slug: string; storeNameEn: string; storeNameAr: string | null };
};

export function ProductCard({
  product,
  locale,
}: {
  product: ProductCardData;
  locale: Locale;
}) {
  const cover = product.images[0];
  const title = pickLocalized({ en: product.titleEn, ar: product.titleAr }, locale);
  const store = pickLocalized(
    { en: product.seller.storeNameEn, ar: product.seller.storeNameAr },
    locale,
  );

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-mist">
        {cover && (
          <Image
            src={cover.url}
            alt={cover.alt ?? title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs uppercase tracking-wider text-ink/60">{store}</p>
        <h3 className="text-sm">{title}</h3>
        <p className="text-sm font-medium">
          {formatPrice(product.priceMinor, product.currency, locale)}
        </p>
      </div>
    </Link>
  );
}
