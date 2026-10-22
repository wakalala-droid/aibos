-- ═══════════════════════════════════════════════════════════════════════════
-- AI-BOS: Teach AIBOS your business  (migration 0041)
-- ───────────────────────────────────────────────────────────────────────────
-- A new owner's books start empty, and an empty book tells AIBOS nothing about
-- the business behind it: how old it is, what it sells, which months are busy,
-- what the owner is aiming for. So AIBOS interviews the owner, one question at
-- a time (aibos-api interview.py), and keeps the answers here:
--
--   * answers   {question id: {value, text, at} | {skipped: true, at}}, the
--               owner's own words kept beside what AIBOS read from them;
--   * the AI chat reads them on every question, so it answers about THIS
--     business instead of a generic one;
--   * the money goals become a month-by-month plan in budgets, written only
--     when the owner presses confirm (plan_applied_at), never over a target
--     they already set.
--
-- One row per business: an owner with two businesses tells AIBOS about each.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.business_interviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  business_id      uuid not null,
  answers          jsonb not null default '{}'::jsonb,
  started_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Set when every question has been answered or skipped.
  finished_at      timestamptz,
  -- Set when the owner turned their goals into monthly targets.
  plan_applied_at  timestamptz,
  constraint business_interviews_once unique (user_id, business_id)
);

create index if not exists business_interviews_owner_idx
  on public.business_interviews (user_id);

comment on table public.business_interviews is
  'What the owner told AIBOS about the business: its story, what it sells, how money moves and the goals. Read by the AI chat.';

-- ── RLS: an owner reads their own; the API writes ──────────────────────────
alter table public.business_interviews enable row level security;

drop policy if exists business_interviews_select_self on public.business_interviews;
create policy business_interviews_select_self on public.business_interviews
  for select using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- End migration 0041
-- ═══════════════════════════════════════════════════════════════════════════
