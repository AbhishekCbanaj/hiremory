# Follow-ups (`/followups`)

The second touch — the nudge that actually gets replies. Hiremory watches for silence and
sends a polite follow-up in the same thread.

## What it does
- After a quiet period (a few days with no reply), the worker sends one follow-up.
- It replies **inside the original thread**, so it reads as a natural bump, not a new cold email.
- Contacts who replied or bounced are excluded.

## Under the hood
- **File:** [`web/app/followups/page.tsx`](../../web/app/followups/page.tsx)
- **Worker:** `phase` follow-ups in [`worker/main.py`](../../worker/main.py) — finds eligible sent contacts past the silence window.
- **Threading:** the transport keeps the thread/message references so the follow-up nests correctly.
- **Tables:** contact status / timestamps, `events`.

## Gotchas
- Follow-ups respect the same deliverability pacing as first sends.
- A contact gets the follow-up only once; replies/bounces cancel it.
