import { createHmac, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import type { NextRequest } from "next/server";

// Lightweight signed-cookie helper for the anonymous stylist trial. We
// don't need a full session library for one counter — HMAC-SHA256 over a
// JSON payload, then `payload.signature`. The signature uses
// CLERK_SECRET_KEY as the HMAC key (already a server-only secret), so any
// tampering invalidates the cookie and the count resets to zero, which is
// the safest failure mode (the wall closes early, not late).

export type AnonStylistState = { count: number; sessionId: string };

export const ANON_STYLIST_TURN_LIMIT = 3;
const COOKIE_NAME = "vesture_anon_stylist";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

function secret(): Buffer {
  return Buffer.from(process.env.CLERK_SECRET_KEY ?? "vesture-dev-fallback");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function packAnonCookie(state: AnonStylistState): string {
  const json = JSON.stringify(state);
  const payload = Buffer.from(json).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function unpackAnonCookie(value: string): AnonStylistState | null {
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = value.slice(0, idx);
  const candidateSig = value.slice(idx + 1);
  const expectedSig = sign(payload);
  // Constant-time compare — base64url strings are ASCII so byte-equality
  // is fine here.
  const a = Buffer.from(candidateSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.count === "number" &&
      typeof parsed.sessionId === "string"
    ) {
      return parsed as AnonStylistState;
    }
    return null;
  } catch {
    return null;
  }
}

export function readAnonCookie(req: NextRequest): AnonStylistState | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return unpackAnonCookie(raw);
}

export function newAnonState(): AnonStylistState {
  return { count: 0, sessionId: nanoid() };
}

export function setAnonCookieHeader(state: AnonStylistState): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${packAnonCookie(state)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
