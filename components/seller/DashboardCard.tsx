import type { ReactNode } from "react";

// Reusable card chrome for the seller dashboard. `tint="ink"` flips to the
// dark Stylist-tip variant from the design.
export function DashboardCard({
  title,
  subtitle,
  tint = "paper",
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  tint?: "paper" | "ink";
  children: ReactNode;
  action?: ReactNode;
}) {
  const isDark = tint === "ink";
  return (
    <section
      className={[
        "rounded-2xl p-5 sm:p-6",
        isDark ? "bg-ink text-paper" : "border border-ink/6 bg-paper text-ink",
      ].join(" ")}
    >
      {(title || subtitle) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {subtitle && (
              <p
                className={[
                  "font-mono text-[10px] uppercase tracking-[0.14em]",
                  isDark ? "text-paper/55" : "text-muted",
                ].join(" ")}
              >
                {subtitle}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-[18px] font-bold tracking-[-0.02em]">
                {title}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
