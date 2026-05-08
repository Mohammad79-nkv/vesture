"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  logOutfitWearAction,
  deleteOutfitAction,
} from "@/app/[locale]/(shop)/closet/styles/actions";

// Client-only action bar for /closet/styles/[id]: "Wear today" bumps
// wearCount + lastWornAt, "Delete" is two-tap confirm. Phase 3B will add
// "Get AI feedback" here too once the scoring endpoint lands.
export function StyleDetailActions({ outfitId }: { outfitId: string }) {
  const t = useTranslations("closetStyles");
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleWear() {
    startTransition(async () => {
      await logOutfitWearAction(outfitId);
    });
  }

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 4000);
      return;
    }
    startTransition(async () => {
      try {
        await deleteOutfitAction(outfitId);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleWear}
        disabled={pending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-[12px] font-medium uppercase tracking-[0.06em] text-paper disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles size={14} aria-hidden="true" />
        )}
        {t("wear")}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.06em] transition-colors",
          confirming
            ? "bg-red-600 text-paper hover:bg-red-700"
            : "text-red-600 hover:bg-red-50",
        ].join(" ")}
      >
        <Trash2 size={13} aria-hidden="true" />
        {confirming ? t("deleteConfirm") : t("delete")}
      </button>
    </div>
  );
}
