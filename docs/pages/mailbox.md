# Mailbox (`/mailbox`)

Connect the inbox Hiremory sends from. Email goes out as *you*, so replies land in your real mailbox.

## What the user does
1. Enter the email address — Hiremory auto-detects the provider (Gmail, Outlook, Zoho, …).
2. Follow the per-provider steps to create an **app password** (with a deep link to the right page).
3. Paste the app password and **Test connection** (verifies SMTP send + IMAP read).
4. Manage connected mailboxes; disconnect any time.

## Why an app password (not OAuth)
App passwords keep onboarding simple and free — no OAuth app verification or per-send API cost.
The password is **encrypted before it's stored**.

## Under the hood
- **File:** [`web/app/mailbox/page.tsx`](../../web/app/mailbox/page.tsx)
- **APIs:** `web/app/api/mailbox/connect/route.ts` (encrypts + stores), `web/app/api/mailbox/test/route.ts` (live SMTP/IMAP check).
- **Encryption:** `web/lib/crypto.ts` encrypts with `MAILBOX_ENC_KEY`; the worker decrypts with `worker/crypto.py`. Format `v1.<iv>.<ct>.<tag>`.
- **Table:** `mailboxes` (status, encrypted secret, provider hosts).

## Gotchas
- **Connect fails to encrypt** → `MAILBOX_ENC_KEY` is missing from `web/.env.local`.
- **Worker can't send** → web and worker `MAILBOX_ENC_KEY` values differ.
- **SMTP 535 ("Username and Password not accepted")** is an *auth* failure → the mailbox is **paused**,
  not the recipient suppressed (handled by exception type, not string matching).
- Gmail requires 2-Step Verification enabled before app passwords are available.
