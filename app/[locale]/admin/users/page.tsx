import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { listUsersAdmin, changeUserRole } from "@/lib/services/admin";
import { DashboardCard } from "@/components/seller/DashboardCard";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["BUYER", "SELLER", "ADMIN"];

export default async function AdminUsersPage({
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

  const t = await getTranslations("admin.users");

  const search = typeof sp.q === "string" ? sp.q : undefined;
  const result = await listUsersAdmin({ search, page: 1, pageSize: 50 });

  async function setRole(formData: FormData) {
    "use server";
    const me = await requireAdmin();
    const targetUserId = String(formData.get("userId"));
    const newRole = String(formData.get("role")) as Role;
    if (!ROLES.includes(newRole)) return;
    await changeUserRole({ adminId: me.id, targetUserId, newRole });
    revalidatePath(`/${locale}/admin/users`);
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

      <form className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder={t("search")}
          className="flex-1 rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        <button className="rounded-full bg-ink px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-paper">
          {t("search")}
        </button>
      </form>

      <DashboardCard>
        {result.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/55">{t("noResults")}</p>
        ) : (
          <ul className="-mx-1 divide-y divide-ink/6">
            {result.items.map((u) => {
              const fmtDate = new Intl.DateTimeFormat(
                locale === "ar" ? "ar" : locale === "fa" ? "fa" : "en",
                { dateStyle: "medium" },
              ).format(u.createdAt);
              return (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center gap-4 px-1 py-3 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{u.email}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {t("joined")} {fmtDate}
                      {u.sellerProfile?.storeNameEn &&
                        ` · ${u.sellerProfile.storeNameEn} (${u.sellerProfile.status})`}
                    </p>
                  </div>

                  <form action={setRole} className="flex shrink-0 items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-[12px]"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-full bg-ink px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-paper hover:bg-ink/90">
                      {t("save")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {t("roleDescription")}
        </p>
      </DashboardCard>
    </main>
  );
}
