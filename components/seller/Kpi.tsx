// KPI tile for the seller dashboard's top row. Matches the design's spec:
// 10px mono uppercase label, 36px Manrope 700 value, small mono delta line.
// `tone` controls the color of the delta — up=teal, down=primary.
export function Kpi({
  label,
  value,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "up" | "down" | "neutral";
}) {
  const deltaColor =
    tone === "up"
      ? "text-secondary"
      : tone === "down"
        ? "text-primary"
        : "text-muted";

  return (
    <div className="rounded-2xl border border-ink/6 bg-paper p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-[36px] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
        {value}
      </p>
      {delta && (
        <p className={`mt-1.5 font-mono text-[11px] ${deltaColor}`}>{delta}</p>
      )}
    </div>
  );
}
