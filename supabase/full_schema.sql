-- Hiremory — full schema (all migrations 0001–0014 combined).
-- Paste into Supabase SQL Editor on a fresh project and Run.
-- Idempotent: 'already exists' notices are safe.


-- ============================================================
-- 0001_init.sql
-- ============================================================

-- Hiremory initial schema
-- Run in Supabase SQL editor (or via `supabase db push`).
-- Security: RLS on every table; users only ever see their own rows;
-- Gmail tokens are locked to the service role (the worker), never the browser.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- gmail_tokens
-- Sensitive. RLS enabled with NO policies => unreachable by anon/authenticated.
-- Only the service-role worker (which bypasses RLS) can read/write these.
create table if not exists public.gmail_tokens (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  refresh_token  text,            -- encrypt at the app layer before storing
  access_token   text,
  expiry         timestamptz,
  updated_at     timestamptz not null default now()
);
alter table public.gmail_tokens enable row level security;

-- ------------------------------------------------------------------ resumes
create table if not exists public.resumes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  label         text,             -- e.g. "Data Analyst", "ML"
  storage_path  text not null,    -- path in the 'resumes' bucket
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.resumes enable row level security;

create policy "resumes: all own" on public.resumes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- campaigns
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Untitled campaign',
  mode        text not null default 'quick',     -- 'quick' | 'bulk'
  status      text not null default 'draft',     -- draft | sending | done | paused
  created_at  timestamptz not null default now()
);
alter table public.campaigns enable row level security;

create policy "campaigns: all own" on public.campaigns
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------- contacts
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  campaign_id  uuid references public.campaigns (id) on delete cascade,
  name         text,
  first_name   text,
  email        text not null,
  title        text,
  company      text,
  created_at   timestamptz not null default now()
);
alter table public.contacts enable row level security;

create policy "contacts: all own" on public.contacts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists contacts_campaign_idx on public.contacts (campaign_id);
create unique index if not exists contacts_user_email_campaign_uidx
  on public.contacts (user_id, campaign_id, email);

-- ---------------------------------------------------------------- send_log
create table if not exists public.send_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  campaign_id     uuid references public.campaigns (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete cascade,
  email           text not null,
  company         text,
  subject         text,
  resume_path     text,
  message_id      text,
  thread_id       text,
  followup_count  int not null default 0,
  status          text not null default 'sent',  -- sent|replied|resume_sent|not_now|bounced
  sent_at         timestamptz not null default now(),
  last_action_at  timestamptz not null default now()
);
alter table public.send_log enable row level security;

create policy "send_log: all own" on public.send_log
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists send_log_user_idx on public.send_log (user_id);
create index if not exists send_log_status_idx on public.send_log (status);


-- ============================================================
-- 0002_storage.sql
-- ============================================================

-- Resume storage. Create a PRIVATE bucket named 'resumes' in the dashboard
-- (Storage -> New bucket -> uncheck "Public"), then run this.
-- Each user can only touch files under a folder named after their own uid:
--   resumes/<auth.uid()>/<filename>.pdf
-- Upsert needs INSERT + SELECT + UPDATE; we add DELETE so users can remove files.

create policy "resumes: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes'
         and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ============================================================
-- 0003_sender_profile.sql
-- ============================================================

-- Track B: per-user sender identity, so each user sends THEIR pitch (not the
-- hardcoded engine config). The worker reads these to build every email.
-- RLS already covers profiles (read/update own); the worker uses service role.

alter table public.profiles
  add column if not exists phone         text,
  add column if not exists linkedin_url  text,
  add column if not exists github_url    text,
  add column if not exists location      text,
  add column if not exists headline      text,   -- roles sought, e.g. "Data / Product Analytics roles"
  add column if not exists intro_line    text,   -- opening line, e.g. "a Data Analyst with experience at Practo"
  add column if not exists pitch_points  text[] default '{}',  -- 3-5 proof bullets
  add column if not exists availability  text default 'available to join immediately',
  add column if not exists attach_resume boolean not null default false,
  add column if not exists onboarded     boolean not null default false;


