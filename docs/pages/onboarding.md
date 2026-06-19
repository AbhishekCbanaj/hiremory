# Onboarding & Profile (`/onboarding`)

Where the user tells Hiremory who they are. This profile feeds every personalized email and
the resume tailoring.

## What the user provides
- **Name** and contact details
- **Links** (LinkedIn `/in/...`, GitHub, portfolio)
- **Resume text** (`resume_text`) — pasted plain text the AI tailors to each JD
- **AI notes / memory** (`ai_notes`) — voice, preferences, and facts the AI should reuse across campaigns

## Why it matters
- The **personalization memory** (`ai_notes`) is injected into every draft so emails sound like
  *you* and stay consistent across campaigns.
- `resume_text` is the source the worker tailors into a per-JD resume PDF on a positive reply.

## Under the hood
- **File:** [`web/app/onboarding/page.tsx`](../../web/app/onboarding/page.tsx)
- **Table:** `profiles` (columns include `resume_text`, `ai_notes`) — see [database/schema.md](../database/schema.md).
- **Used by:** the compose preview ([pages/compose.md](compose.md)) and the worker's personalize/tailor steps.

## Gotchas
- LinkedIn URL must be a real profile (`linkedin.com/in/...`), not `/feed/`.
- If `resume_text` is empty, resume tailoring is skipped (the worker falls back to the stored resume file).
- A "column not found: resume_text/ai_notes" error means migrations `0010`/`0011` aren't applied.
