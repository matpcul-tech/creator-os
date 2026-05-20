# Creator OS

The creator's operating system. Plan, write, schedule, and grow — all powered by Claude Opus 4.7.

## What's inside

| Module | What it does |
|---|---|
| **Onboarding** | 5-step wizard: identity, niche, audience, platforms, voice (paste samples → AI extracts your style), goals |
| **Dashboard** | Live counts of ideas / drafts / scheduled / published, revenue this month, audience size, upcoming items |
| **Ideas** | AI-generated idea bank, niche-aware, scored 1–10. Promote any idea to a draft in the planner. |
| **Planner (Kanban)** | Idea → Draft → Scheduled → Published columns with click-to-edit drawer (title, hook, CTA, master draft, platforms, schedule, notes) |
| **Calendar** | Monthly calendar view of every scheduled + published piece, color-coded by platform |
| **Studio** | Streaming AI script writer: pick a title + platform, Claude streams the script live. One-click adapt to other platforms (write once, post everywhere). Save to planner. |
| **Brand DNA** | Paste samples → Claude extracts traits (with strength bars), keywords, do-not-use phrases, voice description. All persisted and used in every future generation. |
| **Analytics** | Manual snapshot entry across platforms. Aggregate view + per-platform cards + history table. |
| **Monetization** | Sponsor pipeline (7-stage), revenue ledger, monthly total, per-source breakdown. |
| **Audience CRM** | Top fans / collaborators / sponsor contacts / journalists. Track last-touch dates. |

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **React 18**
- **Tailwind v3** + **framer-motion** + **lucide-react**
- **Prisma Postgres** (via `@prisma/extension-accelerate`) — works locally and on Vercel
- **@anthropic-ai/sdk 0.91+** with Opus 4.7, adaptive thinking, output_config, prompt caching

## Setup

```bash
# 1. Install
npm install

# 2. Provision a Prisma Postgres database
#    https://console.prisma.io/ → "New project" → copy the
#    prisma+postgres://accelerate.prisma-data.net/?api_key=... URL.

# 3. Configure
cp .env.example .env.local
# edit .env.local — set ANTHROPIC_API_KEY, DATABASE_URL,
# APP_PASSWORD (the password you'll sign in with),
# and APP_SESSION_SECRET (generate one with `openssl rand -base64 32`).

# 4. Initialize schema + seed singletons
npm run db:push
npm run db:seed

# 5. Run
npm run dev
```

Open http://localhost:3000 — the marketing landing page is at `/`, the app is at `/dashboard` (or `/onboarding` on first run).

### Deploying to Vercel

Set `ANTHROPIC_API_KEY`, `DATABASE_URL`, `APP_PASSWORD`, and
`APP_SESSION_SECRET` in the Vercel project's environment variables. Run
`npm run db:push` once locally (against the same `DATABASE_URL`) to sync
the schema before the first deploy.

### Auth

The app is single-user. Middleware (`middleware.ts`) gates every page and
API route except `/`, `/login`, `/api/auth/*`, and `/api/waitlist`. Signing
in at `/login` with `APP_PASSWORD` sets an HMAC-signed, HttpOnly session
cookie (30 days). Login attempts are rate-limited (5 / minute / IP) and
the AI routes are rate-limited (30 / minute / IP) as defense in depth.

## How the AI is wired

`lib/anthropic.ts` builds a single, large, **cacheable** system prompt from your profile + brand on every call. The system prompt has `cache_control: { type: "ephemeral" }`, so subsequent calls in the same 5-minute window pay ~10% of input cost on the prompt's tokens.

Every AI route in `/api/ai/*` uses this helper:

- `/api/ai/ideas` — JSON-mode batch idea generation (1–20 at a time)
- `/api/ai/script` — **streaming** script writer
- `/api/ai/adapt` — multi-platform adaptation (write once → variants for X / IG / TikTok / LinkedIn / etc., respecting per-platform character limits and conventions)
- `/api/ai/voice` — analyze writing samples → extract traits + keywords + do-not-use list, persist to `Brand`
- `/api/ai/hooks` — generate hook variations for a topic

Model: `claude-opus-4-7` with `thinking: { type: "adaptive" }` and `effort: "high"` (or `xhigh` for the streaming script writer).

## Data model (Prisma)

Single-user — `Profile` and `Brand` are singletons, everything else is a normal table.

- `Profile` — your identity, niche, audience, voice, platforms, goals, cadence
- `Brand` — colors, fonts, taglines, voice rules, do-not-use list
- `Idea` — content seeds (manual or AI-generated)
- `ContentPiece` — moves through `idea → draft → scheduled → published`
- `Sponsor` — 7-stage pipeline
- `RevenueEntry` — per-event revenue log
- `Contact` — audience CRM
- `AnalyticsSnapshot` — per-piece, per-platform stat snapshots

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TS noEmit check |
| `npm run db:push` | Sync Prisma schema → Postgres |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed `Profile` + `Brand` singletons |
| `npm run db:studio` | Open Prisma Studio (GUI for the DB) |

## Notes

- This is a **single-user app** by design — protected by a single workspace password (`APP_PASSWORD`). Swap the gate for NextAuth/Clerk/Supabase if you ever need multi-user support.
- The marketing page at `/` is preserved from the original CreatorAI scaffold — unchanged, ready to ship as your landing page.
