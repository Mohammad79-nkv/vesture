import { cloudinaryUrl } from "@/lib/domain/cloudinary-url";
import type { TodayOutfit } from "@/lib/services/today-cache";
import type { TodayPiece } from "@/lib/services/today-recommender";

// Frame 02's outfit card. Two surface variants:
//   - primary (dark) — the hero card. Big magenta name, thumbs on
//     a lifted shadow.
//   - regular (paper) — the ALT cards stacked below the hero.
//
// Pieces row renders the rec's piece list in slot order; we hydrate
// each `pieceId` against the closet snapshot the page passes in.
// Unknown ids are dropped silently (the recommender service prunes
// these but defending here keeps a stale cache from rendering ghost
// slots).

const SLOT_ORDER = [
  "TOP",
  "OUTER",
  "DRESS",
  "BOTTOM",
  "SHOES",
  "BAG",
  "ACCESSORY",
] as const;

export function TodayCard({
  outfit,
  pieces,
  primary = false,
  variant = "full",
  badgeAllOwn,
}: {
  outfit: TodayOutfit;
  pieces: Map<string, TodayPiece>;
  primary?: boolean;
  // "mini" trims the card for the daytime backup row (1+2 layout).
  variant?: "full" | "mini";
  badgeAllOwn: string;
}) {
  // Stable rendering order regardless of how the model returned slots.
  const orderedPieces = [...outfit.pieces].sort(
    (a, b) =>
      SLOT_ORDER.indexOf(a.slot as (typeof SLOT_ORDER)[number]) -
      SLOT_ORDER.indexOf(b.slot as (typeof SLOT_ORDER)[number]),
  );

  const isDark = primary;
  const cardClass = [
    "relative rounded-[22px]",
    isDark
      ? "bg-ink text-paper shadow-[0_8px_24px_rgba(33,39,57,0.20)]"
      : "bg-paper text-ink shadow-[0_1px_0_rgba(33,39,57,0.03)]",
    variant === "mini" ? "p-2.5" : "p-3.5",
  ].join(" ");

  const titleSize = variant === "mini" ? "text-[14px]" : "text-[22px]";
  const moodColor = isDark ? "text-paper/55" : "text-ink/55";
  const thumbHeight = variant === "mini" ? "h-[64px]" : "h-[110px]";

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <p
            className={`font-bold leading-none tracking-[-0.02em] ${titleSize}`}
          >
            {outfit.name}.
          </p>
          {variant === "full" && (
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.12em] ${moodColor}`}
            >
              {outfit.mood}
            </span>
          )}
        </div>
        {variant === "full" && (
          <span
            className={[
              "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
              isDark
                ? "bg-paper/10 text-paper/70"
                : "bg-mist text-secondary",
            ].join(" ")}
          >
            {badgeAllOwn}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {orderedPieces.map((p) => {
          const piece = pieces.get(p.pieceId);
          if (!piece) return null;
          return (
            <div
              key={p.pieceId}
              className={`relative flex-1 overflow-hidden rounded-[10px] ${thumbHeight}`}
              style={{ background: piece.swatchHex ?? "#C9CDD6" }}
            >
              {piece.publicId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cloudinaryUrl(piece.publicId, 200)}
                  alt={piece.name ?? piece.category}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
