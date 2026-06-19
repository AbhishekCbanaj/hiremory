# Database Schema

Hiremory's database is Supabase Postgres, defined as **ordered SQL migrations** in
[`supabase/migrations/`](../../supabase/migrations/). Apply them in numeric order; never edit a
migration that's already been applied — add a new one instead.

## Migrations, in order

| # | File | What it adds |
|---|---|---|
| 0001 | `0001_init.sql` | Initial schema — core tables for users, campaigns, contacts, send log |
| 0002 | `0002_storage.sql` | Resume storage policies (private `resumes` bucket) |
| 0003 | `0003_sender_profile.sql` | Per-user sender identity — each user sends *their* pitch (`profiles`) |
| 0004 | `0004_mailboxes.sql` | Provider-agnostic `mailboxes` model (`transport='smtp'` works with any provider) |
| 0005 | `0005_deliverability.sql` | Suppression list — unsubscribes & hard bounces are never emailed again |
| 0006 | `0006_worker_runs.sql` | `worker_runs` — health history + single-flight lease |
| 0007 | `0007_events.sql` | `events` — lightweight analytics for the activation funnel |
| 0008 | `0008_billing.sql` | `plan` column — drives the monthly send cap the worker enforces |
| 0009 | `0009_resumes_bucket.sql` | Ensures the `resumes` bucket exists if it wasn't created by hand |
| 0010 | `0010_personalization.sql` | `ai_notes` (per-user memory) + per-campaign `instructions` |
| 0011 | `0011_resume_tailoring.sql` | `resume_text` (base resume) + per-campaign `job_description` |

## Core tables (conceptual)

| Table | Holds |
|---|---|
| `profiles` | Sender identity: name, links, `resume_text`, `ai_notes`, plan |
| `mailboxes` | How a user sends: transport, hosts, **encrypted** secret, status |
| `campaigns` | A batch of outreach: `instructions`, `job_description` |
| contacts / recipients | Per-recipient rows with status (`queued → sent → replied → resume_sent → bounced`) |
| `suppressions` | Addresses never to email (unsubscribed or hard-bounced) |
| `worker_runs` | One row per worker invocation; holds the single-flight lease |
| `events` | Per-action log feeding analytics |

## Security model
- **Row-Level Security** on user data: each user reads only their own rows.
- The **service-role key** (worker + server actions) bypasses RLS — keep it server-side only.
- Mailbox secrets are stored **encrypted** (AES-256-GCM); the DB never holds plaintext passwords.

## Applying migrations
- **Supabase SQL editor:** paste each file's contents in order, or
- **Supabase CLI:** `supabase db push`.

A "column not found" error at runtime almost always means a migration wasn't applied — re-run
the missing ones in order. See [SUPABASE_SETUP.md](../SUPABASE_SETUP.md).
