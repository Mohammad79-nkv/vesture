"use client";

import { useEffect } from "react";

// Registers /sw.js exactly once per session. Only runs in
// production builds — in dev the SW would interfere with HMR
// and serve stale chunks across reloads.
//
// Safe to mount anywhere globally; it renders nothing.

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Best-effort registration — failures are silent. If the SW
    // can't install (CSP, opaque error, etc.) the app still works
    // online, just without the offline fallback.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
