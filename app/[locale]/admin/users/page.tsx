import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { ChevronRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireAdmin } from "@/lib/auth";
import {
  listUsersAdmin,
  changeUserRole,
  deleteUserAdmin,
  AdminUserDeleteError,
} from "@/lib/services/admin";
import { DashboardCard } from "@/components/seller/DashboardCard";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["BUYER", "SELLER", "ADMIN"];

const ERROR_KEY: Record<AdminUserDeleteError["code"], string> = {
  SELF: "errorSelf",
  IS_ADMIN: "errorIsAdmin",
  CLERK_FAILED: "errorClerk",
  DB_FAILED: "errorDb",
  NOT_FOUND: "noResults",
};

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
  const tDetail = await getTranslations("admin.userDetail");

  const search = typeof sp.q === "string" ? sp.q : undefined;
  const errorCode = typeof sp.error === "string" ? sp.error : undefined;
  const me = await requireAdmin();
  const result = await listUsersAdmin({ search, page: 1, pageSize: 50 });

  async function setRole(formData: FormData) {
    "use server";
    const actor = await requireAdmin();
    const targetUserId = String(formData.get("userId"));
    const newRole = String(formData.get("role")) as Role;
    if (!ROLES.includes(newRole)) return;
    await changeUserRole({ adminId: actor.id, targetUserId, newRole });
    revalidatePath(`/${locale}/admin/users`);
  }

  async function deleteUser(formData: FormData) {
    "use server";
    const actor = await requireAdmin();
    const targetUserId = String(formData.get("userId"));
    try {
      await deleteUserAdmin({ adminId: actor.id, targetUserId });
    } catch (err) {
      if (err instanceof AdminUserDeleteError) {
        // Surface the error code via the URL so the page can show a banner
        // after the redirect — server actions can't return values to the
        // form natively without useFormState scaffolding.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        redirect(`/${locale}/admin/users?error=${err.code}` as any);
      }
      throw err;
    }
    revalidatePath(`/${locale}/admin/users`);
  }

  const errorMessage =
    errorCode && errorCode in ERROR_KEY
      ? t(ERROR_KEY[errorCode as AdminUserDeleteError["code"]])
      : null;

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

      {errorMessage && (
        <div
          role="alert"
          className="mb-5 rounded-2xl bg-red-50 px-5 py-3 text-[13px] text-red-700"
        >
          {errorMessage}
        </div>
      )}

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
              const isSelf = u.id === me.id;
              const isAdminRow = u.role === "ADMIN";
              const deleteFormId = `delete-user-${u.id}`;
              const disabledReason = isSelf
                ? t("errorSelf")
                : isAdminRow
                ? t("errorIsAdmin")
                : undefined;

              return (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center gap-4 px-1 py-3 sm:flex-nowrap"
                >
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    href={(`/admin/users/${u.id}` as any)}
                    className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 hover:bg-ink/[0.04]"
                    aria-label={`${tDetail("view")} ${u.email}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{u.email}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        {t("joined")} {fmtDate}
                        {u.sellerProfile?.storeNameEn &&
                          ` · ${u.sellerProfile.storeNameEn} (${u.sellerProfile.status})`}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-ink/30 transition-colors group-hover:text-ink/60"
                      aria-hidden="true"
                    />
                  </Link>

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

                  <form id={deleteFormId} action={deleteUser} className="shrink-0">
                    <input type="hidden" name="userId" value={u.id} />
                    <DeleteUserButton
                      formId={deleteFormId}
                      disabledReason={disabledReason}
                    />
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {t("roleDescription")} · {t("deleteHint")}
        </p>
      </DashboardCard>
    </main>
  );
}
