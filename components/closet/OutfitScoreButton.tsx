"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";

// Client-side trigger for the AI scoring endpoint. Calls
// POST /api/closet/outfit/score with the outfit id + current locale,
// then router.refresh() so the server component re-reads the persisted
// score and renders the feedback panel.
//
// Different states surface different copy:
//   - first time / no score yet: "Get AI feedback"
//   - after edit (scoredAt cleared): "Re-score"
//   - in-flight: spinner + "Scoring your look…"
//   - budget exceeded: inline error banner pointing to midnight UTC reset
export function OutfitScoreButton({
  outfitId,
  hasScore,
}: {
  outfitId: string;
  hasScore: boolean;
}) {
  const t = useTranslations("closetScore");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function trigger() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/closet/outfit/score", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outfitId, locale }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (body.error === "BUDGET_EXCEEDED") {
            setError(t("errors.budgetExceeded"));
          } else if (body.error === "EMPTY") {
            setError(t("errors.needPieces"));
          } else {
            setError(t("errors.scoreFailed"));
          }
          return;
        }
        router.refresh();
      } catch {
        setError(t("errors.scoreFailed"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-[12px] font-medium uppercase tracking-[0.06em] text-paper transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {t("scoring")}
          </>
        ) : (
          <>
            <Sparkles size={14} aria-hidden="true" />
            {hasScore ? t("rescore") : t("getCta")}
          </>
        )}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-2.5 text-[12.5px] text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
