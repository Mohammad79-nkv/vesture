"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, Sparkles, X } from "lucide-react";
import { cloudinaryUrl } from "@/lib/domain/cloudinary-url";
import {
  applyPieceSwapAction,
  getSwapSuggestionsAction,
  type SwapSuggestionResult,
} from "@/app/[locale]/(shop)/today/actions";
import type { TodayPiece } from "@/lib/services/today-recommender";
import type { TodayRecommendationsPayload } from "@/lib/services/today-cache";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";
import type { SwapAlternative } from "@/lib/services/today-swap";

// Frame 04 · tap-piece swap sheet.
//
// Triggered from a TodayCard when the user taps an individual
// piece thumbnail. Loads ranked alternatives via OpenRouter (the
// `getSwapSuggestionsAction` server action), shows the AI's top
// pick with a "BEST" badge + the suggestion banner, and applies
// the swap on tap via `applyPieceSwapAction`.

export type SwapTarget = {
  outfitIndex: number;
  outfitName: string;
  outfitMood: string;
  outfitPieces: Array<{ slot: OutfitSlot; pieceId: string }>;
  slot: OutfitSlot;
  currentPieceId: string;
};

export function SwapSheet({
  open,
  target,
  pieces,
  onClose,
  onApplied,
}: {
  open: boolean;
  target: SwapTarget | null;
  pieces: Map<string, TodayPiece>;
  onClose: () => void;
  onApplied: (payload: TodayRecommendationsPayload) => void;
}) {
  const t = useTranslations("today.swap");
  const locale = useLocale();

  const [phase, setPhase] = useState<
    "loading" | "ready" | "applying" | "error"
  >("loading");
  const [alternatives, setAlternatives] = useState<SwapAlternative[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<
    "noCandidates" | "modelFailed" | null
  >(null);
  const [, startApply] = useTransition();

  // ESC + body-scroll lock — same pattern as the other sheets.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Fetch alternatives whenever the sheet opens with a fresh target.
  // setTimeout(0) defers the setState to a fresh task so React's
  // set-state-in-effect lint stays quiet.
  useEffect(() => {
    if (!open || !target) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setPhase("loading");
      setAlternatives([]);
      setSuggestion(null);
      setErrorCode(null);
      const res: SwapSuggestionResult = await getSwapSuggestionsAction({
        outfitName: target.outfitName,
        outfitMood: target.outfitMood,
        outfitPieces: target.outfitPieces,
        slot: target.slot,
        currentPieceId: target.currentPieceId,
        locale,
      });
      if (cancelled) return;
      if (!res.ok) {
        setErrorCode(res.error);
        setPhase("error");
        return;
      }
      setAlternatives(res.alternatives);
      setSuggestion(res.suggestion);
      setPhase("ready");
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, target, locale]);

  function handlePick(alt: SwapAlternative) {
    if (!target) return;
    setPhase("applying");
    startApply(async () => {
      const res = await applyPieceSwapAction({
        outfitIndex: target.outfitIndex,
        slot: target.slot,
        newPieceId: alt.pieceId,
      });
      if (res.ok) {
        onApplied(res.payload);
        onClose();
      } else {
        setErrorCode("modelFailed");
        setPhase("error");
      }
    });
  }

  const currentPiece = useMemo(
    () => (target ? pieces.get(target.currentPieceId) ?? null : null),
    [target, pieces],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogLabel")}
      className="fixed inset-0 z-40"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-ink/45"
      />

      <div
        className={[
          "absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-3xl bg-paper shadow-[0_-12px_40px_rgba(33,39,57,0.30)] transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-ink/15" />
        </div>

        {/* Current piece header */}
        <div className="px-5 pt-1 pb-3.5">
          <div className="flex items-center gap-3">
            <div
              className="h-[70px] w-[56px] shrink-0 overflow-hidden rounded-[10px]"
              style={{ background: currentPiece?.swatchHex ?? "#C9CDD6" }}
            >
              {currentPiece?.publicId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cloudinaryUrl(currentPiece.publicId, 200)}
                  alt={currentPiece.name ?? currentPiece.category}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/55">
                {t("swapping")}
              </p>
              <p className="mt-0.5 text-[18px] font-bold tracking-[-0.02em] text-ink">
                {currentPiece?.name ?? t("unnamedPiece")}
              </p>
              {currentPiece && (
                <p className="mt-0.5 text-[11px] text-ink/55">
                  {t("wornCount", { n: currentPiece.wearCount })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-ink/70 hover:bg-ink/10"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* AI suggestion banner */}
        {phase === "ready" && suggestion ? (
          <div className="px-5">
            <div className="flex items-center gap-2 rounded-[14px] bg-primary/10 px-3 py-2.5 text-primary">
              <Sparkles size={13} aria-hidden="true" />
              <p className="flex-1 text-[11.5px] leading-[1.4]">{suggestion}</p>
            </div>
          </div>
        ) : null}

        {/* Body */}
        <div className="px-5 pt-3.5">
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-10 text-ink/55">
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <p className="font-mono text-[10px] uppercase tracking-[0.12em]">
                {t("loading")}
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-[14px] bg-ink/[0.04] p-4 text-[12.5px] text-ink/70">
              {errorCode === "noCandidates"
                ? t("errors.noCandidates")
                : t("errors.failed")}
            </div>
          )}

          {(phase === "ready" || phase === "applying") && (
            <>
              <p className="px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
                {t("ranked")}
              </p>
              <ul className="mt-2.5 flex flex-col gap-2">
                {alternatives.map((alt, idx) => {
                  const piece = pieces.get(alt.pieceId);
                  if (!piece) return null;
                  const isBest = alt.isBest === true || idx === 0;
                  return (
                    <li key={alt.pieceId}>
                      <button
                        type="button"
                        onClick={() => handlePick(alt)}
                        disabled={phase === "applying"}
                        className={[
                          "flex w-full items-center gap-3 rounded-[14px] bg-paper p-2 text-start transition-shadow disabled:opacity-50",
                          isBest
                            ? "shadow-[inset_0_0_0_1.5px_#CD0268]"
                            : "shadow-[inset_0_0_0_1px_rgba(33,39,57,0.05)]",
                        ].join(" ")}
                      >
                        <div
                          className="h-[62px] w-[50px] shrink-0 overflow-hidden rounded-[8px]"
                          style={{ background: piece.swatchHex ?? "#C9CDD6" }}
                        >
                          {piece.publicId ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cloudinaryUrl(piece.publicId, 200)}
                              alt={piece.name ?? piece.category}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                              {piece.name ?? piece.category}
                            </span>
                            {isBest && (
                              <span className="rounded-[4px] bg-primary/15 px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.1em] text-primary">
                                {t("best")}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10.5px] text-ink/55">
                            {alt.reason}
                          </p>
                        </div>
                        <span className="rounded-full bg-mist px-2 py-1 font-mono text-[10px] tracking-[0.06em] text-secondary">
                          {alt.delta}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
