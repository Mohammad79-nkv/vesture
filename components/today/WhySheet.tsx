"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, CalendarPlus, Check, Cloud, Loader2, Sparkles, X } from "lucide-react";
import {
  saveTodayOutfitAction,
  wearTodayOutfitAction,
} from "@/app/[locale]/(shop)/today/actions";
import type { TodayOutfit } from "@/lib/services/today-cache";
import type { TodayPiece } from "@/lib/services/today-recommender";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";
import type { WeatherCondition } from "@/lib/adapters/weather";

// Frame 07 · Why this look.
//
// Dark fullscreen sheet that slides up over /today. Header is a
// "{Outfit name} is right · for tonight." big-typography splash;
// body is a 5-row reasoning grid derived from data we already have
// (the outfit + closet + weather), no second LLM call. Footer has
// the three action buttons the page exists to enable: Wear this →
// logs wear on every piece, Save → persists as a SavedOutfit, and
// Share → no-op for v1 (placeholder for a future share-card flow).
//
// Reasoning rows are derived client-side rather than asking the
// recommender for a `whyDetails` array because the data is right
// there in the props — fewer round-trips, less prompt noise, and
// the rows stay accurate even if the model's `why` line drifts.

type ReasonKey = "mood" | "weather" | "occasion" | "variety" | "surfacing";

type DerivedReason = {
  key: ReasonKey;
  body: string;
};

