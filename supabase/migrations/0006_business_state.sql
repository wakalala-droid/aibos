-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Business State / Digital Twin  (migration 0006)   ·   Evolution spine
-- ────────────────────────────────────────────────────────────────────────────
-- The Digital Twin (Directive Initiative 12): a DERIVED, rebuildable projection of
-- the current state of the business — one row per user_id. It is NOT a source of
-- record; business_events is. The twin can be fully reconstructed by replaying the
-- event log (ADR-001 D5), which also gives us free rollback.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Reuses public.set_updated_at() and is_admin().
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.business_state (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  currency       text        not null default 'ZMW',

  -- Seed (Phase 3 wizard "initial cash"); cash = opening_cash + net cash flow.
  opening_cash   numeric     not null default 0,
  cash           numeric     not null default 0,

  -- Profit & Loss (confirmed events only).
  total_revenue  numeric     not null default 0,
  total_costs    numeric     not null default 0,
  total_profit   numeric     not null default 0,
  avg_margin     numeric     not null default 0,        -- percentage

  -- Balances.
  receivables    numeric     not null default 0,        -- owed to the business
  payables       numeric     not null default 0,        -- owed by the business
  inventory_value numeric    not null default 0,
  assets_value   numeric     not null default 0,
  liabilities    numeric     not null default 0,

  -- Counts.
  customers      integer     not null default 0,
  suppliers      integer     not null default 0,
  employees      integer     not null default 0,

  -- Health (mirrors engine1: clamp(avg_margin * 2.5, 0, 100)).
  health_score   integer     not null default 0,
  health_label   text        not null default 'No Data',

  -- Monthly P&L bridge for the existing engines / store (RFC-001 §7).
  -- [{month, revenue, costs}] — store.toMonthlyRows() accepts these lowercase keys.
  monthly        jsonb       not null default '[]'::jsonb,

  -- Bookkeeping.
  event_count    integer     not null default 0,        -- confirmed events folded in
  last_event_id  uuid,
  last_event_at  timestamptz,
  rebuilt_at     timestamptz,
  updated_at     timestamptz not null default now()
);

drop trigger if exists business_state_set_updated_at on public.business_state;
create trigger business_state_set_updated_at
  before update on public.business_state
  for each row execute function public.set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.business_state enable row level security;

drop policy if exists business_state_select_self  on public.business_state;
drop policy if exists business_state_select_admin on public.business_state;

-- Read-only to clients (the Timeline/dashboard may read the twin directly via RLS).
-- All WRITES happen through the backend projector (service role) so the twin always
-- equals a fold over the event log — no client may set business state by hand.
create policy business_state_select_self  on public.business_state
  for select using (auth.uid() = user_id);
create policy business_state_select_admin on public.business_state
  for select using (public.is_admin());

grant select on public.business_state to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0006
-- ════════════════════════════════════════════════════════════════════════════
