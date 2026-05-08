"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useUserLocation,
  type UserLocation,
} from "@/lib/hooks/use-user-location";

// Phase 3E.7 follow-up · resolves and persists the user's
// location on /today first-visit so subsequent renders fetch
// real weather + render the chip + drive cache invalidation
// on tempBucket changes.
//
// How it works:
//   - Server renders /today with user.location possibly null →
//     no weather chip, recommender called with null weather.
//   - This client component mounts, runs useUserLocation, which
//     prompts geolocation (or falls back to IP). On success the
//     hook POSTs /api/me/location and writes lat/lon to the
//     User row.
//   - router.refresh() re-runs the page's server component with
//     the updated user.location → getCurrentWeather succeeds
//     → chip appears + recommender re-fetches with weather.
//
// Subsequent visits short-circuit at step 1 (user.location is
// already populated), so no flicker.
//
// Renders nothing visible.

export function LocationResolver({
  initial,
}: {
  initial: UserLocation | null;
}) {
  const router = useRouter();
  const { location, status } = useUserLocation(initial);
  // Refresh just once after the first successful resolution so
  // we don't loop on every render.
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (refreshedRef.current) return;
    if (status !== "ready") return;
    if (!location) return;
    // Skip refresh if the SSR already had this location — means
    // the page is already rendering with weather and a refresh
    // would be wasted server work.
    if (
      initial &&
      Math.abs(initial.lat - location.lat) < 0.001 &&
      Math.abs(initial.lon - location.lon) < 0.001
    ) {
      refreshedRef.current = true;
      return;
    }
    refreshedRef.current = true;
    router.refresh();
  }, [status, location, initial, router]);

  return null;
}
