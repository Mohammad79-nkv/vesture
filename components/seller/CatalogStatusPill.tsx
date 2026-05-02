import type { ProductStatus } from "@prisma/client";

const TONES: Record<ProductStatus, { bg: string; text: string }> = {
  PUBLISHED: { bg: "bg-secondary/15", text: "text-secondary" },
  PENDING_REVIEW: { bg: "bg-primary/10", text: "text-primary" },
  DRAFT: { bg: "bg-ink/8", text: "text-ink/65" },
  ARCHIVED: { bg: "bg-ink/8", text: "text-ink/55" },
  REJECTED: { bg: "bg-primary/15", text: "text-primary" },
};

export function CatalogStatusPill({
  status,
  label,
}: {
  status: ProductStatus;
  label: string;
}) {
  const tone = TONES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.bg} ${tone.text}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full bg-current`} />
      {label}
    </span>
  );
}
