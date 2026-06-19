-- Phase 1: provider-agnostic mailbox model.
-- A "mailbox" is HOW a user sends. transport='smtp' works with ANY provider
-- (Gmail app password, Outlook, Zoho…) with no Google verification — this is
-- what lets the product be globally self-serve. transport='gmail_oauth' reuses
-- the existing gmail_tokens flow for one-click Gmail users.
create table if not exists public.mailboxes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  transport       text not null default 'smtp',     -- 'smtp' | 'gmail_oauth'
  from_name       text,
  email           text not null,                    -- address mail is sent from / IMAP login
  smtp_host       text,
  smtp_port       int  default 465,
  imap_host       text,
  imap_port       int  default 993,
  secret_enc      text,                             -- AES-256-GCM(app password); never plaintext
  daily_cap       int  not null default 30,         -- conservative start; warmup raises it
  warmup_day      int  not null default 0,
  status          text not null default 'active',   -- active | paused | error
  last_error      text,
  verified_at     timestamptz,                      -- last successful SMTP/IMAP handshake
  created_at      timestamptz not null default now()
);
alter table public.mailboxes enable row level security;

-- Users manage their own mailboxes. secret_enc is encrypted, so even though the
-- row is readable by its owner, the credential itself is never exposed in clear.
create policy "mailboxes: all own" on public.mailboxes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists mailboxes_user_idx on public.mailboxes (user_id);

-- link each send to the mailbox that sent it (nullable for legacy rows)
alter table public.send_log
  add column if not exists mailbox_id uuid references public.mailboxes (id) on delete set null;
