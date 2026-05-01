import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { Link } from "@/lib/i18n/navigation";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { prisma } from "@/lib/adapters/prisma";

async function fetchRole(): Promise<"SELLER" | "ADMIN" | "BUYER" | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });
  return dbUser?.role ?? "BUYER";
}

export async function Nav() {
  const t = await getTranslations("nav");
  const tMobile = await getTranslations("mobileNav");
  const role = await fetchRole();

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
        <Link
          href="/"
          className="shrink-0 font-display text-xl italic tracking-[0.18em] lg:font-sans lg:not-italic lg:font-extrabold"
        >
          VESTURE
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-ink/70 lg:flex">
          <Link href="/products" className="hover:text-ink">{t("discover")}</Link>
          <Link href="/products" className="hover:text-ink">{t("sellers")}</Link>
          <span className="cursor-not-allowed opacity-50">{t("editorial")}</span>
          <Link href="/products" className="font-semibold text-ink underline-offset-4 hover:underline">
            {t("howItWorks")}
          </Link>
        </nav>

        <SearchBar placeholder={t("search")} />

        {/* Mobile: search + bookmark icon buttons */}
        <div className="ms-auto flex items-center gap-2 lg:hidden">
          <Link
            href="/products"
            aria-label={tMobile("search")}
            className="grid h-10 w-10 place-items-center rounded-full bg-mist text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
          <Link
            href="/favorites"
            aria-label={tMobile("favorites")}
            className="grid h-10 w-10 place-items-center rounded-full bg-mist text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </Link>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <LocaleSwitcher />
          <Link
            href="/dashboard"
            className="rounded-full border border-ink px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ink hover:bg-ink hover:text-paper"
          >
            {t("sellOnVesture")}
          </Link>
          {role === null ? (
            <Link
              href="/sign-in"
              className="rounded-full bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider text-paper hover:bg-primary/90"
            >
              {t("signIn")}
            </Link>
          ) : (
            <Link
              href={role === "ADMIN" ? "/admin/sellers" : "/dashboard"}
              className="rounded-full bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider text-paper hover:bg-primary/90"
            >
              {role === "ADMIN" ? t("admin") : t("dashboard")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="hidden flex-1 items-center lg:flex">
      <div className="flex w-full items-center gap-2 rounded-full bg-mist px-4 py-2 text-sm text-ink/60">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          disabled
          placeholder={placeholder}
          className="flex-1 bg-transparent placeholder:text-ink/45 focus:outline-none disabled:cursor-not-allowed"
        />
        <kbd className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
