"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Trash2, Loader2 } from "lucide-react";
import {
  logWearAction,
  setPieceStatusAction,
  deletePieceAction,
} from "@/app/[locale]/(shop)/closet/actions";
import type { PieceStatus } from "@prisma/client";

const STATUSES: PieceStatus[] = [
  "IN_CLOSET",
  "LENT",
  "CLEANER",
  "STORAGE",
  "DONATED",
  "ARCHIVED",
];

// Client island for the interactive buttons on the piece detail screen.
// Server-rendered photo + read-only details live in the page; this component
// owns the wear log, status switch, and delete actions.
export function PieceDetailActions({
  pieceId,
  status,
}: {
  pieceId: string;
  status: PieceStatus;
}) {
  const t = useTranslations("closetPiece");
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleWear() {
    startTransition(async () => {
      await logWearAction(pieceId);
    });
  }

  function handleStatus(s: PieceStatus) {
    startTransition(async () => {
      await setPieceStatusAction(pieceId, s);
    });
  }

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      try {
        await deletePieceAction(pieceId);
      } catch (err) {
        // Server action redirects on success; let it propagate.
        if (err && typeof err === "object" && "digest" in err) throw err;
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Primary action: wear log */}
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
        {t("wearLog")}
      </button>

      {/* Status picker */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
          {t("status.label")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatus(s)}
              disabled={pending}
              className={[
                "rounded-full border px-3 py-1.5 text-[11.5px] font-medium tracking-[-0.01em] transition-colors",
                status === s
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-paper text-ink/65 hover:border-ink/40",
              ].join(" ")}
            >
              {t(`status.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Destructive */}
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
