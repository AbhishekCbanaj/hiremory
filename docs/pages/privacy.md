# Privacy (`/privacy`)

The public privacy page. Hiremory's core promise: your data stays yours, and email is sent
from *your own* mailbox — Hiremory never sends from a shared pool.

## What it states
- Hiremory sends job-application emails from **your own** mailbox to recruiters you choose.
- Mailbox credentials are encrypted at rest (AES-256-GCM).
- Your contacts, resume, and account data are isolated per user (Row-Level Security).
- Unsubscribe is honored via one-click (RFC 8058).

## Under the hood
- **File:** [`web/app/privacy/page.tsx`](../../web/app/privacy/page.tsx)
- **Unsubscribe:** stateless HMAC token — `worker/links.py` mints it, `web/lib/unsub.ts` verifies it;
  the `web/app/api/unsubscribe` route handles the one-click POST.
- **Security details:** [SECURITY.md](../../SECURITY.md).

## Gotchas
- Keep this page truthful and in sync with [SECURITY.md](../../SECURITY.md) — if data handling changes, update both.
