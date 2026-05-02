import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/adapters/prisma";
import {
  listSellersByStatus,
  approveSeller,
  rejectSeller,
  suspendSeller,
  unsuspendSeller,
  reopenSeller,
} from "@/lib/services/seller";
import { DashboardCard } from "@/components/seller/DashboardCard";
import { StatusTabs } from "@/components/admin/StatusTabs";
import type { SellerStatus } from "@prisma/client";

const STATUSES: SellerStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

export default async function AdminSellersPage({
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

  const t = await getTranslations("admin.sellers");
  const tStatus = await getTranslations("admin.sellers.tabs");

  const requested = typeof sp.status === "string" ? sp.status.toUpperCase() : "PENDING";
  const status = (STATUSES.includes(requested as SellerStatus)
    ? requested
    : "PENDING") as SellerStatus;

  const [counts, rows] = await Promise.all([
    Promise.all(
      STATUSES.map((s) =>
        prisma.sellerProfile
          .count({ where: { status: s } })
          .then((c) => [s, c] as const),
      ),
    ).then((entries) => Object.fromEntries(entries) as Record<SellerStatus, number>),
    listSellersByStatus(status),
  ]);

  async function approve(formData: FormData) {
    "use server";
    const me = await requireAdmin();
    await approveSeller({ adminId: me.id, sellerId: String(formData.get("sellerId")) });
    revalidatePath(`/${locale}/admin/sellers`);
  }
  async function reject(formData: FormData) {
    "use server";
    const me = await requireAdmin();
    await rejectSeller({
      adminId: me.id,
      sellerId: String(formData.get("sellerId")),
      reason: String(formData.get("reason") ?? "") || "Not approved",
    });
    revalidatePath(`/${locale}/admin/sellers`);
  }
  async function suspend(formData: FormData) {
    "use server";
    const me = await requireAdmin();
    await suspendSeller({
      adminId: me.id,
      sellerId: String(formData.get("sellerId")),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath(`/${locale}/admin/sellers`);
  }
  async function unsuspend(formData: FormData) {
    "use server";
    const me = await requireAdmin();
    await unsuspendSeller({ adminId: me.id, sellerId: String(formData.get("sellerId")) });
    revalidatePath(`/${locale}/admin/sellers`);
  }
  async function reopen(formData: FormData) {
    "use server";
    const me = await requireAdmin();
    await reopenSeller({ adminId: me.id, sellerId: String(formData.get("sellerId")) });
    revalidatePath(`/${locale}/admin/sellers`);
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

      <div className="mb-6">
        <StatusTabs<SellerStatus>
          basePath="/admin/sellers"
          active={status}
          tabs={STATUSES.map((s) => ({
            key: s,
            label: tStatus(s),
            count: counts[s],
          }))}
        />
      </div>

      <DashboardCard>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/55">{t("noResults")}</p>
        ) : (
          <ul className="-mx-1 divide-y divide-ink/6">
            {rows.map((seller) => {
              const fmtDate = new Intl.DateTimeFormat(
                locale === "ar" ? "ar" : locale === "fa" ? "fa" : "en",
                { dateStyle: "medium" },
              ).format(seller.createdAt);
              return (
                <li
                  key={seller.id}
                  className="flex flex-wrap items-start gap-4 px-1 py-4 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-ink">{seller.storeNameEn}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {seller.user.email} · {seller.countryCode} · {seller.defaultCurrency} ·{" "}
                      {t("joined")} {fmtDate}
                    </p>
                    {seller.bioEn && (
                      <p className="mt-2 max-w-[60ch] text-sm text-ink/75">{seller.bioEn}</p>
                    )}
                    {seller.rejectionReason && (
                      <p className="mt-2 max-w-[60ch] rounded-lg bg-mist px-3 py-2 font-mono text-[11px] text-ink/65">
                        {seller.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {status === "PENDING" && (
                      <>
                        <form action={approve}>
                          <input type="hidden" name="sellerId" value={seller.id} />
                          <button className="rounded-full bg-ink px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-paper hover:bg-ink/90">
                            {t("actions.approve")}
                          </button>
                        </form>
                        <form action={reject} className="flex gap-1.5">
                          <input type="hidden" name="sellerId" value={seller.id} />
                          <input
                            name="reason"
                            placeholder={t("rejectReason")}
                            className="rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-[11px]"
                          />
                          <button className="rounded-full border border-ink/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink hover:border-ink">
                            {t("actions.reject")}
                          </button>
                        </form>
                      </>
                    )}
                    {status === "APPROVED" && (
                      <form action={suspend} className="flex gap-1.5">
                        <input type="hidden" name="sellerId" value={seller.id} />
                        <input
                          name="reason"
                          placeholder={t("suspendReason")}
                          className="rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-[11px]"
                        />
                        <button className="rounded-full border border-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary hover:bg-primary/10">
                          {t("actions.suspend")}
                        </button>
                      </form>
                    )}
                    {status === "SUSPENDED" && (
                      <form action={unsuspend}>
                        <input type="hidden" name="sellerId" value={seller.id} />
                        <button className="rounded-full bg-ink px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-paper hover:bg-ink/90">
                          {t("actions.unsuspend")}
                        </button>
                      </form>
                    )}
                    {status === "REJECTED" && (
                      <form action={reopen}>
                        <input type="hidden" name="sellerId" value={seller.id} />
                        <button className="rounded-full border border-ink/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink hover:border-ink">
                          {t("actions.reopen")}
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardCard>
    </main>
  );
}
