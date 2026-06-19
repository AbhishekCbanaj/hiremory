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
