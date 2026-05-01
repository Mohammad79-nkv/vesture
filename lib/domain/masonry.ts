// Deterministic per-product aspect ratios + 2-column balanced distribution
// for the mobile masonry feed. Each product slug maps to a stable aspect so
// the layout doesn't reflow between visits.

const ASPECTS = [
  { ratio: "aspect-[3/4]", weight: 4 / 3 },
  { ratio: "aspect-[4/5]", weight: 5 / 4 },
  { ratio: "aspect-square", weight: 1 },
  { ratio: "aspect-[2/3]", weight: 3 / 2 },
  { ratio: "aspect-[5/6]", weight: 6 / 5 },
] as const;

export type MasonryAspect = (typeof ASPECTS)[number];

export function aspectFor(slug: string): MasonryAspect {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return ASPECTS[h % ASPECTS.length] ?? ASPECTS[0]!;
}

// Greedy two-column packing: each item lands in whichever column has the
// shorter cumulative weight. Matches the mobile design's intent.
export function distributeMasonry<T>(
  items: T[],
  weightOf: (item: T) => number,
): [T[], T[]] {
  const cols: [T[], T[]] = [[], []];
  let h0 = 0;
  let h1 = 0;
  for (const item of items) {
    if (h0 <= h1) {
      cols[0].push(item);
      h0 += weightOf(item);
    } else {
      cols[1].push(item);
      h1 += weightOf(item);
    }
  }
  return cols;
}
