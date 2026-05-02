import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { getSellerByUserId } from "@/lib/services/seller";
import {
  sellerCatalogList,
  sellerCatalogStatusCounts,
} from "@/lib/services/product";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import { swatchFor } from "@/lib/domain/swatch";
import { DashboardCard } from "@/components/seller/DashboardCard";
import { CatalogStatusPill } from "@/components/seller/CatalogStatusPill";
import type { ProductStatus } from "@prisma/client";

const STATUS_TABS: (ProductStatus | "ALL")[] = [
  "ALL",
  "PUBLISHED",
  "PENDING_REVIEW",
  "DRAFT",
  "ARCHIVED",
];

const PLUS_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IG_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="18" cy="6" r="1" fill="currentColor" />
  </svg>
);

const TABLE_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

const GRID_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export default async function SellerCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  if (!seller || seller.status !== "APPROVED") {
    redirect(`/${locale}/dashboard/onboarding`);
  }

  const t = await getTranslations("seller.catalog");

  const status = (
    typeof sp.status === "string" &&
    (STATUS_TABS as readonly string[]).includes(sp.status)
      ? sp.status
      : "ALL"
  ) as ProductStatus | "ALL";
  const view = sp.view === "grid" ? "grid" : "table";
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page) || 1) : 1;

  const [counts, result] = await Promise.all([
    sellerCatalogStatusCounts(seller.id),
    sellerCatalogList({
      sellerId: seller.id,
      status,
      search,
      page,
      pageSize: 25,
    }),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = {
      status: status === "ALL" ? undefined : status,
      view: view === "table" ? undefined : view,
      q: search,
      page: page > 1 ? String(page) : undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/dashboard/products?${qs}` : "/dashboard/products";
  };

  return (
    <main className="mx-auto w-full max-w-[1376px] px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {t("eyebrow", {
              live: counts.PUBLISHED,
              review: counts.PENDING_REVIEW,
            })}
          </p>
          <h1 className="mt-2 text-[44px] font-bold leading-[1] tracking-[-0.03em] text-ink">
            {t("titleLead")}{" "}
            <span className="font-light text-primary">{t("titleAccent")}</span>.
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View toggle */}
          <div className="flex rounded-full border border-ink/10 bg-paper p-1">
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={buildHref({ view: undefined }) as any}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium",
                view === "table" ? "bg-ink text-paper" : "text-ink/65 hover:text-ink",
              ].join(" ")}
            >
              {TABLE_ICON} {t("viewTable")}
            </Link>
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={buildHref({ view: "grid" }) as any}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium",
                view === "grid" ? "bg-ink text-paper" : "text-ink/65 hover:text-ink",
              ].join(" ")}
            >
              {GRID_ICON} {t("viewGrid")}
            </Link>
          </div>

          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/55"
          >
            {IG_ICON} {t("importFromIg")}
          </button>

          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-paper hover:bg-ink/90"
          >
            {PLUS_ICON} {t("newProduct")}
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => {
          const isActive = s === status;
          const count = counts[s];
          return (
            <Link
              key={s}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={buildHref({ status: s === "ALL" ? undefined : s, page: undefined }) as any}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-paper text-ink hover:border-ink/40",
              ].join(" ")}
            >
              <span>{t(`tabs.${s}`)}</span>
              <span
                className={[
                  "rounded-full px-1.5 font-mono text-[10px]",
                  isActive ? "bg-paper/15 text-paper" : "bg-mist text-ink/55",
                ].join(" ")}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Search bar */}
      <form className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder={t("search")}
          className="flex-1 rounded-full border border-ink/10 bg-paper px-5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        {status !== "ALL" && <input type="hidden" name="status" value={status} />}
        {view !== "table" && <input type="hidden" name="view" value={view} />}
        <button className="rounded-full bg-ink px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-paper">
          {t("search")}
        </button>
      </form>

      {/* List body */}
      {result.items.length === 0 ? (
        <DashboardCard>
          <p className="py-12 text-center text-sm text-ink/60">{t("empty")}</p>
        </DashboardCard>
      ) : view === "table" ? (
        <CatalogTable
          items={result.items}
          locale={locale}
          headers={{
            product: t("tableHeaders.product"),
            status: t("tableHeaders.status"),
            source: t("tableHeaders.source"),
            aiMatches: t("tableHeaders.aiMatches"),
            price: t("tableHeaders.price"),
          }}
          statusLabels={{
            PUBLISHED: t("statusLabels.PUBLISHED"),
            PENDING_REVIEW: t("statusLabels.PENDING_REVIEW"),
            DRAFT: t("statusLabels.DRAFT"),
            ARCHIVED: t("statusLabels.ARCHIVED"),
            REJECTED: t("statusLabels.REJECTED"),
          }}
          sourceLabel={t("sourceManual")}
        />
      ) : (
        <CatalogGrid items={result.items} locale={locale} />
      )}

      {/* Pagination */}
      {result.pageCount > 1 && (
        <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-muted">
          {page > 1 ? (
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={buildHref({ page: String(page - 1) }) as any}
              className="hover:text-ink"
            >
              ← prev
            </Link>
          ) : (
            <span />
          )}
          <span>
            {page} / {result.pageCount}
          </span>
          {page < result.pageCount ? (
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={buildHref({ page: String(page + 1) }) as any}
              className="hover:text-ink"
            >
              next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}

// ─── Table view ─────────────────────────────────────────────────────────

type TableProduct = Awaited<ReturnType<typeof sellerCatalogList>>["items"][number];

function CatalogTable({
  items,
  locale,
  headers,
  statusLabels,
  sourceLabel,
}: {
  items: TableProduct[];
  locale: string;
  headers: { product: string; status: string; source: string; aiMatches: string; price: string };
  statusLabels: Record<ProductStatus, string>;
  sourceLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/6 bg-paper">
      <div className="grid grid-cols-[64px_2fr_1fr_1fr_1fr_1fr_40px] items-center gap-4 bg-mist px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        <span />
        <span>{headers.product}</span>
        <span>{headers.status}</span>
        <span>{headers.source}</span>
        <span>{headers.aiMatches}</span>
        <span>{headers.price}</span>
        <span />
      </div>
      <ul>
        {items.map((p) => (
          <li
            key={p.id}
            className="grid grid-cols-[64px_2fr_1fr_1fr_1fr_1fr_40px] items-center gap-4 border-t border-ink/6 px-5 py-3"
          >
            <div
              className="relative h-[58px] w-[46px] overflow-hidden rounded-md"
              style={{ backgroundColor: swatchFor(p.slug) }}
            >
              {p.images[0] && (
                <Image
                  src={p.images[0].url}
                  alt=""
                  fill
                  sizes="46px"
                  className="object-cover mix-blend-multiply"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">
                {pickLocalized({ en: p.titleEn, ar: p.titleAr }, locale as never)}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                SKU {p.id.slice(-6).toUpperCase()} · {p.category}
              </p>
            </div>
            <CatalogStatusPill status={p.status} label={statusLabels[p.status]} />
            <span className="font-mono text-[11px] text-ink/65">{sourceLabel}</span>
            <span className="font-mono text-[11px] text-muted">—</span>
            <span className="font-mono text-[12px] text-ink">
              {formatPrice(p.priceMinor, p.currency, locale as never)}
            </span>
            <Link
              href={`/dashboard/products/${p.id}/edit`}
              aria-label="Edit product"
              className="justify-self-end text-ink/55 hover:text-ink"
            >
              →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Grid view ──────────────────────────────────────────────────────────

function CatalogGrid({
  items,
  locale,
}: {
  items: TableProduct[];
  locale: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((p) => (
        <Link
          key={p.id}
          href={`/dashboard/products/${p.id}/edit`}
          className="group overflow-hidden rounded-2xl border border-ink/6 bg-paper transition-shadow hover:shadow-[0_4px_24px_rgba(33,39,57,0.06)]"
        >
          <div
            className="relative aspect-[3/4] w-full overflow-hidden"
            style={{ backgroundColor: swatchFor(p.slug) }}
          >
            {p.images[0] && (
              <Image
                src={p.images[0].url}
                alt=""
                fill
                sizes="(min-width: 1280px) 18vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.02]"
              />
            )}
          </div>
          <div className="space-y-1 p-3">
            <p className="truncate text-[12.5px] font-semibold text-ink">
              {pickLocalized({ en: p.titleEn, ar: p.titleAr }, locale as never)}
            </p>
            <p className="font-mono text-[11px] text-muted">
              {formatPrice(p.priceMinor, p.currency, locale as never)} · {p.status}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
