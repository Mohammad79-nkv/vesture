"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cloudinaryUrl } from "@/lib/domain/cloudinary-url";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";
import type { ClosetPiece } from "@prisma/client";

// Phase 3C: slot-scoped bottom sheet that opens when the user taps an
// empty slot on the mannequin. The rail at the bottom of the builder
// is still the bulk-fill flow; this sheet is the targeted flow ("I
// want SHOES specifically") and shows only pieces eligible for the
// tapped slot.
//
// Design notes:
//   - Fixed-position sheet over a tap-dismissable backdrop. We don't
//     animate via Framer because the only motion is a transform-y
//     slide that CSS handles in one declarative line, and adding a
//     library for one transition isn't worth the bundle weight.
//   - The "active" piece (already placed in this slot from a previous
//     tap) gets a magenta ring so the user can see at a glance which
//     piece would be replaced if they pick a different one.
//   - Empty state mirrors the rail's "Add a piece" CTA so the dead-end
//     case still routes to /closet/add.

export function SlotPickerSheet({
  open,
  slot,
  slotLabel,
  pieces,
  activePieceId,
  onClose,
  onPick,
}: {
  open: boolean;
  slot: OutfitSlot | null;
  slotLabel: string;
  pieces: ClosetPiece[];
  activePieceId: string | null;
  onClose: () => void;
  onPick: (piece: ClosetPiece) => void;
}) {
  const t = useTranslations("closetBuilder.picker");
  const tFilters = useTranslations("closet.filters");

  // ESC closes the sheet — minor desktop ergonomics; on mobile the
  // backdrop tap is the primary close affordance.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while the sheet is open so the page doesn't
  // scroll behind the backdrop on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={[
        "fixed inset-0 z-40",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className={[
          "absolute inset-0 bg-ink/45 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        tabIndex={open ? 0 : -1}
      />

      {/* Sheet — slides in from the bottom. translate-y-full is the
          closed state; we animate to translate-y-0. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={slot ? t("title", { slot: slotLabel }) : ""}
        className={[
          "absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-hidden rounded-t-3xl bg-paper shadow-[0_-12px_40px_rgba(33,39,57,0.18)] transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Drag-handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-ink/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
              {t("eyebrow")}
            </p>
            <h2 className="mt-0.5 text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {t("title", { slot: slotLabel })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body — scrolls inside the sheet so the header stays put */}
        <div className="max-h-[calc(85dvh-96px)] overflow-y-auto px-5 pb-5">
          {pieces.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-[13.5px] text-ink/60">
                {t("empty", { slot: slotLabel.toLowerCase() })}
              </p>
              <Link
                href="/closet/add"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-paper hover:bg-ink/90"
              >
                <Plus size={12} aria-hidden="true" />
                {t("addNew")}
              </Link>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-3 gap-2.5 pt-1 sm:grid-cols-4">
                {pieces.map((p) => {
                  const isActive = activePieceId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onPick(p)}
                        className="group flex w-full flex-col items-start gap-1.5 text-start"
                      >
                        <div
                          className={[
                            "relative aspect-[3/4] w-full overflow-hidden rounded-2xl",
                            isActive
                              ? "shadow-[inset_0_0_0_2px_#CD0268]"
                              : "shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)]",
                          ].join(" ")}
                          style={{ background: p.swatchHex ?? "#C9CDD6" }}
                        >
                          {p.publicId ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cloudinaryUrl(p.publicId, 320)}
                              alt={p.name ?? p.category}
                              className="h-full w-full object-cover transition-transform duration-200 group-active:scale-[0.98]"
                              loading="lazy"
                            />
                          ) : null}
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="absolute end-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.06em] text-paper"
                            >
                              {t("placed")}
                            </span>
                          )}
                        </div>
                        <span className="line-clamp-1 text-[12px] font-medium text-ink">
                          {p.name ?? tFilters(p.category)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Add-new entry, sticky at the end of the grid so it's
                  always reachable without scrolling back to a header */}
              <Link
                href="/closet/add"
                onClick={onClose}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.02] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/65 hover:border-ink/40 hover:text-ink"
              >
                <Plus size={13} aria-hidden="true" />
                {t("addNew")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
