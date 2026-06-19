-- Phase 6: monetization. Plan drives the monthly send cap the worker enforces.
-- Free by default; upgraded by the Stripe webhook on checkout.
alter table public.profiles
  add column if not exists plan               text not null default 'free',  -- free | pro | teams
  add column if not exists plan_status        text,            -- active | past_due | canceled
  add column if not exists stripe_customer_id text,
  add column if not exists plan_renews_at     timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);
