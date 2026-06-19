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
