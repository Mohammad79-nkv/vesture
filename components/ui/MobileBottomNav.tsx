"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import type { ReactNode } from "react";

// Sticky bottom tab bar shown only on mobile. Server components mount this
// once site-wide; the active tab is computed from the next-intl pathname so
// it works for /en, /ar, /fa equally.
export function MobileBottomNav() {
  const t = useTranslations("mobileNav");
  const pathname = usePathname();

  const tabs: { href: "/products" | "/stylist" | "/favorites" | "/dashboard"; label: string; icon: ReactNode; matches: (p: string) => boolean }[] = [
    {
      href: "/products",
      label: t("discover"),
      matches: (p) => p === "/" || p.startsWith("/products") || p.startsWith("/sellers"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
        </svg>
      ),
    },
    {
      href: "/stylist",
      label: t("stylist"),
      matches: (p) => p.startsWith("/stylist"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      ),
    },
    {
      href: "/favorites",
      label: t("saved"),
      matches: (p) => p.startsWith("/favorites"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      href: "/dashboard",
      label: t("me"),
      matches: (p) => p.startsWith("/dashboard") || p.startsWith("/sign-in") || p.startsWith("/sign-up"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-3 bottom-3 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center gap-1 rounded-full bg-[#EAB8E4] p-1.5 text-ink shadow-[0_8px_30px_rgba(33,39,57,0.18)]">
        {tabs.map((tab) => {
          const active = tab.matches(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                active ? "bg-ink text-paper" : "text-ink/70 hover:text-ink",
              ].join(" ")}
            >
              {tab.icon}
              <span className="truncate max-w-full">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
