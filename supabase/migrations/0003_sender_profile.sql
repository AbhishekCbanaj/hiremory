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
