-- Resume tailoring: the user's base resume as text + a per-campaign job
-- description. The worker tailors the resume to the JD and attaches a generated
-- PDF when a recruiter replies positively.
alter table public.profiles
  add column if not exists resume_text text;   -- base resume, pasted as plain text

alter table public.campaigns
  add column if not exists job_description text;  -- JD to tailor the resume against
