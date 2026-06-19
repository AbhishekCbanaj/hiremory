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
