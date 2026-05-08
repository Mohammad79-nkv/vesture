"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

// Frame 08 · "Saved to My styles" toast.
//
// Shows for ~3.5s after a successful save then auto-dismisses.
// Click "VIEW" to jump to the saved-look detail page (/closet/styles
// /[id]). Pinned at the same bottom: 100px offset as the floating
// nav clearance so it doesn't overlap the tab bar.

const AUTO_DISMISS_MS = 3500;

export function SavedToast({
  outfitId,
  outfitName,
  pieceCount,
  totalSaved,
  onDismiss,
}: {
  outfitId: string;
  outfitName: string;
  pieceCount: number;
  totalSaved?: number;
  onDismiss: () => void;
}) {
  const t = useTranslations("today.saved");

  useEffect(() => {
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 z-30 animate-[fadeInUp_0.3s_ease-out]"
      style={{
        bottom: "calc(100px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center gap-3.5 rounded-[22px] bg-ink p-4 text-paper shadow-[0_12px_36px_rgba(33,39,57,0.40)]">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-secondary">
          <Check size={20} strokeWidth={2.4} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-[-0.01em]">
            {t("title")}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-paper/55">
            {outfitName} · {pieceCount} {t("pieces")}
            {totalSaved !== undefined ? ` · #${totalSaved}` : ""}
          </p>
        </div>
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/closet/styles/${outfitId}` as any}
          onClick={onDismiss}
          className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary hover:underline"
        >
          {t("view")}
        </Link>
      </div>
    </div>
  );
}
