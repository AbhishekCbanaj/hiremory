# Replies (`/replies`)

Where recruiter responses land, sorted by what they mean.

## What the user sees
Hiremory scans the connected mailbox's threads, classifies each reply, and groups them:
- **Positive** — interest / "send your resume" → triggers the auto-resume (if enabled).
- **Neutral / question** — needs a human reply.
- **Negative / not interested** — closed out.

## How classification works
The worker's **replies** phase reads new messages, runs `classify_reply(text)` through the AI,
and only auto-sends the resume on an **AI-confirmed positive**. Anything uncertain is marked
`positive` *pending* for the user to confirm — it never auto-sends on a guess.

## Under the hood
- **File:** [`web/app/replies/page.tsx`](../../web/app/replies/page.tsx)
- **Worker:** `phase_replies` in [`worker/main.py`](../../worker/main.py); classifier in `worker/ai.py`.
- **Resume tailoring on a yes:** `_tailored_resume(...)` → `worker/resume_pdf.py` renders the PDF.
- **Tables:** contact status (`replied`, `positive`, `resume_sent`), `events`.

## Gotchas
- Auto-resume is gated by `RESUME_AUTOSEND` (on by default) — when off, positives wait for confirmation.
- Reply scanning only looks at contacts in the `sent` state.
