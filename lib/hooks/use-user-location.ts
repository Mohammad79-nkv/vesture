"use client";

import { useCallback, useEffect, useState } from "react";

// Client hook that resolves the user's coordinates with this fallback
// chain:
//
//   1. server-provided initial value (User.location, fetched RSC-side
//      and passed in as `initial`) — zero round-trips on warm visits
//   2. navigator.geolocation prompt — accurate when granted
//   3. /api/geo/ip-fallback — coarse city-level fix when the user
//      denies the prompt or the device has no GPS
//
// Whichever path lands first wins. The hook then POSTs to
// /api/me/location so the resolved coords stick to the User row and
// the next visit short-circuits at step 1. Pages that need location
// pass `initial={user.location ?? null}` to skip the JS-side dance
// when we already know.

export type UserLocation = {
  lat: number;
  lon: number;
  label: string | null;
  source: "geolocation" | "ip" | "manual";
};

type Status = "idle" | "resolving" | "ready" | "error";

export function useUserLocation(initial: UserLocation | null = null) {
  const [location, setLocation] = useState<UserLocation | null>(initial);
  const [status, setStatus] = useState<Status>(initial ? "ready" : "idle");
  const [error, setError] = useState<
    "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "FAILED" | null
  >(null);

  const persist = useCallback(async (next: UserLocation) => {
    // Best-effort. If the persist fails (offline, 5xx) the user still
    // gets a working session — they'll just re-resolve next visit.
    try {
      await fetch("/api/me/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      /* swallow — see comment above */
    }
  }, []);

  const resolveViaIp = useCallback(async (): Promise<UserLocation | null> => {
    try {
      const res = await fetch("/api/geo/ip-fallback");
      if (!res.ok) return null;
      const j = (await res.json()) as Partial<UserLocation>;
      if (typeof j.lat !== "number" || typeof j.lon !== "number") return null;
      return {
        lat: j.lat,
        lon: j.lon,
        label: j.label ?? null,
        source: "ip",
      };
    } catch {
      return null;
    }
  }, []);

  const resolve = useCallback(async () => {
    setStatus("resolving");
    setError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // Server-rendered run or a browser without geolocation — straight
      // to IP fallback.
      const ipFix = await resolveViaIp();
      if (ipFix) {
        setLocation(ipFix);
        setStatus("ready");
        persist(ipFix);
      } else {
        setStatus("error");
        setError("UNAVAILABLE");
      }
      return;
    }

    // Wrap navigator.geolocation in a Promise so we can await it.
    // 10s timeout; high accuracy off — outfit choices don't need
    // sub-meter precision and high-accuracy mode burns battery.
    const geo = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    });

    if (geo) {
      const next: UserLocation = {
        lat: geo.coords.latitude,
        lon: geo.coords.longitude,
        label: null,
        source: "geolocation",
      };
      setLocation(next);
      setStatus("ready");
      persist(next);
      return;
    }

    // Browser denied / errored — fall through to IP.
    const ipFix = await resolveViaIp();
    if (ipFix) {
      setLocation(ipFix);
      setStatus("ready");
      persist(ipFix);
    } else {
      setStatus("error");
      setError("DENIED");
    }
  }, [persist, resolveViaIp]);

  // Auto-resolve on mount when the parent didn't pass an initial value.
  // setTimeout(0) defers the call to a fresh task so resolve()'s
  // internal setState calls don't fire synchronously inside the effect
  // body (which the React lint flags as cascading-renders risk).
  useEffect(() => {
    if (initial) return;
    const id = setTimeout(() => {
      resolve();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, status, error, resolve };
}
