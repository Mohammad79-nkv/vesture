// Per-product accent color, picked deterministically from the brand palette.
// Drawn from styles.css tokens in the canonical design (paper-2, primary-soft,
// secondary-soft, secondary-mid, primary-mid) plus a neutral gray-blue. Lighter
// values only — these read well as a card background under any product photo.
const PALETTE = [
  "#E6E9EE", // paper-2 — cool light gray
  "#FCE3EE", // primary-soft — pale pink
  "#DCEDF1", // secondary-soft — pale teal
  "#9DCAD4", // secondary-mid — medium teal
  "#F291BB", // primary-mid — medium pink
  "#C9CDD6", // gray-blue
] as const;

export function swatchFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length] ?? PALETTE[0]!;
}
