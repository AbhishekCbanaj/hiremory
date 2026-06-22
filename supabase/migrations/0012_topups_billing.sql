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
