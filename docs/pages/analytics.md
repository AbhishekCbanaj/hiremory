# Analytics (`/analytics`)

Aggregate view of outreach performance — funnels and rates across campaigns.

## What it shows
- Funnel: **sent → replied → positive → resume-sent**.
- Rates: reply rate, positive rate, bounce rate.
- Trends over time, sourced from the `events` table the worker emits.

## Under the hood
- **File:** [`web/app/analytics/page.tsx`](../../web/app/analytics/page.tsx)
- **Tables:** `events` (per-action log) and contact/campaign status, scoped by RLS.
- **Producer:** the worker logs an event for each meaningful action (sent, replied, classified, bounced).

## Gotchas
- Analytics is only as rich as the event history — a fresh install shows little until the worker has run.
- Rates are computed from real recorded events, not estimates.
