import { Link } from "@/lib/i18n/navigation";

export function ProductBreadcrumb({
  trail,
}: {
  // Each crumb is a label + optional link. The final crumb is the current page
  // and renders as plain text.
  trail: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-x-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/55"
    >
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={i} className="flex items-center gap-x-2">
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="hover:text-ink">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? "text-ink" : ""}>{crumb.label}</span>
            )}
            {!isLast && <span className="text-ink/30">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
