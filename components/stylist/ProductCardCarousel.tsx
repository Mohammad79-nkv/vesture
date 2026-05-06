"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { ProductSearchResult } from "@/lib/ai/tools";

// Horizontal-scroll list of product cards rendered under an assistant
// message when a tool_result event arrives. Tapping a card goes to the
// existing /products/[slug] detail page — same surface as the catalog,
// no parallel UI to maintain.

export function ProductCardCarousel({ products }: { products: ProductSearchResult[] }) {
  const t = useTranslations("stylist.chat");

  if (products.length === 0) return null;

  return (
    <div className="-mx-4 px-4">
      <ul
        className="scrollbar-hide -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1"
        // padding-end here gives the last card breathing room when scrolled
        // to the very end on iOS Safari, which crops differently than other
        // browsers without it.
        style={{ paddingInlineEnd: 16 }}
      >
        {products.map((p) => (
          <li
            key={p.id}
            className="snap-start"
            style={{ flex: "0 0 160px" }}
          >
            <ProductMiniCard product={p} viewLabel={t("viewProduct")} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductMiniCard({
  product,
  viewLabel,
}: {
  product: ProductSearchResult;
  viewLabel: string;
}) {
  // Locale-aware price formatting. Currency comes from the product row
  // (each product priced in its seller's currency, no FX conversion).
  const price = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: product.currency,
    maximumFractionDigits: 0,
  }).format(product.priceMinor / 100);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-2xl bg-paper shadow-[0_1px_2px_rgba(33,39,57,0.04)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-mist">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.titleEn}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-ink/[0.06]" />
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[12px] font-semibold leading-tight text-ink">
          {product.titleEn}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-ink/55">
          {product.sellerNameEn}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[12px] font-bold tracking-[-0.01em] text-ink">
            {price}
          </span>
          <span className="inline-flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-primary">
            {viewLabel}
            <ArrowRight size={10} strokeWidth={2.2} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
