# Contributing to Hiremory

Thanks for your interest in making Hiremory better! Whether you're fixing a typo,
filing a bug, or building a feature — you're welcome here. This guide gets you set up
and explains how we work.

## Ways to contribute

- 🐛 **Report a bug** — open an [issue](../../issues/new?template=bug_report.md) with steps to reproduce.
- 💡 **Suggest a feature** — open a [feature request](../../issues/new?template=feature_request.md).
- 📝 **Improve docs** — the [`docs/`](docs/) tree is fair game; small fixes can go straight to a PR.
- 🔧 **Write code** — look for [`good first issue`](../../issues?q=label%3A%22good+first+issue%22) labels.

## Project layout

| Path | What it is |
|---|---|
| [`web/`](web/) | Next.js 16 SaaS frontend (TypeScript, App Router, Tailwind) |
| [`worker/`](worker/) | Python 3.12 background sender |
| [`supabase/`](supabase/) | Ordered SQL migrations |
| [`docs/`](docs/) | Documentation — see [docs/README.md](docs/README.md) |

## Local setup

See the [Getting Started guide](docs/getting-started.md). In short:

```bash
# web
cd web && npm install && cp .env.local.example .env.local && npm run dev

# worker
cd worker && python3 -m venv .venv && source .venv/bin/activate \
  && pip install -r requirements.txt && cp .env.example .env && python main.py
```

You'll need a free [Supabase](https://supabase.com) project and the env vars listed in
[docs/configuration.md](docs/configuration.md).

## Development workflow

1. **Fork** the repo and create a branch off `main`: `git checkout -b feat/short-description`.
2. **Make your change.** Keep it focused — one logical change per PR.
3. **Verify it builds:** `cd web && npm run build` (web) and run the worker locally if you touched it.
4. **Commit** with a clear message (see below).
5. **Open a PR** against `main`, fill in the template, and link any related issue.

### Branch names
`feat/…` (feature) · `fix/…` (bug fix) · `docs/…` (documentation) · `chore/…` (tooling/cleanup)

### Commit messages
Write in the imperative mood and explain the *why* when it isn't obvious:
```
fix(worker): treat SMTP 535 as auth error, not recipient bounce

Gmail returns "Username and Password not accepted" which the string
match missed, so the mailbox got suppressed instead of paused.
```

## Coding standards

- **Web** — TypeScript, follow the existing component patterns; theme via Tailwind tokens (`web/tailwind.config.ts`), not hardcoded colors.
- **Worker** — clear, typed-ish Python; keep the phase structure (send → replies → bounces → follow-ups).
- **Database** — every schema change is a new, ordered migration in `supabase/migrations/`. Never edit an applied migration.
- **No secrets, ever.** `.env` / `.env.local` / `credentials.json` / `token.json` are git-ignored — keep it that way.

## Reporting security issues

Please **do not** open a public issue for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Code of conduct

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md). Be kind.

---

Not sure where to start? Open a [discussion](../../discussions) or a draft PR — we're happy to help.
