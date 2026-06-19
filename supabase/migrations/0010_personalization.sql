-- Personalization v1: per-user memory + per-campaign AI instructions.
-- These are injected into the (shared) Claude prompt at write-time — the model
-- is the same for everyone; only the CONTEXT is per-user. No per-user training.
alter table public.profiles
  add column if not exists ai_notes text;     -- free-form "remember this about me"

alter table public.campaigns
  add column if not exists instructions text;  -- per-campaign tone/asks the user tuned in preview
