"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/lib/i18n/navigation";

type ChipKey =
  | "forYou"
  | "newIn"
  | "tehran"
  | "knits"
  | "tailored"
  | "accessories"
  | "underBudget";

// Each chip maps to a query string. `null` chips are visual placeholders that
// keep the design intent visible without claiming to filter when we have no
// underlying data (e.g. seller city).
const CHIPS: { key: ChipKey; query: URLSearchParamsInit | null }[] = [
  { key: "forYou", query: {} },
  { key: "newIn", query: { sort: "newest" } },
  { key: "tehran", query: null },
  { key: "knits", query: { category: "TOPS" } },
  { key: "tailored", query: { category: "OUTERWEAR" } },
  { key: "accessories", query: { category: "ACCESSORIES" } },
  { key: "underBudget", query: { maxPrice: "200000000" } }, // 2M in 2-decimal minor units
];

type URLSearchParamsInit = Record<string, string>;

export function CatalogChips() {
  const t = useTranslations("catalog.chips");
  const params = useSearchParams();
  const activeKey = computeActive(params);

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide md:flex-wrap">
      {CHIPS.map((chip) => {
        const isActive = activeKey === chip.key;
        const isInert = chip.query === null;
        const href = chip.query ? buildHref(chip.query) : "/products";
        return (
          <Link
            key={chip.key}
            href={href}
            aria-disabled={isInert}
            tabIndex={isInert ? -1 : undefined}
            className={[
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
              isActive
                ? "border-ink bg-ink text-paper"
                : "border-ink/15 bg-paper text-ink hover:border-ink/40",
              isInert ? "cursor-not-allowed opacity-50" : "",
            ].join(" ")}
          >
            {t(chip.key)}
          </Link>
        );
      })}
    </div>
  );
}

function buildHref(query: URLSearchParamsInit): string {
  const search = new URLSearchParams(query).toString();
  return search ? `/products?${search}` : "/products";
}

function computeActive(params: URLSearchParams): ChipKey | null {
  const category = params.get("category");
  const maxPrice = params.get("maxPrice");
  const sort = params.get("sort");
  const hasAny = params.size > 0;

  if (sort === "newest") return "newIn";
  if (category === "TOPS") return "knits";
  if (category === "OUTERWEAR") return "tailored";
  if (category === "ACCESSORIES") return "accessories";
  if (maxPrice === "200000000") return "underBudget";
  return hasAny ? null : "forYou";
}
