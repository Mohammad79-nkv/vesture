// Initial-tinted circle that stands in for a seller logo when none is uploaded.
// Color is deterministic from the slug so the same seller always lands on the
// same hue across the catalog.
const PALETTE = [
  "bg-primary",
  "bg-secondary",
  "bg-ink",
  "bg-primary/70",
  "bg-secondary/70",
] as const;

function pickColor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length] ?? PALETTE[0]!;
}

export function SellerAvatar({
  slug,
  name,
  size = 20,
}: {
  slug: string;
  name: string;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const colorClass = pickColor(slug);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-paper ${colorClass}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
