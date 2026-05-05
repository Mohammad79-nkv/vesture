"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Loader2 } from "lucide-react";

// Two-tap confirm + transition. The first tap arms the button (turns red,
// label flips to "Confirm delete"). The second tap submits the parent form,
// which is wired to a server action that calls deleteUserAdmin. Auto-disarms
// after 4s so the button doesn't sit dangerous-looking forever.
export function DeleteUserButton({
  formId,
  disabledReason,
}: {
  formId: string;
  disabledReason?: string;
}) {
  const t = useTranslations("admin.users");
  const [arming, setArming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (disabledReason) return;
    if (!arming) {
      setArming(true);
      window.setTimeout(() => setArming(false), 4000);
      return;
    }
    startTransition(() => {
      const form = document.getElementById(formId) as HTMLFormElement | null;
      form?.requestSubmit();
    });
  }

  const isDisabled = Boolean(disabledReason) || pending;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={disabledReason}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        arming
          ? "bg-red-600 text-paper hover:bg-red-700"
          : "bg-red-50 text-red-600 hover:bg-red-100",
      ].join(" ")}
    >
      {pending ? (
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 size={12} aria-hidden="true" />
      )}
      {arming ? t("deleteConfirm") : t("delete")}
    </button>
  );
}
