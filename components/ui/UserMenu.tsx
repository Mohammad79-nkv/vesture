"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { LogOut, LayoutDashboard, ShieldCheck, Heart } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

type Role = "BUYER" | "SELLER" | "ADMIN";

// Avatar trigger + dropdown panel containing role-aware destinations and a
// sign-out button. Closes on outside click, Escape, or any item click.
// `signOut({ redirectUrl: "/" })` lands the user back on the welcome hero.
export function UserMenu({
  role,
  initial,
  email,
  variant = "light",
}: {
  role: Role;
  initial: string;
  email?: string | null;
  variant?: "light" | "dark";
}) {
  const t = useTranslations("userMenu");
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerCls =
    variant === "dark"
      ? "bg-paper/10 text-paper hover:bg-paper/15 border-paper/15"
      : "bg-primary text-paper hover:bg-primary/90 border-transparent";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-9 w-9 place-items-center rounded-full border text-[13px] font-bold uppercase tracking-[0.04em] transition-colors ${triggerCls}`}
      >
        {initial || "·"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-ink/8 bg-paper text-ink shadow-[0_24px_60px_rgba(33,39,57,0.18)]"
        >
          {email && (
            <div className="border-b border-ink/8 px-4 py-3">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/50">
                {t("signedInAs")}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] font-medium text-ink">
                {email}
              </p>
            </div>
          )}

          <div className="flex flex-col py-1.5">
            {role === "ADMIN" ? (
              <Item
                href="/admin/sellers"
                Icon={ShieldCheck}
                label={t("admin")}
                onSelect={() => setOpen(false)}
              />
            ) : (
              <Item
                href="/dashboard"
                Icon={LayoutDashboard}
                label={t("dashboard")}
                onSelect={() => setOpen(false)}
              />
            )}
            <Item
              href="/favorites"
              Icon={Heart}
              label={t("favorites")}
              onSelect={() => setOpen(false)}
            />
          </div>

          <div className="border-t border-ink/8 py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut({ redirectUrl: "/" });
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium text-ink hover:bg-mist"
            >
              <LogOut size={15} aria-hidden="true" />
              {t("signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({
  href,
  Icon,
  label,
  onSelect,
}: {
  href: "/dashboard" | "/admin/sellers" | "/favorites";
  Icon: typeof LogOut;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-ink hover:bg-mist"
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </Link>
  );
}
