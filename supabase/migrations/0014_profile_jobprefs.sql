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
