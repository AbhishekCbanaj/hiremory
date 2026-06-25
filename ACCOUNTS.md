# Hiremory — Accounts & Environment

One source of truth for every external service Hiremory depends on, the env
vars each one provides, and which email owns the account. Keep this updated as
you add services. **Never commit real keys** — this file lists variable *names*
only.

> Target owner email for all accounts: **Hiremory@gmail.com**

## Core infrastructure (must own)

| Service | Purpose | Env vars | Owner email | Status |
|---------|---------|----------|-------------|--------|
| **GitHub** (`AbhishekCbanaj/hiremory`) | Source code + deploy trigger | — | Hiremory@gmail.com | ✅ live |
| **Vercel** | Hosting (`hiremory.vercel.app`), env, cron deploys | (holds all `web/` vars below) | Hiremory@gmail.com | ✅ live |
| **Supabase** (`maxoqzfeqefvegapmnwf`) | Postgres DB + Auth + Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` (worker) | Hiremory@gmail.com | ✅ live |

## AI (email writing + resume analysis)

| Service | Purpose | Env vars | Owner | Status |
|---------|---------|----------|-------|--------|
| **Groq** (console.groq.com) | Active AI provider (Llama 3.3 70B) | `AI_API_KEY`, `AI_BASE_URL` (`https://api.groq.com/openai/v1`), `AI_MODEL` (`llama-3.3-70b-versatile`) | Hiremory@gmail.com | ✅ active |
| **Anthropic** (optional fallback) | Claude fallback if no Groq/Gemini | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | — | ⛔ unused |
| ~~Google AI Studio / Gemini~~ | Old provider — removed | ~~`GEMINI_API_KEY`, `GEMINI_MODEL`~~ | — | 🗑️ removed |

## Email sending (users send from their own inbox)

| Service | Purpose | Env vars | Owner | Status |
|---------|---------|----------|-------|--------|
| **Google Cloud Console** | OAuth app so users connect Gmail to send | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Hiremory@gmail.com | ❓ set up when mailbox-connect goes live |
| **(secret)** Mailbox encryption | Encrypts stored mailbox creds at rest | `MAILBOX_ENC_KEY` | n/a (generated secret) | ✅ set |

## Payments

| Service | Purpose | Env vars | Owner | Status |
|---------|---------|----------|-------|--------|
| **Stripe** | International (USD) payments + portal | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TOPUP`, `NEXT_PUBLIC_STRIPE_PRO_LINK` | Hiremory@gmail.com | ❓ activate before charging |
| **Razorpay** | India (INR) payments + subscriptions | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_PRO`, `RAZORPAY_WEBHOOK_SECRET` | Hiremory@gmail.com | ❓ activate before charging |

## Analytics & monitoring (wired, dormant until keys added)

| Service | Purpose | Env vars | Owner | Status |
|---------|---------|----------|-------|--------|
| **PostHog** | Product analytics / pageviews | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Hiremory@gmail.com | ⛔ create + add key |
| **Sentry** | Error monitoring (server + client) | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Hiremory@gmail.com | ⛔ create + add key |

## Worker (GitHub Actions cron — sends, follow-ups, replies)

| Setting | Purpose | Env var |
|---------|---------|---------|
| Dispatch token | Lets "Send now" trigger the worker via `workflow_dispatch` | `GH_DISPATCH_TOKEN` |
| App URL | Links in emails (unsubscribe etc.) | `APP_BASE_URL` (`https://hiremory.vercel.app`) |
| Dry run | Safe mode — log instead of send | `DRY_RUN` |
| Pacing | Seconds between sends | `SEND_SPACING_SECONDS` |
| Throughput | Max sends per run | `MAX_SENDS_PER_RUN` |

## Where each var lives
- **`web/` vars** → set in **Vercel → Project → Settings → Environment Variables** (Production + Preview + Development). Mirror locally in `web/.env.local` (gitignored).
- **worker vars** → set as **GitHub Actions repo secrets** (Settings → Secrets and variables → Actions). Mirror locally in `worker/.env` (gitignored).

## Public contact
- App contact / mailto links: **Hiremory@gmail.com**

## ⚠️ Security TODO
- Rotate `SUPABASE_SERVICE_ROLE_KEY` (was exposed during setup) → regenerate in Supabase → update in Vercel **and** worker secrets.
- Buy a domain and add SPF / DKIM / DMARC before high-volume sending (deliverability).
