import type { ReactNode } from "react";

// Frame 02's top bar: kicker eyebrow ("TUESDAY · 18:42 · 14 PIECES")
// + an optional right slot for the weather chip / mode badge.
// Pure layout; copy comes from the parent.
//
// `kicker` accepts ReactNode rather than `string` so callers can
// pass a small client component (e.g. a live time clock) when the
// label needs device-local rendering.
export function TodayTopBar({
  kicker,
  right,
}: {
  kicker: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-12 pb-2">
      {typeof kicker === "string" ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {kicker}
        </p>
      ) : (
        kicker
      )}
      {right ? <div className="flex items-center">{right}</div> : null}
    </div>
  );
}
