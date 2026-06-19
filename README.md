<div align="center">

# Hiremory

### Reach every recruiter with a letter, not a blast.

**Hiremory** sends each recruiter a personalized email from *your own* inbox, follows up
automatically when they go quiet, classifies their replies, and shares your role-matched
resume the moment they say yes. You write once — it works for weeks.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Worker-Python%203.12-blue.svg)](https://www.python.org)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E.svg)](https://supabase.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Why Hiremory

Spray-and-pray job applications don't get replies — the second touch does, and almost
nobody sends it. Hiremory automates the part that actually works while keeping every
email personal and human:

- 📨 **Sends from your real inbox** — Gmail, Outlook, Zoho, or any SMTP. Replies land where you already look.
- ✍️ **Personalized, every time** — name, company, and role woven into each email. No mail-merge smell.
- 🔁 **Smart follow-ups** — a polite nudge after a few days of silence, inside the same thread.
- 📎 **Auto-resume on a "yes"** — detects interest and replies with your resume, tailored to the JD.
- 🧠 **Personalization memory** — learns your voice and reuses it across campaigns.
- 📊 **Honest tracking** — sent, replied, resume-sent, bounced. You always know where you stand.
- 🛡️ **Deliverability-first** — gentle pacing, warmup ramp, suppression lists, one-click unsubscribe (RFC 8058).

## How it works

1. **Connect your mailbox** — sign up and add any provider with an app password. Hiremory sends as *you*.
2. **Add recipients & resume** — upload an HR list as CSV (bulk), or paste a handful of emails (quick mode).
3. **Review the one email** — Hiremory drafts a personalized, recruiter-tested message. Tweak it once.
4. **Let the loop close** — it drips safely, follows up on silence, classifies replies, and sends your resume on a yes.

## Architecture

Hiremory is two small apps over a shared Postgres (Supabase):

```
┌─────────────┐        ┌──────────────────┐        ┌────────────────────┐
│  web/       │ writes │  Supabase        │ reads  │  worker/           │
│  Next.js    ├───────▶│  Postgres + Auth ├───────▶│  Python sender     │
│  (the app)  │        │  + Storage + RLS │        │  (cron / Actions)  │
└─────────────┘        └──────────────────┘        └─────────┬──────────┘
   compose, dashboard,                                       │ SMTP/IMAP
   mailbox, profile                                          ▼
                                                     your real mailbox
```

| Path | What it is |
|---|---|
| [`web/`](web/) | Next.js 16 (App Router) SaaS — landing, compose, dashboard, mailbox, profile. Tailwind theming. |
| [`worker/`](worker/) | Python orchestrator — send → replies → bounces → follow-ups. Transport abstraction (SMTP/Gmail), AI personalization, resume PDF rendering. |
| [`supabase/`](supabase/) | Database schema + storage policies as ordered SQL migrations. |
| [`docs/`](docs/) | Setup and architecture documentation. |

**AI** is provider-agnostic with graceful fallback: **Gemini (free, default) → Claude (optional) → template**.
No key? Hiremory still sends — it just uses a solid template instead of an LLM draft.

**Security**: mailbox secrets are encrypted at rest with AES-256-GCM; the web app encrypts,
the worker decrypts with the same `MAILBOX_ENC_KEY`. Row-Level Security isolates every tenant's data.

## Quick start (local)

**Prerequisites:** Node 18+, Python 3.12+, a free [Supabase](https://supabase.com) project.

### 1. Web app
```bash
cd web
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev                        # http://localhost:3000
```

### 2. Database
Apply the migrations in [`supabase/migrations/`](supabase/migrations/) in order
(via the Supabase SQL editor or the Supabase CLI).

### 3. Worker (background sender)
```bash
cd worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env               # fill in the values below
python main.py
```

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | web, worker | Server-side admin key — **never expose client-side** |
| `MAILBOX_ENC_KEY` | web, worker | AES-256 key for mailbox secrets — **must match across both** |
| `GEMINI_API_KEY` | web, worker | Free Gemini key (optional — enables AI drafts) |
| `GEMINI_MODEL` | web, worker | Defaults to `gemini-2.5-flash` |
| `APP_BASE_URL` | worker | Public app URL (for unsubscribe links) |

> 🔒 Secrets live in `.env` / `.env.local` and are git-ignored. **Never commit them.**

## Deploy

- **Web** → [Vercel](https://vercel.com) (Hobby tier, free). Root Directory = `web`, add the env vars above.
- **Worker** → [GitHub Actions](.github/workflows/worker.yml) cron (free). Add the same values as Actions secrets.

See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for the full walkthrough.

## Contributing

Hiremory is open source and contributions are welcome — code, docs, bug reports, and ideas.
Start with **[CONTRIBUTING.md](CONTRIBUTING.md)**, look for [`good first issue`](../../issues?q=label%3A%22good+first+issue%22)
labels, and open a PR. Found a security issue? See **[SECURITY.md](SECURITY.md)** — please don't file it publicly.

## License

[MIT](LICENSE) © Hiremory contributors. Use it, fork it, build on it.

---

> **Legacy:** an earlier Streamlit prototype lives in [`engine/`](engine/). The product is the
> `web/` + `worker/` stack above; `engine/` is kept for reference and may be removed in a future release.
