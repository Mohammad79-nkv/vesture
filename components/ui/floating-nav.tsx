"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Sparkles, Bookmark, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";

// Vesture-flavored adaptation of the FloatingNav pattern. Keeps the brand
// pink container + ink active pill, swaps the demo's local toggle state for
// real path-aware active detection via next-intl's pathname helper, and
// replaces the demo's 7-item content with our 4 tabs.
//
// Hides on product detail pages — those render their own sticky message
// footer that takes the bottom slot.
export function FloatingNav() {
  const t = useTranslations("mobileNav");
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ width: 0, left: 0 });

  const tabs = [
    {
      href: "/products" as const,
      Icon: Compass,
      label: t("discover"),
      matches: (p: string) =>
        p === "/" || p.startsWith("/products") || p.startsWith("/sellers"),
    },
    {
      href: "/stylist" as const,
      Icon: Sparkles,
      label: t("stylist"),
      matches: (p: string) => p.startsWith("/stylist"),
    },
    {
      href: "/favorites" as const,
      Icon: Bookmark,
      label: t("saved"),
      matches: (p: string) => p.startsWith("/favorites"),
    },
    {
      href: "/dashboard" as const,
      Icon: User,
      label: t("me"),
      matches: (p: string) =>
        p.startsWith("/dashboard") ||
        p.startsWith("/admin") ||
        p.startsWith("/sign-in") ||
        p.startsWith("/sign-up"),
    },
  ];

  // Default to the first tab when the path doesn't match any (e.g. /about);
  // this keeps the indicator from disappearing on edge routes.
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.matches(pathname)));

  // Recompute indicator position whenever the active tab changes (route nav)
  // or the viewport resizes. RAF wait so refs are populated on first mount.
  useEffect(() => {
    const update = () => {
      const btn = tabRefs.current[activeIndex];
      const container = containerRef.current;
      if (!btn || !container) return;
      const btnRect = btn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({
        width: btnRect.width,
        left: btnRect.left - containerRect.left,
      });
    };
    requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeIndex]);

  // Hide on product detail pages where a sticky message footer takes over.
  if (/^\/products\/[^/]+$/.test(pathname)) return null;

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-3 bottom-3 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        ref={containerRef}
        className="relative flex items-center gap-1 rounded-full bg-[#EAB8E4] p-1.5 shadow-[0_8px_30px_rgba(33,39,57,0.18)]"
      >
        {/* Animated active pill — slides + resizes to the matched tab */}
        <motion.div
          aria-hidden="true"
          animate={indicator}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="absolute top-1.5 bottom-1.5 rounded-full bg-ink"
        />

        {tabs.map((tab, i) => {
          const Icon = tab.Icon;
          const isActive = i === activeIndex;
          return (
            <Link
              key={tab.href}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                isActive ? "text-paper" : "text-ink/70 hover:text-ink",
              ].join(" ")}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
              <span className="truncate max-w-full">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default FloatingNav;
