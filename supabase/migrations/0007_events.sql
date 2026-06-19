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
