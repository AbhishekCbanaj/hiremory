-- Email templates: the user picks an email type per campaign, and the AI tailors
-- the matching template. These few extras feed the chosen template's placeholders.
alter table public.campaigns
  add column if not exists email_type    text not null default 'posting',  -- posting | speculative | referral
  add column if not exists role_title    text,   -- role applying for (posting / referral)
  add column if not exists apply_source  text,   -- where the posting was seen (posting)
  add column if not exists referrer_name text;   -- who referred them (referral)
