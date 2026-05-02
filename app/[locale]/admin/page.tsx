import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminOverviewStats, listRecentAdminActions } from "@/lib/services/admin";
import { Kpi } from "@/components/seller/Kpi";
import { DashboardCard } from "@/components/seller/DashboardCard";

const ACTION_LABELS: Record<string, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  SUSPEND: "Suspended",
  UNSUSPEND: "Restored",
  REOPEN: "Re-opened",
  ARCHIVE: "Archived",
  ROLE_BUYER: "Set role → Buyer",
  ROLE_SELLER: "Set role → Seller",
  ROLE_ADMIN: "Set role → Admin",
};

export default async function AdminOverview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("admin.overview");
  const stats = await adminOverviewStats();
  const recent = await listRecentAdminActions(10);

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

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={t("kpiPendingSellers")}
          value={stats.pendingSellers.toLocaleString()}
          delta={t("kpiPendingDelta")}
          tone={stats.pendingSellers > 0 ? "down" : "neutral"}
        />
        <Kpi
          label={t("kpiApprovedSellers")}
          value={stats.approvedSellers.toLocaleString()}
          tone="up"
        />
        <Kpi
          label={t("kpiLiveProducts")}
          value={stats.liveProducts.toLocaleString()}
        />
        <Kpi
          label={t("kpiTotalUsers")}
          value={stats.totalUsers.toLocaleString()}
        />
      </div>

      <DashboardCard
        title={t("recentActivity")}
        subtitle={t("recentActivitySubtitle")}
      >
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/55">{t("noActivity")}</p>
        ) : (
          <ul className="-mx-1 divide-y divide-ink/6">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-1 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mist font-mono text-[10px] text-ink/55">
                  {a.targetType.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    <span className="font-medium">
                      {ACTION_LABELS[a.action] ?? a.action}
                    </span>{" "}
                    <span className="text-ink/55">·</span>{" "}
                    <span className="font-mono text-[12px] text-ink">
                      {a.targetLabel}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    by {a.adminEmail}
                    {a.reason && ` · ${a.reason}`}
                  </p>
                </div>
                <time className="shrink-0 font-mono text-[11px] text-muted">
                  {new Intl.DateTimeFormat(
                    locale === "ar" ? "ar" : locale === "fa" ? "fa" : "en",
                    { dateStyle: "medium", timeStyle: "short" },
                  ).format(a.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </main>
  );
}
