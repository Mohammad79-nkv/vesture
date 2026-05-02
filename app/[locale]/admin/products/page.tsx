import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/config";
import { Link } from "@/lib/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import { listProductsAdmin, forceArchiveProduct } from "@/lib/services/admin";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import { swatchFor } from "@/lib/domain/swatch";
import { DashboardCard } from "@/components/seller/DashboardCard";
import { StatusTabs } from "@/components/admin/StatusTabs";
import type { ProductStatus } from "@prisma/client";

const STATUS_OPTIONS = ["ALL", "PUBLISHED", "DRAFT", "PENDING_REVIEW", "ARCHIVED", "REJECTED"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

export default async function AdminProductsPage({
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

  const t = await getTranslations("admin.products");

  const search = typeof sp.q === "string" ? sp.q : undefined;
  const requestedStatus =
    typeof sp.status === "string" && (STATUS_OPTIONS as readonly string[]).includes(sp.status)
      ? (sp.status as StatusFilter)
      : "ALL";
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page) || 1) : 1;

  const result = await listProductsAdmin({
    search,
    status:
      requestedStatus === "ALL" ? "ALL" : (requestedStatus as ProductStatus),
    page,
    pageSize: 20,
  });

  async function archive(formData: FormData) {
    "use server";
    const me = await requireAdmin();
    await forceArchiveProduct({
      adminId: me.id,
      productId: String(formData.get("productId")),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath(`/${locale}/admin/products`);
  }

  return (
    <main className="mx-auto w-full max-w-[1376px] px-6 py-8 sm:px-8 sm:py-10">
      <div className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {t("subtitle")}
        </p>
        <h1 className="mt-2 text-[44px] font-bold leading-[1] tracking-[-0.03em] text-ink">
          {t("title")}
        </h1>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder={t("search")}
          className="flex-1 rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        {requestedStatus !== "ALL" && (
          <input type="hidden" name="status" value={requestedStatus} />
        )}
        <button className="rounded-full bg-ink px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-paper">
          {t("search")}
        </button>
      </form>

      <div className="mb-4">
        <StatusTabs<StatusFilter>
          basePath="/admin/products"
          active={requestedStatus}
          tabs={STATUS_OPTIONS.map((s) => ({
            key: s,
            label: t(`byStatus.${s === "ALL" ? "all" : s}`),
          }))}
        />
      </div>

      <DashboardCard>
        {result.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/55">{t("noResults")}</p>
        ) : (
          <ul className="-mx-1 divide-y divide-ink/6">
            {result.items.map((p) => {
              const cover = p.images[0];
              const title = pickLocalized({ en: p.titleEn, ar: p.titleAr }, locale);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-4 px-1 py-3 sm:flex-nowrap"
                >
                  <div
                    className="relative h-[70px] w-[56px] shrink-0 overflow-hidden rounded-lg"
                    style={{ backgroundColor: swatchFor(p.slug) }}
                  >
                    {cover && (
                      <Image
                        src={cover.url}
                        alt={title}
                        fill
                        sizes="56px"
                        className="object-cover mix-blend-multiply"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      @{p.seller.slug} · {p.category} · {p.status}
                    </p>
                  </div>

                  <p className="shrink-0 font-mono text-[12px] text-ink">
                    {formatPrice(p.priceMinor, p.currency, locale)}
                  </p>

                  <Link
                    href={`/products/${p.slug}`}
                    className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-ink/55 hover:text-ink"
                  >
                    {t("viewLive")} →
                  </Link>

                  {p.status !== "ARCHIVED" && (
                    <form action={archive} className="flex shrink-0 gap-1.5">
                      <input type="hidden" name="productId" value={p.id} />
                      <input
                        name="reason"
                        placeholder={t("archiveReason")}
                        className="w-32 rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-[11px]"
                      />
                      <button className="rounded-full border border-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary hover:bg-primary/10">
                        {t("archive")}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {result.pageCount > 1 && (
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            search={search}
            status={requestedStatus}
          />
        )}
      </DashboardCard>
    </main>
  );
}

function Pagination({
  page,
  pageCount,
  search,
  status,
}: {
  page: number;
  pageCount: number;
  search?: string;
  status: StatusFilter;
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status !== "ALL") params.set("status", status);
    params.set("page", String(p));
    return `/admin/products?${params.toString()}`;
  };
  return (
    <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-muted">
      {page > 1 ? (
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={buildHref(page - 1) as any}
          className="hover:text-ink"
        >
          ← prev
        </Link>
      ) : (
        <span />
      )}
      <span>
        {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={buildHref(page + 1) as any}
          className="hover:text-ink"
        >
          next →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
