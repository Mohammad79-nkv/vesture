// Frame 12 · 4-band layer coverage meter for the cold variant.
// Visualises how many "layers" tonight's outfit calls for: Base /
// Mid / Outer / Acc. We compute the filled count from the primary
// outfit's slot composition: TOP=base, OUTER=outer, additional
// TOPs=mid, ACCESSORY=acc. Crude but matches the design's intent.

import type { TodayOutfit } from "@/lib/services/today-cache";

const BANDS = ["base", "mid", "outer", "acc"] as const;
type Band = (typeof BANDS)[number];

function filledBands(outfit: TodayOutfit | undefined): Set<Band> {
  const filled = new Set<Band>();
  if (!outfit) return filled;
  let topCount = 0;
  for (const p of outfit.pieces) {
    if (p.slot === "TOP" || p.slot === "DRESS") {
      topCount += 1;
      filled.add(topCount === 1 ? "base" : "mid");
    } else if (p.slot === "OUTER") {
      filled.add("outer");
    } else if (p.slot === "ACCESSORY") {
      filled.add("acc");
    }
  }
  return filled;
}

export function LayerMeter({
  outfit,
  labels,
  caption,
}: {
  outfit: TodayOutfit | undefined;
  labels: Record<Band, string>;
  caption: string;
}) {
  const filled = filledBands(outfit);
  return (
    <div className="px-5 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {caption}
      </p>
      <div className="mt-2 flex gap-1">
        {BANDS.map((band) => {
          const isFilled = filled.has(band);
          return (
            <div key={band} className="flex-1">
              <div
                className={[
                  "h-1.5 rounded-full",
                  isFilled ? "bg-ink" : "bg-ink/[0.10]",
                ].join(" ")}
              />
              <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-[0.06em] text-ink">
                {labels[band]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
