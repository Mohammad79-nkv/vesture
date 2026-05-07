import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash sliding-window rate limiter for /api/stylist. Two buckets:
//
//   user:{userId}  — authenticated users
//   ip:{ip}        — anonymous traffic (3-turn cookie wall is the hard
//                    cap; the per-IP limiter just stops bursty spam
//                    before the wall even matters)
//
// Graceful degradation: if UPSTASH_REDIS_REST_URL / _TOKEN are missing
// in env, the limiters are no-ops. Phase 2 ships without rate limiting
// today; flip it on later by setting the env vars — no code change.
//
// Limits are env-driven so they tune at deploy time:
//   STYLIST_RATELIMIT_USER_PER_MIN  (default 20)
//   STYLIST_RATELIMIT_IP_PER_MIN    (default 10)

const PREFIX = "vesture:stylist";
const WINDOW = "1 m" as const;

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

function readLimit(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

let cachedRedis: Redis | null = null;
let cachedUserLimiter: Ratelimit | null = null;
let cachedIpLimiter: Ratelimit | null = null;

function redis(): Redis {
  if (cachedRedis) return cachedRedis;
  cachedRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL as string,
    token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
  });
  return cachedRedis;
}

function userLimiter(): Ratelimit {
  if (cachedUserLimiter) return cachedUserLimiter;
  cachedUserLimiter = new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(readLimit("STYLIST_RATELIMIT_USER_PER_MIN", 20), WINDOW),
    prefix: `${PREFIX}:user`,
    analytics: true,
  });
  return cachedUserLimiter;
}

function ipLimiter(): Ratelimit {
  if (cachedIpLimiter) return cachedIpLimiter;
  cachedIpLimiter = new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(readLimit("STYLIST_RATELIMIT_IP_PER_MIN", 10), WINDOW),
    prefix: `${PREFIX}:ip`,
    analytics: true,
  });
  return cachedIpLimiter;
}

const NOOP: RateLimitResult = {
  ok: true,
  limit: 0,
  remaining: 0,
  resetAt: 0,
};

// Single entry point used by /api/stylist. Hands back a uniform
// RateLimitResult regardless of whether Upstash is configured — when not,
// every call returns { ok: true } so the endpoint behaves exactly as it
// does today.
export async function checkStylistRateLimit(args: {
  userId: string | null;
  ip: string;
}): Promise<RateLimitResult> {
  if (!isConfigured()) return NOOP;

  const limiter = args.userId ? userLimiter() : ipLimiter();
  const key = args.userId ?? args.ip;
  const result = await limiter.limit(key);
  return {
    ok: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}
