-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Business Events  (migration 0005)   ·   Evolution spine
-- ────────────────────────────────────────────────────────────────────────────
-- Implements RFC-001 (docs/evolution/01_BUSINESS_EVENT_SCHEMA.md): the canonical,
-- append-only log of Business Events — the atomic unit of AIBOS (Bible Ch.5).
--
-- IDEMPOTENT & NON-DESTRUCTIVE: create-if-not-exists + add-column-if-not-exists,
-- safe to re-run. Tenant key is `user_id` (ADR-001 D2), mirroring usage_events;
-- a reserved nullable `business_id` is the future multi-branch seam (unused now).
-- Reuses the existing public.set_updated_at() and is_admin() from migration 0001.
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. business_events ───────────────────────────────────────────────────────
create table if not exists public.business_events (
  id             uuid primary key default gen_random_uuid(),
  schema_version integer     not null default 1,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  business_id    uuid,                                  -- reserved seam (ADR-001 D2), null in v1

  event_type     text        not null,                 -- see check below (RFC-001 §2)
  occurred_at    timestamptz not null default now(),   -- when it happened in the business
  recorded_at    timestamptz not null default now(),   -- when AIBOS captured it

  source         text        not null default 'manual',-- manual|voice|receipt|qr|excel|csv|pos|api
  confidence     numeric     not null default 1.0,      -- 0..1
  status         text        not null default 'pending',-- pending|confirmed|void

  payload        jsonb       not null default '{}'::jsonb,
  corrections    jsonb       not null default '{}'::jsonb,  -- user edits → Business Memory (Init 13)
  audit          jsonb       not null default '[]'::jsonb,  -- append-only history (Init 5)

  created_by     uuid,                                  -- acting user (= user_id in v1)
  reversed_by    uuid,                                  -- the event that voids this one, if any

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Guarded constraints (added only if missing, so re-runs don't error).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'business_events_type_chk') then
    alter table public.business_events add constraint business_events_type_chk
      check (event_type in (
        'Sale','Purchase','Expense','InventoryReceipt','InventoryAdjustment',
        'Salary','SupplierPayment','CustomerPayment','AssetPurchase',
        'TaxPayment','Loan','Refund','Transfer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_events_status_chk') then
    alter table public.business_events add constraint business_events_status_chk
      check (status in ('pending','confirmed','void'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_events_source_chk') then
    alter table public.business_events add constraint business_events_source_chk
      check (source in ('manual','voice','receipt','qr','excel','csv','pos','api'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_events_conf_chk') then
    alter table public.business_events add constraint business_events_conf_chk
      check (confidence >= 0 and confidence <= 1);
  end if;
end $$;

-- Indexes: the timeline reads by user newest-first; the twin folds by user+time;
-- status filters confirmed-only into the projection.
create index if not exists business_events_user_idx     on public.business_events(user_id);
create index if not exists business_events_occurred_idx  on public.business_events(user_id, occurred_at desc);
create index if not exists business_events_status_idx    on public.business_events(user_id, status);
create index if not exists business_events_type_idx      on public.business_events(user_id, event_type);

-- updated_at trigger (reuse the function defined in migration 0001).
drop trigger if exists business_events_set_updated_at on public.business_events;
create trigger business_events_set_updated_at
  before update on public.business_events
  for each row execute function public.set_updated_at();

-- ── 2. Row Level Security ────────────────────────────────────────────────────
-- Same proven pattern as usage_events: a user sees & writes only their own rows;
-- admins may read all. The service-role backend bypasses RLS (ADR-001 D4) and is
-- responsible for scoping every query to a JWT-verified user_id.
alter table public.business_events enable row level security;

drop policy if exists business_events_select_self  on public.business_events;
drop policy if exists business_events_select_admin on public.business_events;
drop policy if exists business_events_insert_self  on public.business_events;
drop policy if exists business_events_update_self  on public.business_events;

create policy business_events_select_self  on public.business_events
  for select using (auth.uid() = user_id);
create policy business_events_select_admin on public.business_events
  for select using (public.is_admin());
-- Direct client writes are allowed but self-scoped; the primary write path is the
-- backend pipeline (service role). No DELETE policy — events are soft-voided, never
-- hard-deleted (Initiative 5 audit trail).
create policy business_events_insert_self  on public.business_events
  for insert with check (auth.uid() = user_id);
create policy business_events_update_self  on public.business_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.business_events to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0005
-- ════════════════════════════════════════════════════════════════════════════
