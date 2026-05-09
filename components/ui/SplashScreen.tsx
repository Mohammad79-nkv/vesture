"use client";

import { useEffect, useState } from "react";

// PWA splash overlay — paints the brand chrome over the app for
// ~700ms on first load of a session, then fades out. Bridges the
// gap between hydration and data-ready so the user never sees
// the bare paper background flash.
//
// We don't try to recreate iOS's native pre-hydration splash
// (that requires per-device <link rel="apple-touch-startup-
// image"> PNGs) — instead this is a JS overlay that mounts the
// moment React hydrates. SessionStorage keeps subsequent
// navigations within the same launch from re-flashing.

const STORAGE_KEY = "vesture:splash-seen";
const VISIBLE_MS = 700;
const FADE_MS = 350;

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "visible" | "fading">(
    "hidden",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    // SessionStorage so the splash shows once per app launch but
    // not on every navigation. Subsequent visits in the same tab
    // skip the overlay entirely.
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, "1");

    // setTimeout(0) defers the initial setPhase to a fresh task
    // so React's set-state-in-effect lint stays quiet — same
    // pattern used elsewhere (TodayContent, AutoTagAnalyzer).
    let fadeTimer: number | undefined;
    let hideTimer: number | undefined;
    const initTimer = window.setTimeout(() => {
      setPhase("visible");
      fadeTimer = window.setTimeout(() => setPhase("fading"), VISIBLE_MS);
      hideTimer = window.setTimeout(
        () => setPhase("hidden"),
        VISIBLE_MS + FADE_MS,
      );
    }, 0);
    return () => {
      window.clearTimeout(initTimer);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className={[
        "fixed inset-0 z-[100] flex items-center justify-center bg-ink text-paper transition-opacity duration-300 ease-out",
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
      style={{
        // Paint into the iOS notch / home-indicator areas so the
        // splash truly covers everything during the brief moment
        // before the app paints.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Brand glyph — same V mark the icons use. */}
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-paper/[0.08] text-[36px] font-bold leading-none tracking-[-0.04em] text-primary">
          V
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-paper/70">
          Vesture
        </span>
      </div>
    </div>
  );
}
