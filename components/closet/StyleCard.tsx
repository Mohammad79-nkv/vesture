import { ChevronRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

// Card for the saved-looks grid. Renders the outfit composition as a
// 2-row stack of swatches (so the grid scans as fashion at a glance, not
// as text), the user-given name, and a wear-count line. Score pill +
// status corner badges (NEW / Top / RE-SCORE?) come in Phase 3B.
//
// Composition swatches: we use up to 4 piece swatches per card; if the
// outfit has more, the last cell shows a "+n" overflow chip. Swatches
// fall back from imageUrl → swatchHex → mist.

export type StyleCardPiece = {
  id: string;
  swatchHex: string | null;
  imageUrl: string | null;
  publicId: string | null;
  category: string;
  name: string | null;
};

// Score-pill color tone, mirroring the live builder pill. Tuned by score
// range, not by hue: ≥85 green, 70-84 amber, <70 magenta.
function scoreTone(score: number): { bg: string; fg: string } {
  if (score >= 85) return { bg: "#DCEDF1", fg: "#256776" };
  if (score >= 70) return { bg: "#FFF1D6", fg: "#7A5410" };
  return { bg: "#FCE3EE", fg: "#A50253" };
}

export function StyleCard({
  outfitId,
  name,
  pieces,
  worn,
  score,
  rescoreLabel,
  untitledLabel,
  neverWornLabel,
}: {
  outfitId: string;
  name: string | null;
  pieces: StyleCardPiece[];
  worn:
    | { wearCount: 0 }
    | { wearCount: number; lastWornFormatted: string };
  // Persisted composite score, or null if the look hasn't been scored
  // yet (or was edited and the score was cleared by the service layer).
  score: number | null;
  // Surfaces "RE-SCORE?" when the look exists but has no score (edited
  // since last score, or never scored). Localized.
  rescoreLabel: string;
  untitledLabel: string;
  neverWornLabel: string;
}) {
  const visible = pieces.slice(0, 4);
  const overflow = pieces.length - visible.length;
  const tone = score !== null ? scoreTone(score) : null;

  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={(`/closet/styles/${outfitId}` as any)}
      className="group block rounded-2xl bg-paper p-2.5"
    >
      {/* Composition area — swatch grid */}
      <div className="relative grid h-[140px] grid-cols-2 gap-1 overflow-hidden rounded-xl bg-mist p-1">
        {visible.map((piece, i) => (
          <div
            key={piece.id}
            className="relative overflow-hidden rounded-md"
            style={{ background: piece.swatchHex ?? "#C9CDD6" }}
          >
            {piece.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={piece.imageUrl}
                alt={piece.name ?? piece.category}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
            {i === visible.length - 1 && overflow > 0 && (
              <span
                aria-hidden="true"
                className="absolute inset-0 grid place-items-center bg-ink/60 font-mono text-[12px] font-semibold text-paper"
              >
                +{overflow}
              </span>
            )}
          </div>
        ))}
        {/* Pad with empty placeholders so the grid layout stays stable */}
        {Array.from({ length: Math.max(0, 4 - visible.length) }).map((_, i) => (
          <div key={`pad-${i}`} className="rounded-md bg-ink/[0.04]" />
        ))}

        {/* Top-left status badge — the score pill (when scored) or the
           RE-SCORE? hint (when not). Skipped entirely if neither applies. */}
        {tone ? (
          <span
            className="absolute start-1.5 top-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums leading-none"
            style={{ background: tone.bg, color: tone.fg }}
          >
            {score}
          </span>
        ) : (
          <span
            className="absolute start-1.5 top-1.5 rounded-md bg-paper/85 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.06em] text-ink/60 backdrop-blur"
          >
            {rescoreLabel}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="mt-2.5 flex items-center justify-between gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {name ?? untitledLabel}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-ink/55">
            {"lastWornFormatted" in worn
              ? `${worn.wearCount}× · ${worn.lastWornFormatted}`
              : neverWornLabel}
          </p>
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-ink/30 transition-colors group-hover:text-ink/60"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
