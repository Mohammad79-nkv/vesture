"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";

type Tab = {
  href: "/dashboard" | "/dashboard/products" | "/dashboard/bot" | "/dashboard/inbox" | "/dashboard/insights";
  key: "dashboard" | "catalog" | "bot" | "inbox" | "insights";
  comingSoon?: boolean;
};

const TABS: Tab[] = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/dashboard/products", key: "catalog" },
  { href: "/dashboard/bot", key: "bot", comingSoon: true },
  { href: "/dashboard/inbox", key: "inbox", comingSoon: true },
  { href: "/dashboard/insights", key: "insights", comingSoon: true },
];

export function SellerNavTabs() {
  const t = useTranslations("seller.topBar");
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-6 lg:flex">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "border-b border-transparent pb-0.5 text-[13px] font-medium transition-colors",
              isActive ? "border-ink text-ink" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {t(tab.key)}
            {tab.comingSoon && (
              <span className="ms-1 align-middle text-[9px] uppercase tracking-[0.1em] text-muted">
                · soon
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
