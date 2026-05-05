"use client";

import { useState, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";

// Confirm-on-tap sign out used at the bottom of /me. The first tap arms the
// destructive style, the second actually signs out. Keeps a wayward thumb
// from logging the user out by accident on a tightly packed mobile list.
export function SignOutRow() {
  const t = useTranslations("me");
  const { signOut } = useClerk();
  const [arming, setArming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!arming) {
      setArming(true);
      // Auto-disarm after 4s so the row doesn't sit in a "Confirm?" state
      // forever if the user wandered away.
      setTimeout(() => setArming(false), 4000);
      return;
    }
    startTransition(() => {
      void signOut({ redirectUrl: "/" });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={[
        "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start transition-colors",
        arming
          ? "bg-red-600 text-paper hover:bg-red-700"
          : "bg-paper text-red-600 hover:bg-red-50",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-9 w-9 place-items-center rounded-xl",
          arming ? "bg-paper/15 text-paper" : "bg-red-50 text-red-600",
        ].join(" ")}
      >
        <LogOut size={16} aria-hidden="true" />
      </span>
      <span className="flex-1 text-[14px] font-semibold tracking-[-0.01em]">
        {arming ? t("signOutConfirm") : t("signOut")}
      </span>
    </button>
  );
}
