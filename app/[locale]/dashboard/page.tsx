import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { currentUser } from "@clerk/nextjs/server";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { getSellerByUserId } from "@/lib/services/seller";
import {
  sellerCatalogCounts,
  listSellerRecentPublished,
} from "@/lib/services/product";
import { formatPrice } from "@/lib/domain/money";
import { pickLocalized } from "@/lib/domain/i18n";
import { swatchFor } from "@/lib/domain/swatch";
import { DashboardCard } from "@/components/seller/DashboardCard";
import { Kpi } from "@/components/seller/Kpi";

const PLUS_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const HASH_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);

const SPARKLE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
);

export default async function DashboardHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  const t = await getTranslations("seller.dashboard");

  if (!seller) redirect(`/${locale}/dashboard/onboarding`);

  // Greeting + first name from Clerk profile (fall back to email username).
  const clerkUser = await currentUser();
  const firstName =
    clerkUser?.firstName ??
    clerkUser?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
    "there";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("greetingMorning") : hour < 18 ? t("greetingAfternoon") : t("greetingEvening");

  const dateString = new Intl.DateTimeFormat(locale === "ar" ? "ar" : locale === "fa" ? "fa" : "en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  // Real KPI numbers we actually have. AI / messages / views are placeholders.
  const catalogCounts =
    seller.status === "APPROVED"
      ? await sellerCatalogCounts(seller.id)
      : { published: 0, drafts: 0, pendingReview: 0, addedThisWeek: 0 };

  const recentPublished =
    seller.status === "APPROVED"
      ? await listSellerRecentPublished(seller.id, 4)
      : [];

  return (
    <main className="mx-auto w-full max-w-[1376px] px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {dateString.replace(",", " ·")}
          </p>
          <h1 className="mt-2 text-[44px] font-bold leading-[1] tracking-[-0.03em] text-ink">
            {greeting},{" "}
            <span className="font-light text-primary">{firstName}</span>.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/60"
            title={t("comingSoon")}
          >
            {HASH_ICON}
            {t("botSettings")}
          </button>
          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-paper hover:bg-ink/90"
          >
            {PLUS_ICON}
            {t("addProduct")}
          </Link>
        </div>
      </div>

      {/* Status banner for non-approved sellers */}
      {seller.status === "PENDING" && (
        <div className="mb-6 rounded-2xl border-l-4 border-secondary bg-secondary/10 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-secondary">
            {t("comingSoon")}
          </p>
          <p className="mt-1 text-base font-semibold text-ink">{t("pendingTitle")}</p>
          <p className="mt-1 text-sm text-ink/70">{t("pendingBody")}</p>
        </div>
      )}
      {seller.status === "REJECTED" && (
        <div className="mb-6 rounded-2xl border-l-4 border-primary bg-primary/10 p-5">
          <p className="text-base font-semibold text-ink">{t("rejectedTitle")}</p>
          <p className="mt-1 text-sm text-ink/70">
            {seller.rejectionReason ?? t("rejectedBody")}
          </p>
          <Link
            href="/dashboard/onboarding"
            className="mt-3 inline-flex text-xs font-bold uppercase tracking-[0.08em] text-primary underline-offset-4 hover:underline"
          >
            Edit application →
          </Link>
        </div>
      )}

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={t("kpiCatalog")}
          value={catalogCounts.published.toLocaleString()}
          delta={t("kpiCatalogDelta", { n: catalogCounts.drafts })}
        />
        <Kpi
          label={t("kpiThisWeek")}
          value={catalogCounts.addedThisWeek.toLocaleString()}
          delta={t("kpiThisWeekDelta")}
          tone="up"
        />
        <Kpi
          label={t("kpiAiMatches")}
          value="—"
          delta={t("kpiComingSoon")}
        />
        <Kpi
          label={t("kpiProfileViews")}
          value="—"
          delta={t("kpiComingSoon")}
        />
      </div>

      {/* Main 2-col grid */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* LEFT column */}
        <div className="flex flex-col gap-4">
          <DashboardCard
            title={t("matchPerformance")}
            subtitle={t("matchPerformanceSubtitle")}
          >
            <ComingSoonPlaceholder
              icon={SPARKLE_ICON}
              body={t("comingSoonBody")}
            />
          </DashboardCard>

          <DashboardCard
            title={t("recentlyPublished")}
            subtitle={t("recentlyPublishedSubtitle")}
            action={
              <Link
                href="/dashboard/products"
                className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/55 hover:text-ink"
              >
                {t("manageCatalog")} →
              </Link>
            }
          >
            {recentPublished.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink/55">{t("noProducts")}</p>
            ) : (
              <ul className="-mx-1 divide-y divide-ink/6">
                {recentPublished.map((p) => {
                  const cover = p.images[0];
                  const title = pickLocalized({ en: p.titleEn, ar: p.titleAr }, locale);
                  return (
                    <li key={p.id} className="flex items-center gap-4 px-1 py-3">
                      <div
                        className="relative h-[70px] w-[56px] shrink-0 overflow-hidden rounded-lg"
                        style={{ backgroundColor: swatchFor(p.slug) }}
                      >
                        {cover && (
                          <Image
                            src={cover.url}
                            alt={cover.alt ?? title}
                            fill
                            sizes="56px"
                            className="object-cover mix-blend-multiply"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{title}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted">
                          SKU {p.id.toUpperCase().slice(-6)} · {p.category}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-[12px] text-ink">
                        {formatPrice(p.priceMinor, p.currency, locale)}
                      </p>
                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        aria-label={`Edit ${title}`}
                        className="text-muted hover:text-ink"
                      >
                        →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardCard>

          <DashboardCard
            title={t("topMatches")}
            subtitle={t("topMatchesSubtitle")}
          >
            <ComingSoonPlaceholder
              icon={SPARKLE_ICON}
              body={t("comingSoonBody")}
            />
          </DashboardCard>
        </div>

        {/* RIGHT column */}
        <div className="flex flex-col gap-4">
          <DashboardCard
            tint="ink"
            title={t("stylistTip")}
            subtitle={t("stylistTipSubtitle")}
          >
            <p className="text-[14.5px] leading-[1.5] text-paper/85">
              {t("comingSoonBody")}.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-paper">
              {t("comingSoon")}
            </span>
          </DashboardCard>

          <DashboardCard title={t("inbox")} subtitle={t("inboxSubtitle")}>
            <ComingSoonPlaceholder
              compact
              body={t("comingSoonBody")}
            />
          </DashboardCard>

          <DashboardCard title={t("botHealth")} subtitle={t("botHealthSubtitle")}>
            <ComingSoonPlaceholder
              compact
              body={t("comingSoonBody")}
            />
          </DashboardCard>
        </div>
      </div>
    </main>
  );
}

function ComingSoonPlaceholder({
  body,
  icon,
  compact,
}: {
  body: string;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-2 rounded-xl bg-mist text-center",
        compact ? "py-6" : "py-12",
      ].join(" ")}
    >
      {icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-paper text-primary">
          {icon}
        </span>
      )}
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
        Coming soon
      </p>
      <p className="max-w-[28ch] text-sm text-ink/65">{body}</p>
    </div>
  );
}
