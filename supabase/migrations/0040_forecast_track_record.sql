-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: the forecast's track record  (migration 0040)
-- ────────────────────────────────────────────────────────────────────────────
-- The Forecast page says how accurate the forecast has been on the owner's
-- past months, tested after the fact. That is a backtest: honest, but worked
-- out today, by AIBOS, about months it already knew. An owner trusts a
-- forecast they have watched come true.
--
-- So once a month AIBOS keeps what it said, before the month happens:
--
--   * sales_month  next month's sales, the cautious and hopeful ends of the
--                  range and the likely figure (aibos-api outlook.py);
--   * cash_week4   for Growth, the money at the end of week 4 of the 13-week
--                  cash plan (aibos-api cash_plan.py).
--
-- When the month (or the day) has passed, GET /forecast/track-record holds
-- each kept forecast against the confirmed books: the actual, whether it fell
-- inside the range, and how often it has.
--
-- One row per business, per kind, per month it was kept: the hourly jobs can
-- run as often as they like and the month's forecast is kept once. A kept
-- forecast is never rewritten (the trigger below refuses any update), so the
-- record cannot be tidied after the fact.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.forecast_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid not null,
  -- The month the forecast was kept in, 'YYYY-MM' (Lusaka time).
  month        text not null,
  kind         text not null,
  -- What it is a forecast of: a month 'YYYY-MM' for sales, a day
  -- 'YYYY-MM-DD' (the close of week 4) for cash.
  target       text not null,
  p10          numeric not null,
  p50          numeric not null,
  p90          numeric not null,
  -- How it was made: months of history, methods, the money it started from.
  detail       jsonb not null default '{}'::jsonb,
  made_at      timestamptz not null default now(),
  constraint forecast_snapshots_once unique (user_id, business_id, kind, month),
  constraint forecast_snapshots_kind_chk check (kind in ('sales_month', 'cash_week4')),
  constraint forecast_snapshots_range_chk check (p10 <= p50 and p50 <= p90)
);

create index if not exists forecast_snapshots_business_idx
  on public.forecast_snapshots (user_id, business_id, kind, target);

comment on table public.forecast_snapshots is
  'What AIBOS forecast, kept once a month before it happened, so the track record is earned and never rewritten.';

-- ── A kept forecast is never rewritten ──────────────────────────────────────
create or replace function public.forecast_snapshots_keep()
returns trigger language plpgsql as $$
begin
  raise exception 'A kept forecast is never rewritten (forecast_snapshots %).', old.id;
end $$;

drop trigger if exists forecast_snapshots_keep on public.forecast_snapshots;
create trigger forecast_snapshots_keep
  before update on public.forecast_snapshots
  for each row execute function public.forecast_snapshots_keep();

-- ── RLS: an owner reads their own; the API writes ──────────────────────────
alter table public.forecast_snapshots enable row level security;

drop policy if exists forecast_snapshots_select_self on public.forecast_snapshots;
create policy forecast_snapshots_select_self on public.forecast_snapshots
  for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0040
-- ════════════════════════════════════════════════════════════════════════════
