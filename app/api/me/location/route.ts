import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/adapters/prisma";

// POST /api/me/location
//
// Persists the user's resolved coordinates so subsequent renders can
// skip the geolocation prompt. Called by the client useUserLocation()
// hook after navigator.geolocation succeeds OR after the IP-fallback
// returns. We store both the coords and how we got them so the UI can
// adjust precision messaging ("near you" vs "around your area").

export const runtime = "nodejs";

const requestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  // Optional pretty label ("Riyadh", "Manhattan, NY") — the client passes
  // whatever the geocoder returned; null is fine.
  label: z.string().min(1).max(80).optional(),
  // How we got these coords — drives UI hints + tells us when to
  // re-prompt. "geolocation" = navigator.geolocation, "ip" = server-side
  // IP fallback, "manual" = user typed a city in onboarding (future).
  source: z.enum(["geolocation", "ip", "manual"]),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!dbUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      location: {
        lat: parsed.data.lat,
        lon: parsed.data.lon,
        label: parsed.data.label ?? null,
        source: parsed.data.source,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  return Response.json({ ok: true });
}
