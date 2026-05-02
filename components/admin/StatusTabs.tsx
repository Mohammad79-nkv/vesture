import { Link } from "@/lib/i18n/navigation";

// Pill-style tab strip used by the sellers and products workspaces. Each tab
// is a link to the same route with a `status` query param; the active tab is
// passed in by the caller from server-side query parsing.
export function StatusTabs<K extends string>({
  basePath,
  tabs,
  active,
  paramKey = "status",
}: {
  basePath: "/admin/sellers" | "/admin/products";
  tabs: { key: K; label: string; count?: number }[];
  active: K;
  paramKey?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const href = `${basePath}?${paramKey}=${tab.key}`;
        return (
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={href as any}
            key={tab.key}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "border-ink bg-ink text-paper"
                : "border-ink/15 bg-paper text-ink hover:border-ink/40",
            ].join(" ")}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={[
                  "rounded-full px-1.5 font-mono text-[10px]",
                  isActive ? "bg-paper/15 text-paper" : "bg-mist text-ink/55",
                ].join(" ")}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