-- ============================================================
-- 0004_mailboxes.sql
-- ============================================================

-- Phase 1: provider-agnostic mailbox model.
-- A "mailbox" is HOW a user sends. transport='smtp' works with ANY provider
-- (Gmail app password, Outlook, Zoho…) with no Google verification — this is
-- what lets the product be globally self-serve. transport='gmail_oauth' reuses
-- the existing gmail_tokens flow for one-click Gmail users.
create table if not exists public.mailboxes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  transport       text not null default 'smtp',     -- 'smtp' | 'gmail_oauth'
  from_name       text,
  email           text not null,                    -- address mail is sent from / IMAP login
  smtp_host       text,
  smtp_port       int  default 465,
  imap_host       text,
  imap_port       int  default 993,
  secret_enc      text,                             -- AES-256-GCM(app password); never plaintext
  daily_cap       int  not null default 30,         -- conservative start; warmup raises it
  warmup_day      int  not null default 0,
  status          text not null default 'active',   -- active | paused | error
  last_error      text,
  verified_at     timestamptz,                      -- last successful SMTP/IMAP handshake
  created_at      timestamptz not null default now()
);
alter table public.mailboxes enable row level security;

-- Users manage their own mailboxes. secret_enc is encrypted, so even though the
-- row is readable by its owner, the credential itself is never exposed in clear.
create policy "mailboxes: all own" on public.mailboxes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists mailboxes_user_idx on public.mailboxes (user_id);

-- link each send to the mailbox that sent it (nullable for legacy rows)
alter table public.send_log
  add column if not exists mailbox_id uuid references public.mailboxes (id) on delete set null;


-- ============================================================
-- 0005_deliverability.sql
-- ============================================================

-- Phase 2: deliverability + compliance.
-- Suppression list: anyone who unsubscribes (or hard-bounces) is never emailed
-- again by that user. Required for CAN-SPAM / GDPR / India DPDP.
create table if not exists public.suppressions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text not null,
  reason      text not null default 'unsubscribe',  -- unsubscribe | bounce | complaint
  created_at  timestamptz not null default now(),
  unique (user_id, email)
);
alter table public.suppressions enable row level security;

-- Owners can see their own suppressions. Inserts happen from the public
-- unsubscribe route via the service role (which bypasses RLS), so no insert
-- policy is needed for anon users.
create policy "suppressions: read own" on public.suppressions
  for select to authenticated using ((select auth.uid()) = user_id);

create index if not exists suppressions_user_email_idx
  on public.suppressions (user_id, email);


-- ============================================================
-- 0006_worker_runs.sql
-- ============================================================

-- Phase 3: reliability + observability.
-- One row per worker invocation: health history + a single-flight lease so two
-- runs (e.g. cron + a manual local run) never process the same data at once.
create table if not exists public.worker_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',  -- running | done | error
  host         text,
  sent         int not null default 0,
  replies      int not null default 0,
  followups    int not null default 0,
  bounces      int not null default 0,
  errors       int not null default 0,
  detail       text
);
-- Internal/operational. RLS on, no policies -> only the service-role worker
-- (and a future admin view) can touch it.
alter table public.worker_runs enable row level security;

create index if not exists worker_runs_started_idx on public.worker_runs (started_at desc);


-- ============================================================
-- 0007_events.sql
-- ============================================================

-- Phase 5: lightweight analytics event log for the activation funnel.
-- Deliverability metrics are derived from send_log/suppressions (single source of
-- truth); this table captures product milestones that aren't otherwise recorded.
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,          -- profile_completed | mailbox_connected | ...
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.events enable row level security;

create policy "events: insert own" on public.events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "events: read own" on public.events
  for select to authenticated using ((select auth.uid()) = user_id);

create index if not exists events_user_name_idx on public.events (user_id, name);


-- ============================================================
-- 0008_billing.sql
-- ============================================================

-- Phase 6: monetization. Plan drives the monthly send cap the worker enforces.
-- Free by default; upgraded by the Stripe webhook on checkout.
alter table public.profiles
  add column if not exists plan               text not null default 'free',  -- free | pro | teams
  add column if not exists plan_status        text,            -- active | past_due | canceled
  add column if not exists stripe_customer_id text,
  add column if not exists plan_renews_at     timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);


