"use client";

import { Plus, X } from "lucide-react";
import type { ClosetPiece } from "@prisma/client";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";

// Mannequin canvas — fixed-aspect SVG silhouette with seven absolutely
// positioned slot tiles overlaid at body-zone coordinates. Each slot is
// either empty (renders a + with the slot label) or filled (renders the
// piece's swatch + small label + a tiny X). Tapping a filled tile fires
// onTap with the slot, which the parent uses to either remove the piece
// or open the swap sheet (Phase 3C).
//
// Slot positions are tuned for a 320×360 viewBox; the wrapper scales the
// SVG to fit container width and the absolute children scale with it via
// percentage geometry below.
//
// DRESS / TOP / BOTTOM share visual real estate. The parent service-layer
// guarantees only one of {DRESS} or {TOP, BOTTOM} is non-null at a time,
// so we just render whatever's in `pieces` and trust the rule held.

type Pieces = Partial<Record<OutfitSlot, ClosetPiece>>;

type Zone = {
  slot: OutfitSlot;
  // Percentage geometry — relative to a 320×360 canvas.
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
  // Stacking order — DRESS sits over TOP+BOTTOM, OUTER over TOP.
  z: number;
};

const ZONES: Zone[] = [
  { slot: "TOP", leftPct: 27.5, topPct: 17.8, widthPct: 45, heightPct: 38, z: 1 },
  { slot: "BOTTOM", leftPct: 34.4, topPct: 55.6, widthPct: 31.2, heightPct: 31.1, z: 1 },
  { slot: "DRESS", leftPct: 27.5, topPct: 17.8, widthPct: 45, heightPct: 70, z: 2 },
  { slot: "OUTER", leftPct: 18.1, topPct: 16.1, widthPct: 63.8, heightPct: 50, z: 0 },
  { slot: "SHOES", leftPct: 38.1, topPct: 86.7, widthPct: 23.8, heightPct: 10, z: 1 },
  { slot: "BAG", leftPct: 75, topPct: 50, widthPct: 20, heightPct: 22.2, z: 3 },
  { slot: "ACCESSORY", leftPct: 6.3, topPct: 22.2, widthPct: 18.8, heightPct: 16.7, z: 3 },
];

export function MannequinCanvas({
  pieces,
  slotLabels,
  selectedSlot,
  onTapEmpty,
  onTapFilled,
}: {
  pieces: Pieces;
  slotLabels: Record<OutfitSlot, string>;
  selectedSlot: OutfitSlot | null;
  onTapEmpty: (slot: OutfitSlot) => void;
  onTapFilled: (slot: OutfitSlot) => void;
}) {
  // When DRESS is filled we hide the empty TOP and BOTTOM zones (and vice
  // versa) so the canvas reads cleanly without overlapping placeholders.
  const dressFilled = Boolean(pieces.DRESS);
  const topOrBottomFilled = Boolean(pieces.TOP) || Boolean(pieces.BOTTOM);
  function shouldHideZone(slot: OutfitSlot): boolean {
    if ((slot === "TOP" || slot === "BOTTOM") && dressFilled && !pieces[slot]) {
      return true;
    }
    if (slot === "DRESS" && topOrBottomFilled && !pieces.DRESS) {
      return true;
    }
    return false;
  }

  return (
    <div className="relative aspect-[320/360] w-full overflow-hidden rounded-[18px] bg-paper shadow-[inset_0_0_0_1px_rgba(33,39,57,0.05)]">
      {/* Dotted-grid background + mannequin silhouette */}
      <svg
        viewBox="0 0 320 360"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="mannequin-dots"
            patternUnits="userSpaceOnUse"
            width="12"
            height="12"
          >
            <circle cx="6" cy="6" r="0.6" fill="rgba(33,39,57,0.18)" />
          </pattern>
        </defs>
        <rect width="320" height="360" fill="url(#mannequin-dots)" />
        <g stroke="rgba(33,39,57,0.18)" strokeWidth="1.2" fill="none">
          <circle cx="160" cy="50" r="22" />
          <path d="M138 78 L138 130 L114 220 L130 220 L150 140 L170 140 L190 220 L206 220 L182 130 L182 78 Z" />
          <path d="M150 140 L142 280 L150 332 L162 332 L160 280 L160 200 L160 280 L158 332 L170 332 L178 280 L170 140" />
        </g>
      </svg>

      {/* Slot zones — each is either an empty placeholder (+) or filled
          with the piece. Stacking via inline z-index. */}
      {ZONES.map((zone) => {
        const piece = pieces[zone.slot];
        const hidden = shouldHideZone(zone.slot);
        if (hidden) return null;

        const baseStyle = {
          left: `${zone.leftPct}%`,
          top: `${zone.topPct}%`,
          width: `${zone.widthPct}%`,
          height: `${zone.heightPct}%`,
          zIndex: zone.z,
        };

        if (!piece) {
          const isSelected = selectedSlot === zone.slot;
          return (
            <button
              key={zone.slot}
              type="button"
              onClick={() => onTapEmpty(zone.slot)}
              style={baseStyle}
              className={[
                "absolute flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium uppercase tracking-[0.08em] transition-colors",
                isSelected
                  ? "border-2 border-dashed border-primary bg-primary/10 text-primary"
                  : "border border-dashed border-ink/15 bg-ink/[0.03] text-ink/45 hover:border-ink/40 hover:text-ink/70",
              ].join(" ")}
            >
              <Plus size={14} aria-hidden="true" />
              <span className="text-[9px]">{slotLabels[zone.slot]}</span>
            </button>
          );
        }

        // Filled tile — piece swatch background + image overlay (if Cloudinary
        // is set up; falls back to swatch for early users).
        const tileBg = piece.swatchHex ?? "#C9CDD6";
        return (
          <button
            key={zone.slot}
            type="button"
            onClick={() => onTapFilled(zone.slot)}
            style={{ ...baseStyle, background: tileBg }}
            className="group absolute overflow-hidden rounded-xl shadow-[0_6px_20px_rgba(33,39,57,0.12),0_0_0_2px_rgba(255,255,255,0.95)]"
          >
            {piece.publicId && piece.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={piece.imageUrl}
                alt={piece.name ?? piece.category}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
            {/* Hover/active X — placement matches the design's "X" affordance */}
            <span
              aria-hidden="true"
              className="absolute end-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-paper opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
            >
              <X size={11} strokeWidth={2.4} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
