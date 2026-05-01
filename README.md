# Vesture

AI-powered fashion marketplace connecting MENA boutiques with style-led buyers.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind 4 (brand palette: ink/paper/beige/mist)
- Prisma 7 (driver-adapter API) + Postgres on Neon + pgvector
- Clerk (auth + role metadata)
- Cloudinary (signed direct uploads)
- next-intl (EN/AR with RTL)
- Anthropic Claude API (Phase 2 — AI stylist)
- Voyage embeddings (Phase 3 — semantic search)

## First-time setup

1. **Copy env file**
   ```sh
   cp .env.example .env
   ```
   Fill in real values for the variables marked `Phase 1`. Phase 2/3 keys can stay blank for now.

2. **Run the migration**
   ```sh
   pnpm exec prisma migrate dev --name init
   ```
   This creates the schema in your Neon database and enables the `pgvector` extension.

3. **Seed sample data**
   ```sh
   pnpm db:seed
   ```
   Creates 3 approved sellers (UAE/SA/EG) with 30 published products in 3 currencies. The seller `clerkId` values are placeholders — sign up via Clerk to claim them or to create real accounts.

4. **Configure Clerk webhook**
   - Clerk dashboard → Webhooks → Add Endpoint → `<APP_URL>/api/webhooks/clerk`
   - Subscribe to `user.created`, `user.updated`, `user.deleted`
   - Copy the signing secret into `CLERK_WEBHOOK_SECRET` in `.env`

5. **Run dev server**
   ```sh
   pnpm dev
   ```
   App at <http://localhost:3000>. Redirects to `/en` by default.

## Granting yourself ADMIN

Until the admin dashboard ships a self-promotion flow, set your role manually:

```sh
pnpm exec prisma studio
# Open the User table, set role = ADMIN on your row.
```

Then visit `/en/admin/sellers`.

## Daily commands

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Type check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Generate Prisma client | `pnpm db:generate` |
| Create migration | `pnpm db:migrate` |
| Open Prisma Studio | `pnpm db:studio` |
| Re-seed | `pnpm db:seed` |

## Project layout

```
app/
├── [locale]/         # all user-facing routes (EN/AR with RTL)
│   ├── (marketing)/
│   ├── (shop)/       # /products, /products/[slug], /favorites, /stylist
│   ├── (auth)/
│   ├── dashboard/    # seller-only (Clerk-gated)
│   └── admin/        # admin-only
└── api/              # /api/upload, /api/webhooks/clerk, (Phase 2) /api/stylist

lib/
├── services/         # business logic — the testable core
├── adapters/         # one file per external dependency
├── domain/           # zod schemas, types, money/i18n helpers
├── i18n/             # next-intl config + EN/AR message catalogs
└── ai/               # (Phase 2) prompts + tool definitions

prisma/
├── schema.prisma     # source of truth — pgvector enabled from day 1
└── seed.ts
```
