# Phase 2 readiness checklist

Phase 1 (catalog + closet + onboarding) is shipped. Before opening the
Phase 2 PR (AI stylist), work through this list once. The numbered items
are blockers; the dashed items are nice-to-haves.

---

## 1. Credentials you need to obtain

The code already references these env vars; they must be real before the
stylist can call out to anything.

1. **Cloudinary** — image uploads currently fail with 401 because
   `CLOUDINARY_CLOUD_NAME` is the literal string `your-cloud-name`.
   1. Sign up at <https://cloudinary.com/users/register_free>
   2. Dashboard → copy `Cloud name`, `API Key`, `API Secret`
   3. Paste into `.env`, then **restart `pnpm dev`** (env vars are
      read at boot)

2. **Anthropic API key** — required for the stylist endpoint.
   1. <https://console.anthropic.com/settings/keys> → create key
   2. Same page: set a monthly spend cap (recommended: $20 to start)
   3. Paste `ANTHROPIC_API_KEY` into `.env`

3. **Upstash Redis** — Phase 2 rate-limits `/api/stylist` per user/IP.
   1. <https://console.upstash.com> → Create Database → Redis
   2. Pick the region nearest your Vercel deployment
   3. From "REST API" tab, copy `UPSTASH_REDIS_REST_URL` and
      `UPSTASH_REDIS_REST_TOKEN` into `.env`

4. **Token budget decision** — `ANTHROPIC_DAILY_TOKEN_BUDGET_PER_USER`
   in `.env`. Default 50,000 tokens/user/day. With prompt caching on
   tools + brand voice, that's ~25-40 stylist turns. Tune after a week
   of telemetry.

---

## 2. Verify Phase 1 end-to-end

Run the smoke script — it hits every public + auth-redirect route:

```bash
pnpm dev                 # in one terminal
./scripts/smoke.sh       # in another
```

Then walk the original Phase 1 exit criteria manually:

- [ ] Sign up a buyer account at `/onboarding/sign-up`
- [ ] Promote yourself to admin: `pnpm tsx scripts/promote-admin.ts you@email.com`
- [ ] Sign out, sign back in (Clerk session refresh)
- [ ] Visit `/admin/sellers`, approve a pending seller
- [ ] As that seller, log in, upload a bilingual product (EN + AR)
- [ ] Switch to Arabic via the language switcher, find the product on
      `/ar/products`, favorite it
- [ ] Switch to English on the same page — favorite state persists, no reload

If anything in that flow breaks, fix it before adding stylist on top.

---

## 3. New scripts shipped with this checklist

```bash
# Promote a user to ADMIN (only safe path for the very first admin
# since /admin/users requires being already-admin to access).
pnpm tsx scripts/promote-admin.ts user@example.com

# Hit every public + auth-gated route, expect the right status code.
# Useful regression check after big refactors.
./scripts/smoke.sh
./scripts/smoke.sh https://staging.vesture.app  # or any base URL
```

---

## 4. Phase 2 milestones (from §5 of the architecture plan)

Once the prereqs above are green:

1. `lib/adapters/anthropic.ts` — Claude client + prompt-cache config
2. `lib/ai/tools/{search-products,build-outfit}.ts` — tool defs
3. `lib/ai/prompts/stylist.ts` — system prompt with brand voice
4. `lib/services/stylist.ts` — orchestrates Claude tool calls
5. `app/api/stylist/route.ts` — streaming SSE handler
6. Stylist chat UI replacing the placeholder at `/stylist`
7. `ChatSession` / `ChatMessage` persistence wiring (schema already
   exists, just needs the writes)
8. Anonymous chat with 3-turn limit + signed cookie attach on sign-up
9. Upstash rate limiter on the chat endpoint
10. Daily token budget enforcement

Exit criteria: *"I need a minimalist outfit for a summer wedding under
1500 AED"* (or the same in Arabic) returns coherent recommendations
from the actual catalog with working "View Product" links and
currency-aware budget filtering.

---

## 5. Optional but worth doing before Phase 2

- **Sentry** — error monitoring on the streaming endpoint will save
  hours of debugging the first time Claude returns an unexpected
  shape. Free tier is plenty.
- **Vitest** — service tests on `lib/services/stylist.ts` (and the
  tool implementations) pay back fast since stylist behavior is the
  hardest thing to eyeball-verify.
- **Playwright** — one happy-path E2E for the Phase 1 flow above so
  the smoke check can run automatically in CI.
