"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { cloudinaryUrl } from "@/lib/domain/cloudinary-url";
import type { TodayOutfit } from "@/lib/services/today-cache";
import type { TodayPiece } from "@/lib/services/today-recommender";

// Frame 09 · "I wore this · logged".
//
// Full-screen takeover that confirms the wear log: dark background,
// large "Logged. Looked good." headline, the outfit's piece thumbs
// blown up across the top, then a 2-column stat grid showing
// freshly-bumped wearCount + days-since-last-worn for the most
// surfaced pieces in the outfit.
//
// We render this as a fixed-position overlay over /today instead
// of a separate route — the wear action is fast (one round-trip
// per piece) and the user expects the page they were on to come
// back when they dismiss.

export function WoreConfirmation({
  open,
  onClose,
  outfit,
  pieces,
  piecesLogged,
}: {
  open: boolean;
  onClose: () => void;
  outfit: TodayOutfit | undefined;
  pieces: Map<string, TodayPiece>;
  piecesLogged: number;
}) {
  const t = useTranslations("today.wore");

  // Auto-dismiss after a generous read window so the user sees the
  // confirmation without it feeling stuck. Tap dismisses earlier.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(id);
  }, [open, onClose]);

  // Lock body scroll while the overlay is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !outfit) return null;

  // Hydrate piece refs for the big strip + the stats below. Drop
  // any unknown ids defensively in case the cache referenced a
  // piece deleted between cache write and tap.
  const hydrated = outfit.pieces
    .map((p) => pieces.get(p.pieceId))
    .filter((p): p is TodayPiece => Boolean(p));

  // Show stats for the first two pieces — the design's frame 09
  // uses a 2-col grid. Could expand to all pieces, but two is the
  // visual focus.
  const featured = hydrated.slice(0, 2);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogLabel")}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-ink text-paper"
    >
      <div className="px-5 pt-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/55">
          {t("kicker", { count: piecesLogged })}
        </p>
        <h1 className="mt-2.5 text-[44px] font-bold leading-[0.95] tracking-[-0.03em]">
          {t("titleLead")}
          <br />
          <span className="font-light italic text-primary">
            {t("titleAccent")}
          </span>
        </h1>
      </div>

      {/* Big horizontal piece strip */}
      <div className="px-5 pt-8">
        <div className="flex gap-1.5">
          {hydrated.map((piece) => (
            <div
              key={piece.id}
              className="relative h-[150px] flex-1 overflow-hidden rounded-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.30)]"
              style={{ background: piece.swatchHex ?? "#3A4055" }}
            >
              {piece.publicId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cloudinaryUrl(piece.publicId, 200)}
                  alt={piece.name ?? piece.category}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Stats — show wearCount post-bump and a freshness hint.
         logWear has already incremented in the DB so the numbers
         here reflect the just-completed action. */}
      {featured.length > 0 && (
        <div className="px-5 pt-6">
          <div className="grid grid-cols-2 gap-2">
            {featured.map((piece) => (
              <div
                key={piece.id}
                className="rounded-[14px] bg-paper/[0.06] p-3"
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55">
                  {piece.name ?? piece.category}
                </p>
                <p className="mt-1 text-[20px] font-bold tracking-[-0.02em]">
                  {t("wearCount", { n: piece.wearCount + 1 })}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-secondary">
                  +1 {t("today")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tap anywhere to dismiss — explicit hint at the bottom so
         users don't wait for the auto-timer. */}
      <div className="mt-auto px-5 pb-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/45">
          {t("dismissHint")}
        </p>
      </div>
    </div>
  );
}
