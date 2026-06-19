# Compose (`/compose`)

Where a campaign is created: pick recipients, review the personalized email, optionally tailor
a resume to a job description, and queue it for sending.

## What the user does
1. **Add recipients** — two modes:
   - **Bulk:** upload a CSV of HR contacts (name, email, title, company). PDF/Excel are not supported — CSV only.
   - **Quick:** paste a handful of emails (commas or new lines).
2. **Review the email** — the AI drafts a personalized message; the user can edit wording, set tone, and add per-campaign **instructions**.
3. **Tailor a resume (optional)** — paste a **job description**; Hiremory previews a JD-tailored resume.
4. **Save** — the campaign + recipients are queued; the worker sends them on its next run.

## Under the hood
- **File:** [`web/app/compose/page.tsx`](../../web/app/compose/page.tsx)
- **Preview component:** [`web/components/EmailPreview.tsx`](../../web/components/EmailPreview.tsx) — live draft, tone chips, instructions box.
- **Email preview API:** `web/app/api/email/preview/route.ts` — Gemini → Claude → template.
- **Resume tailor API:** [`web/app/api/resume/tailor/route.ts`](../../web/app/api/resume/tailor/route.ts) — returns `{summary, sections}`.
- **Tables:** `campaigns` (stores `instructions`, `job_description`) and the recipients/contacts rows.

## How personalization works
The preview calls the AI with the user's profile (`ai_notes` memory) + the contact + any
campaign instructions. No AI key → a solid template is used instead. See [configuration.md](../configuration.md).

## Gotchas
- **Bulk only accepts CSV.** Non-CSV uploads fail with an honest error by design.
- **Resume tailoring needs an AI key** — it can't be done by a static template; without a key the UI says so.
- `gemini-2.5-flash` needs `thinkingBudget: 0` and a high `maxOutputTokens` (4000) or long resumes truncate.
