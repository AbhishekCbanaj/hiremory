# Security Policy

Hiremory handles sensitive data — mailbox credentials, recruiter contacts, and resumes.
We take that seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Instead, report privately via one of:

- GitHub's [private vulnerability reporting](../../security/advisories/new) (preferred), or
- a direct message to the maintainers.

Include: a description, steps to reproduce, affected version/commit, and impact.
We aim to acknowledge within **72 hours** and to ship a fix or mitigation as quickly as the
severity warrants. We'll credit you in the release notes unless you'd rather stay anonymous.

## How Hiremory protects data

- **Mailbox secrets** are encrypted at rest with **AES-256-GCM**. The web app encrypts before
  storage; the worker decrypts at send time. Both use the same `MAILBOX_ENC_KEY`, which is never
  committed and never sent to the client.
- **Tenant isolation** is enforced with Postgres **Row-Level Security** — users can only read their own rows.
- **Service-role key** is server-side only and never exposed to the browser.
- **Secrets** (`.env`, `.env.local`, `credentials.json`, `token.json`) are git-ignored by default.

## If a key is exposed

Rotate it immediately:

- **Supabase service-role key** → Supabase dashboard → Settings → API → reset, then update every
  deployment env (Vercel, GitHub Actions, local `.env`).
- **`MAILBOX_ENC_KEY`** → rotating this invalidates stored mailbox secrets; users must reconnect their mailboxes.
- **`GEMINI_API_KEY`** → revoke in Google AI Studio and issue a new one.

## Supported versions

Hiremory is pre-1.0; security fixes target the latest `main`. Please run a recent commit.
