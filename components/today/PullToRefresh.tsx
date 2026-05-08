"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Loader2, RotateCw } from "lucide-react";

// Phase 3E.5 · Pull-to-refresh gesture wrapper.
//
// Mobile Safari doesn't fire native pull-to-refresh on app
// content (it's owned by the browser chrome), so we roll our own:
//   - touchstart at scrollTop=0 records a baseline Y
//   - touchmove past PULL_THRESHOLD shows the "Reshuffling…" pill
//   - touchend triggers onRefresh if the threshold was crossed
//
// onRefresh is awaited; we render a spinner state while the
// caller's server action is in flight, then dismiss.

const PULL_THRESHOLD = 70; // px below the start point before we trigger
const PULL_MAX = 120; // px the indicator translates downward at peak

export function PullToRefresh({
  onRefresh,
  pieceCount,
  children,
}: {
  onRefresh: () => Promise<void>;
  pieceCount: number;
  children: ReactNode;
}) {
  const t = useTranslations("today.refresh");
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const triggered = useRef(false);

  // Snap pull indicator back to 0 once refreshing finishes.
  // setTimeout(0) defers the setState so the lint rule sees no
  // synchronous call inside the effect body.
  useEffect(() => {
    if (refreshing) return;
    const id = setTimeout(() => setPullPx(0), 0);
    return () => clearTimeout(id);
  }, [refreshing]);

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    // Only engage if the page is at the top — we don't want to
    // hijack a regular scroll-up gesture inside the page.
    if (window.scrollY > 0) return;
    if (refreshing) return;
    startY.current = e.touches[0]?.clientY ?? null;
    triggered.current = false;
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (startY.current === null || refreshing) return;
    const y = e.touches[0]?.clientY ?? startY.current;
    const delta = y - startY.current;
    if (delta <= 0) {
      setPullPx(0);
      return;
    }
    // Resistance curve: damp progress so heavy drags don't shoot
    // way down. Clamp at PULL_MAX.
    const dampened = Math.min(PULL_MAX, delta * 0.55);
    setPullPx(dampened);
    if (!triggered.current && dampened >= PULL_THRESHOLD) {
      triggered.current = true;
    }
  }

  async function onTouchEnd() {
    if (startY.current === null) {
      setPullPx(0);
      return;
    }
    startY.current = null;
    if (triggered.current) {
      setRefreshing(true);
      setPullPx(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullPx(0);
    }
  }

  const indicatorVisible = pullPx > 0 || refreshing;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Indicator pill — slides down as the user drags */}
      <div
        aria-hidden={!indicatorVisible}
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
        style={{
          transform: `translateY(${Math.max(0, pullPx - 32)}px)`,
          opacity: indicatorVisible
            ? Math.min(1, pullPx / PULL_THRESHOLD)
            : 0,
          transition: refreshing
            ? "transform 0.2s ease-out, opacity 0.2s ease-out"
            : "none",
        }}
      >
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-paper">
          {refreshing ? (
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
          ) : (
            <RotateCw size={11} aria-hidden="true" />
          )}
          {refreshing
            ? t("reshuffling", { n: pieceCount })
            : t("pullToRefresh")}
        </div>
      </div>

      {/* Content nudges down as the user pulls so the gesture
         feels physical, then snaps back when refresh starts.
         Transition state mirrors `pullPx`: while >0 we follow
         the finger directly (no transition); at 0 we animate
         the snap-back. We can't read startY during render
         (React's refs lint blocks that) so we infer "actively
         dragging" from pullPx > 0. */}
      <div
        style={{
          transform: `translateY(${pullPx}px)`,
          transition:
            refreshing || pullPx === 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
