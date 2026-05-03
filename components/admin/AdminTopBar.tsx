import { getTranslations } from "next-intl/server";
import { currentUser } from "@clerk/nextjs/server";
import { Link } from "@/lib/i18n/navigation";
import { UserMenu } from "@/components/ui/UserMenu";
import { AdminNavTabs } from "./AdminNavTabs";

// Sticky white top bar for the admin workspace. Mirrors SellerTopBar but
// with a dark "Admin" chip and admin-scoped nav. The avatar trigger opens a
// menu containing sign-out.
export async function AdminTopBar() {
  const t = await getTranslations("admin.topBar");
  const tBrand = await getTranslations("brand");
  const me = await currentUser();
  const email = me?.emailAddresses?.[0]?.emailAddress ?? "—";
  const initial = (me?.firstName?.[0] ?? email[0] ?? "A").toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-ink/8 bg-paper">
      <div className="mx-auto flex h-16 max-w-[1376px] items-center gap-7 px-8">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="text-[15px] font-extrabold tracking-[0.32em] text-ink">
            {tBrand("name").toUpperCase()}
          </span>
          <span className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-paper">
            {t("adminChip")}
          </span>
        </Link>

        <AdminNavTabs />

        <div className="ms-auto flex items-center gap-3">
          <UserMenu
            role="ADMIN"
            initial={initial}
            email={email}
            trigger={
              <div className="flex items-center gap-2 rounded-full bg-mist px-3 py-1.5 hover:bg-ink/5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full bg-secondary"
                />
                <span className="hidden font-mono text-[11px] text-ink/65 md:inline">
                  {email}
                </span>
                <span className="font-mono text-[11px] font-semibold text-ink md:hidden">
                  {initial}
                </span>
              </div>
            }
          />
        </div>
      </div>
    </header>
  );
}
