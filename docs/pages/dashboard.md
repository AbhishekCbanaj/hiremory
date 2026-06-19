# Dashboard (`/dashboard`)

The at-a-glance home once signed in: where every campaign and contact stands.

## What it shows
- Campaign overview and per-contact status: **queued → sent → replied → resume-sent → bounced**.
- Quick links into Compose, Replies, Follow-ups, Mailbox, and Profile.

## Where the numbers come from
The worker writes status as it processes each phase; the dashboard reads it back from Postgres
(scoped to the signed-in user by Row-Level Security). It does **not** send anything itself —
it's a read view over what the worker has done.

## Under the hood
- **File:** [`web/app/dashboard/page.tsx`](../../web/app/dashboard/page.tsx)
- **Tables:** contacts/recipients (status), `campaigns`, `worker_runs` (last run), `events`.
- **Producer:** the worker — see [worker/overview.md](../worker/overview.md).

## Gotchas
- If statuses never advance past **queued**, the worker isn't running — start it locally or check
  the GitHub Actions cron.
- Counts are honest: only states the worker actually recorded (no optimistic UI).
