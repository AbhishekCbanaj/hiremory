# Architecture

Hiremory is two small applications sharing one Postgres database (Supabase). The web app
is what users touch; the worker does the sending in the background. They never call each
other directly — they coordinate entirely through the database.

```
┌──────────────────┐         ┌─────────────────────┐         ┌──────────────────────┐
│  web/ (Next.js)  │  writes │  Supabase           │  reads  │  worker/ (Python)    │
│                  ├────────▶│  • Postgres (+ RLS) ├────────▶│                      │
│  landing         │         │  • Auth             │         │  phase: send         │
│  compose         │◀────────┤  • Storage          │◀────────┤  phase: replies      │
│  dashboard       │  reads  │                     │  writes │  phase: bounces      │
│  mailbox/profile │         │                     │         │  phase: follow-ups   │
└──────────────────┘         └─────────────────────┘         └──────────┬───────────┘
                                                                         │ SMTP / IMAP
                                                                         ▼
                                                                  your real mailbox
```

## The three layers

### 1. Web (`web/`)
Next.js 16 App Router (TypeScript, Tailwind). Responsibilities:
- Marketing landing page and auth (email/password + reset).
- Authoring: compose campaigns, upload contacts, preview/edit the AI email, tailor a resume to a JD.
- Connecting and testing mailboxes (encrypts the secret before it touches the DB).
- Reading status back: dashboard, analytics, replies, follow-ups.

It uses `@supabase/ssr` for server and browser clients, plus a service-role admin client for
privileged server actions. See the [page docs](pages/) for each screen.

### 2. Database (Supabase)
Postgres with **Row-Level Security** so each user only sees their own rows. Also provides
**Auth** (email/password) and **Storage** (resume files). Schema is a set of ordered
migrations — see [database/schema.md](database/schema.md).

### 3. Worker (`worker/`)
A Python orchestrator run on a schedule (GitHub Actions cron in production, or by hand
locally). It runs four phases per cycle:
1. **send** — pick queued recipients, compose (AI or template), send via the user's mailbox.
2. **replies** — scan the inbox, classify replies, auto-send the resume on a confirmed "yes".
3. **bounces** — detect hard bounces and suppress those addresses.
4. **follow-ups** — nudge non-repliers after a quiet period, in the same thread.

It takes a single-flight lease so two cron runs never send at once, ramps volume during
warmup, and records each run in `worker_runs`. See [worker/overview.md](worker/overview.md).

## Key cross-cutting concerns

- **AI personalization** — provider-agnostic: Gemini (free, default) → Claude (optional) →
  template fallback. The app never *requires* a key; without one it sends a solid template.
- **Encryption** — mailbox passwords are AES-256-GCM encrypted. The web app encrypts with
  `MAILBOX_ENC_KEY`; the worker decrypts with the same key. Format: `v1.<iv>.<ct>.<tag>`.
- **Deliverability** — gentle pacing, warmup ramp, suppression lists, and RFC 8058 one-click
  unsubscribe (stateless HMAC token).

## Why this shape

Splitting authoring (web) from sending (worker) means the slow, long-running outreach loop
runs on free cron infrastructure without blocking the UI, and the whole thing scales to many
tenants on a single shared Postgres with RLS doing the isolation.