export function WhySheet({
  open,
  onClose,
  outfit,
  pieces,
  weather,
  // The recommender's headline.kicker is what the bottom-line copy
  // surfaces ("Tonight", "Today"); we re-use it for "right for {kicker}".
  contextKicker,
  onSaved,
  onWore,
  onSchedule,
}: {
  open: boolean;
  onClose: () => void;
  outfit: TodayOutfit | undefined;
  pieces: Map<string, TodayPiece>;
  weather: { tempC: number; condition: WeatherCondition } | null;
  contextKicker: string;
  // Parent toasts on save / wear; we just fire the action and
  // bubble the result up through these callbacks.
  onSaved: (outfitId: string) => void;
  onWore: (count: number) => void;
  // Phase 3E.7 — opens the Schedule sheet for the same outfit.
  // Closes the why sheet so the schedule sheet has the screen.
  onSchedule?: () => void;
}) {
  const t = useTranslations("today.why");
  const [pendingSave, startSave] = useTransition();
  const [pendingWear, startWear] = useTransition();

  // ESC closes the sheet — desktop ergonomics; on mobile the
  // backdrop tap is the primary close affordance.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Derive the reasoning rows from outfit + weather + closet meta.
  const reasons = useMemo<DerivedReason[]>(() => {
    if (!outfit) return [];
    const rows: DerivedReason[] = [];

    // 1. Mood — straight from the outfit's mood phrase.
    rows.push({
      key: "mood",
      body: t("rows.moodBody", { mood: outfit.mood }),
    });

    // 2. Weather — only if we have a current reading. Otherwise
    // skip rather than fabricate.
    if (weather) {
      rows.push({
        key: "weather",
        body: t("rows.weatherBody", {
          temp: Math.round(weather.tempC),
          condition: t(`conditions.${weather.condition}`),
        }),
      });
    }

    // 3. Occasion — surface the model's why line if it gave one;
    // otherwise a generic line about formality balance. The
    // model usually folds occasion into `why` so this is a
    // fallback row.
    if (outfit.why) {
      rows.push({ key: "occasion", body: outfit.why });
    }

    // 4. Closet variety — find the longest-unworn piece in the
    // outfit and call it out.
    const oldest = outfit.pieces
      .map((p) => pieces.get(p.pieceId))
      .filter((p): p is TodayPiece => Boolean(p))
      .sort((a, b) => {
        const aT = a.lastWornAt?.getTime() ?? 0;
        const bT = b.lastWornAt?.getTime() ?? 0;
        return aT - bT;
      })[0];
    if (oldest) {
      // Date.now is intentionally read here for "days since last
      // worn"; the rule's purity check would force us to lift it
      // into a ref/prop with no real benefit — the row is purely
      // presentational and its value drifting by a frame across
      // re-renders is invisible to the user.
      // eslint-disable-next-line react-hooks/purity
      const nowMs = Date.now();
      const daysSince = oldest.lastWornAt
        ? Math.floor(
            (nowMs - oldest.lastWornAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;
      const name = oldest.name ?? oldest.category.toLowerCase();
      if (daysSince === null) {
        rows.push({
          key: "variety",
          body: t("rows.varietyUnworn", { name }),
        });
      } else if (daysSince >= 30) {
        rows.push({
          key: "variety",
          body: t("rows.varietyDays", { name, days: daysSince }),
        });
      }
    }

    // 5. Surfacing — count pieces that have never been worn.
    const unwornCount = outfit.pieces
      .map((p) => pieces.get(p.pieceId))
      .filter((p): p is TodayPiece => p !== undefined && p.wearCount === 0)
      .length;
    if (unwornCount > 0) {
      rows.push({
        key: "surfacing",
        body: t("rows.surfacingBody", { n: unwornCount }),
      });
    }

    return rows;
  }, [outfit, pieces, weather, t]);

  function handleWear() {
    if (!outfit) return;
    startWear(async () => {
      const res = await wearTodayOutfitAction({
        name: outfit.name,
        pieces: outfit.pieces.map((p) => ({
          slot: p.slot as OutfitSlot,
          pieceId: p.pieceId,
        })),
      });
      if (res.ok) {
        onWore(res.piecesLogged);
        onClose();
      }
    });
  }

  function handleSave() {
    if (!outfit) return;
    startSave(async () => {
      const res = await saveTodayOutfitAction({
        name: outfit.name,
        pieces: outfit.pieces.map((p) => ({
          slot: p.slot as OutfitSlot,
          pieceId: p.pieceId,
        })),
      });
      if (res.ok) {
        onSaved(res.outfitId);
        onClose();
      }
    });
  }

  return (
    <div
      aria-hidden={!open}
      className={[
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className={[
          "absolute inset-0 bg-ink/55 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        tabIndex={open ? 0 : -1}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className={[
          "absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-ink text-paper shadow-[0_-12px_40px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Drag-handle */}
        <div className="flex justify-center pt-3 pb-2">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-paper/20" />
        </div>

        <div className="px-5 pt-1 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/55">
                {t("eyebrow")}
              </p>
              <h2 className="mt-2 text-[26px] font-bold leading-[1.05] tracking-[-0.02em]">
                {outfit
                  ? t.rich("title", {
                      name: outfit.name,
                      context: contextKicker.toLowerCase(),
                      accent: (chunks) => (
                        <span className="font-light italic text-primary">
                          {chunks}
                        </span>
                      ),
                    })
                  : null}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper/10 text-paper hover:bg-paper/15"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Reasoning rows */}
        <ul className="px-5 pb-6">
          {reasons.map((row) => (
            <li
              key={row.key}
              className="flex gap-3 border-b border-paper/[0.08] py-2.5 last:border-0"
            >
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-paper/10 text-paper"
              >
                <ReasonGlyph kind={row.key} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55">
                  {t(`rows.${row.key}Label`)}
                </p>
                <p className="mt-1 text-[13px] leading-[1.4]">{row.body}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Action footer */}
        <div className="flex gap-2 px-5">
          <button
            type="button"
            onClick={handleWear}
            disabled={pendingWear || pendingSave || !outfit}
            className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-paper text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink disabled:opacity-60"
          >
            {pendingWear ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                {t("logging")}
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                {t("wear")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pendingSave || pendingWear || !outfit}
            aria-label={t("save")}
            className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-paper/10 text-paper disabled:opacity-60"
          >
            {pendingSave ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Bookmark size={16} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!onSchedule) return;
              onClose();
              onSchedule();
            }}
            disabled={!onSchedule || pendingWear || pendingSave}
            aria-label={t("schedule")}
            className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-paper/10 text-paper hover:bg-paper/15 disabled:opacity-60"
          >
            <CalendarPlus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonGlyph({ kind }: { kind: ReasonKey }) {
  // Same vocabulary the design uses: sparkle for mood, plain check
  // for occasion, etc. We keep the icons local rather than passing
  // them in so the parent doesn't have to know about lucide-react.
  switch (kind) {
    case "mood":
      return <Sparkles size={14} aria-hidden="true" />;
    case "weather":
      return <Cloud size={14} aria-hidden="true" />;
    case "occasion":
      return <Check size={14} aria-hidden="true" />;
    case "variety":
      return <Bookmark size={14} aria-hidden="true" />;
    case "surfacing":
      return <Sparkles size={14} aria-hidden="true" />;
  }
}
