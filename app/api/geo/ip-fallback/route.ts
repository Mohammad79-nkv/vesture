import type { NextRequest } from "next/server";

// GET /api/geo/ip-fallback
//
// Coarse geolocation fallback for users who deny the browser
// permission prompt. Reads the request IP, asks ipapi.co (free, no
// key, 1k/day per their public limit) for a city + lat/lon, and
// returns the same shape the geolocation success path uses so the
// client hook can persist either source uniformly.
//
// We don't gate on auth because the only thing that leaks is the
// caller's own IP-derived city, which they're already exposing to
// the upstream by visiting the site. A future hardening step could
// be to require a valid Clerk session — easy bolt-on if abuse shows
// up in logs.

export const runtime = "nodejs";

type IpapiResponse = {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country_name?: string;
  error?: boolean;
  reason?: string;
};

// Pull the originating client IP out of the standard reverse-proxy
// headers. Vercel + most CDNs populate x-forwarded-for as a
// comma-separated list with the client first; in dev (no proxy) we
// fall back to undefined which makes ipapi geo-locate the dev server,
// which is fine for local testing.
function clientIpFromHeaders(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return undefined;
}

export async function GET(req: NextRequest) {
  const ip = clientIpFromHeaders(req);
  // ipapi.co/json/ uses the caller's IP if the path segment is
  // omitted, which works only when our server is the caller — for a
  // proxied client we explicitly pass the IP segment.
  const url = ip
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    : "https://ipapi.co/json/";

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Vesture/1.0 (geo-fallback)" },
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    return Response.json(
      { error: "GEO_UPSTREAM_FAILED" },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return Response.json(
      { error: "GEO_UPSTREAM_FAILED", status: res.status },
      { status: 502 },
    );
  }

  let data: IpapiResponse;
  try {
    data = (await res.json()) as IpapiResponse;
  } catch {
    return Response.json({ error: "BAD_RESPONSE" }, { status: 502 });
  }

  if (
    data.error ||
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number"
  ) {
    return Response.json(
      { error: "GEO_NOT_FOUND", reason: data.reason },
      { status: 404 },
    );
  }

  // Build a human-readable label from whatever the upstream gave us.
  // Prefer city, fall back to region or country so the UI can always
  // show *something* useful in the weather chip.
  const label =
    data.city ??
    data.region ??
    data.country_name ??
    null;

  return Response.json({
    lat: data.latitude,
    lon: data.longitude,
    label,
    source: "ip" as const,
  });
}
