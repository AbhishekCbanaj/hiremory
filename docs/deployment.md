# Deployment

Hiremory runs entirely on free tiers: **Vercel** (web) + **GitHub Actions** (worker cron) +
**Supabase** (database). No servers to manage.

## Overview

| Component | Where | Cost |
|---|---|---|
| Web app | Vercel Hobby | Free |
| Worker | GitHub Actions cron | Free |
| Database / Auth / Storage | Supabase | Free tier |

## 1. Push to GitHub
```bash
git add -A
git commit -m "Deploy-ready"
git remote add origin https://github.com/<owner>/hiremory.git
git push -u origin main
```
Before committing, confirm no secrets are staged:
```bash
git status --porcelain | grep -E '\.env|credentials|token\.json' && echo "STOP — secret staged" || echo "clean"
```

## 2. Deploy the web app on Vercel
1. Vercel → **Add New → Project** → import your `hiremory` repo.
2. **Root Directory → `web`** (the Next.js app lives in `web/`, not the repo root).
3. Framework auto-detects Next.js — leave build defaults.
4. Add the environment variables from [configuration.md](configuration.md):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `MAILBOX_ENC_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
5. **Deploy** → you get `https://<project>.vercel.app`.

## 3. Point Supabase at the live URL
Supabase → **Authentication → URL Configuration**:
- **Site URL:** your `https://<project>.vercel.app`
- **Redirect URLs:** add `https://<project>.vercel.app/**`

(Otherwise password-reset and confirmation links point at localhost.)

## 4. Run the worker on a schedule
The worker ships with a GitHub Actions workflow: [`.github/workflows/worker.yml`](../.github/workflows/worker.yml).
It runs every 15 minutes, with a single-flight concurrency guard, and manual runs default to dry-run.

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MAILBOX_ENC_KEY`, `APP_BASE_URL`
(= your vercel.app URL), and `GEMINI_API_KEY`.

## 5. Custom domain (optional)
Buy a domain, add it in Vercel → Project → **Settings → Domains**, and update the
Supabase Site URL + Redirect URLs to match.

## Rotating a leaked key
If a key is ever exposed, rotate it everywhere — see [SECURITY.md](../SECURITY.md). For the
Supabase service-role key: Supabase → Settings → API → reset, then update Vercel + GitHub
Actions secrets + local `.env`.
