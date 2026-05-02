import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { listAuditLog } from "@/lib/services/admin";
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

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("admin.audit");
  const { items } = await listAuditLog({ skip: 0, take: 100 });

  const fmt = new Intl.DateTimeFormat(
    locale === "ar" ? "ar" : locale === "fa" ? "fa" : "en",
    { dateStyle: "medium", timeStyle: "short" },
  );

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

      <DashboardCard>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/55">{t("noResults")}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  <th className="px-2 py-3 font-medium">{t("headers.when")}</th>
                  <th className="px-2 py-3 font-medium">{t("headers.admin")}</th>
                  <th className="px-2 py-3 font-medium">{t("headers.action")}</th>
                  <th className="px-2 py-3 font-medium">{t("headers.target")}</th>
                  <th className="px-2 py-3 font-medium">{t("headers.reason")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-b border-ink/6 align-top text-sm">
                    <td className="px-2 py-3 font-mono text-[11px] text-muted">
                      {fmt.format(a.createdAt)}
                    </td>
                    <td className="px-2 py-3 font-mono text-[12px] text-ink">
                      {a.adminEmail}
                    </td>
                    <td className="px-2 py-3 text-ink">
                      {ACTION_LABELS[a.action] ?? a.action}
                    </td>
                    <td className="px-2 py-3">
                      <p className="text-ink">{a.targetLabel}</p>
                      <p className="font-mono text-[10px] text-muted">{a.targetType}</p>
                    </td>
                    <td className="px-2 py-3 text-sm text-ink/70">
                      {a.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>
    </main>
  );
}
