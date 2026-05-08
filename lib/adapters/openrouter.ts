import OpenAI from "openai";

// OpenRouter is OpenAI-compatible, so we point the official `openai` SDK at
// their gateway. One adapter file = one swap point if we ever route directly
// to Anthropic / OpenAI / etc. Everything downstream (tool defs, prompts,
// the stylist service, the streaming endpoint) imports from here so the
// dependency graph stays narrow.
//
// Why prefer the openai SDK over `fetch` directly:
//   - typed message + streaming-event shapes
//   - SSE parsing handled (delta / tool_calls / finish_reason)
//   - retry + abort signal plumbing
// Cost: one extra dep. Worth it.

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    // We throw at use-time rather than module-load so missing keys don't
    // break the whole app boot — only the stylist endpoint fails.
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

// `STYLIST_MODEL` is read once per request from env so swapping models is a
// deploy-time change, not a code change. Default lives in .env.example.
export function stylistModel(): string {
  return process.env.OPENROUTER_STYLIST_MODEL ?? "anthropic/claude-sonnet-4.5";
}

// Vision model for closet auto-tagging. Defaulted to gpt-4o-mini —
// cheap, fast, and image-capable. Sized for one-shot tag extraction
// from a single photo, not the multi-turn stylist flow, so the
// budget knob is separate from the stylist model.
export function visionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL ?? "openai/gpt-4o-mini";
}

export function dailyTokenBudgetPerUser(): number {
  const raw = process.env.STYLIST_DAILY_TOKEN_BUDGET_PER_USER ?? "50000";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 50_000;
}

let cachedClient: OpenAI | null = null;

// Lazy-singleton so we instantiate once per process (Vercel serverless re-uses
// across warm invocations) without doing the OpenAI() handshake at module load
// — which would fail in any context where OPENROUTER_API_KEY isn't set yet
// (tests, CI, non-stylist routes).
export function openrouter(): OpenAI {
  if (cachedClient) return cachedClient;

  // OpenRouter optionally accepts these headers for dashboard analytics —
  // shows traffic split by site so we can tell stylist usage apart from
  // anything else routed through the same key in the future.
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const siteName = process.env.OPENROUTER_SITE_NAME ?? "Vesture";

  cachedClient = new OpenAI({
    apiKey: readEnv("OPENROUTER_API_KEY"),
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": siteUrl,
      "X-Title": siteName,
    },
  });
  return cachedClient;
}

// Mark a system / user message segment as cacheable. OpenRouter passes the
// `cache_control` field through to Anthropic's prompt-cache machinery; on
// non-Anthropic models it's a no-op. We use this on the stylist's static
// system prompt + tool definitions so each turn after the first hits the
// 5-minute cache instead of paying full input-token cost.
//
// Usage:
//   { role: "system", content: cached(BRAND_VOICE) }
export function cached(text: string) {
  return [
    {
      type: "text" as const,
      text,
      // Keys outside the OpenAI types — the SDK forwards unknown fields, and
      // OpenRouter's docs document this exact shape for Anthropic caching.
      cache_control: { type: "ephemeral" },
    },
  ];
}

// Sums prompt + completion tokens from a non-streaming response. Streaming
// responses report usage in the final chunk; the caller is responsible for
// folding it into this counter.
export function tokensUsed(usage: {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}): number {
  return (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
}
