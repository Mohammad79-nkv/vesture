"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";

type Tab = {
  href: "/admin" | "/admin/sellers" | "/admin/products" | "/admin/users" | "/admin/audit";
  key: "overview" | "sellers" | "products" | "users" | "audit";
};

const TABS: Tab[] = [
  { href: "/admin", key: "overview" },
  { href: "/admin/sellers", key: "sellers" },
  { href: "/admin/products", key: "products" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/audit", key: "audit" },
];

export function AdminNavTabs() {
  const t = useTranslations("admin.topBar");
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-6 lg:flex">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/admin"
            ? pathname === "/admin"
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
          </Link>
        );
      })}
    </nav>
  );
}