-- ============================================================
-- 0009_resumes_bucket.sql
-- ============================================================

-- QA fix: 0002 assumed the 'resumes' bucket was created by hand in the dashboard.
-- If it wasn't, resume upload (compose) and the worker's resume download both fail
-- with "Bucket not found". Create it here so setup is self-contained. Idempotent.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;


-- ============================================================
-- 0010_personalization.sql
-- ============================================================

-- Personalization v1: per-user memory + per-campaign AI instructions.
-- These are injected into the (shared) Claude prompt at write-time — the model
-- is the same for everyone; only the CONTEXT is per-user. No per-user training.
alter table public.profiles
  add column if not exists ai_notes text;     -- free-form "remember this about me"

alter table public.campaigns
  add column if not exists instructions text;  -- per-campaign tone/asks the user tuned in preview


-- ============================================================
-- 0011_resume_tailoring.sql
-- ============================================================

-- Resume tailoring: the user's base resume as text + a per-campaign job
-- description. The worker tailors the resume to the JD and attaches a generated
-- PDF when a recruiter replies positively.
alter table public.profiles
  add column if not exists resume_text text;   -- base resume, pasted as plain text

alter table public.campaigns
  add column if not exists job_description text;  -- JD to tailor the resume against


-- ============================================================
-- 0012_topups_billing.sql
-- ============================================================

-- Phase 6b: one-time top-up credits + Razorpay support + payment audit/idempotency.
-- Builds on 0008 (plan, plan_status, stripe_customer_id, plan_renews_at).

alter table public.profiles
  add column if not exists email_credits            integer not null default 0,  -- one-time top-up credits, consumed beyond the monthly plan cap
  add column if not exists billing_provider         text,                        -- stripe | razorpay (which provider this user pays through)
  add column if not exists razorpay_customer_id     text,
  add column if not exists razorpay_subscription_id text;

create index if not exists profiles_razorpay_customer_idx
  on public.profiles (razorpay_customer_id);

-- Every fulfilled payment is logged here. The unique (provider, provider_ref)
-- makes webhook processing idempotent — a redelivered event can't double-credit
-- or double-upgrade. Webhooks write via the service role (bypasses RLS).
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  provider      text not null,            -- stripe | razorpay
  provider_ref  text not null,            -- event/payment id used as the idempotency key
  kind          text not null,            -- subscription | topup
  amount        integer,                  -- minor units (paise / cents)
  currency      text,
  credits_added integer not null default 0,
  status        text,
  created_at    timestamptz not null default now(),
  unique (provider, provider_ref)
);

alter table public.payments enable row level security;

create policy "payments: read own" on public.payments
  for select to authenticated using ((select auth.uid()) = user_id);

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);


-- ============================================================
-- 0013_email_templates.sql
-- ============================================================

-- Email templates: the user picks an email type per campaign, and the AI tailors
-- the matching template. These few extras feed the chosen template's placeholders.
alter table public.campaigns
  add column if not exists email_type    text not null default 'posting',  -- posting | speculative | referral
  add column if not exists role_title    text,   -- role applying for (posting / referral)
  add column if not exists apply_source  text,   -- where the posting was seen (posting)
  add column if not exists referrer_name text;   -- who referred them (referral)


-- ============================================================
-- 0014_profile_jobprefs.sql
-- ============================================================

-- Resume-first onboarding: job-seeker fields recruiters usually ask for.
-- (full_name/phone/linkedin/github/headline/pitch_points/resume_text already exist
--  from 0001/0003/0011 — the resume parser fills those automatically.)
alter table public.profiles
  add column if not exists open_to_relocation boolean not null default false,
  add column if not exists current_salary     text,
  add column if not exists expected_salary    text,
  add column if not exists notice_period      text,
  add column if not exists total_experience   text,   -- e.g. "3 years"
  add column if not exists achievements       text;   -- optional free-text highlights
