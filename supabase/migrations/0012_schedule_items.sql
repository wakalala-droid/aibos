-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Schedule items  (migration 0012)   ·   Scheduler
-- ────────────────────────────────────────────────────────────────────────────
-- Time-bound commitments: meetings, pick-ups, deliveries, deadlines (ZRA/NAPSA),
-- payments due, reminders. A schedule item is a COMMITMENT, not a business fact —
-- it lives outside business_events, but completing a pick-up/payment can create
-- the matching event, linked via linked_event_id (the record bridge).
--
-- Recurrence is a rule on the row (freq/interval/until jsonb) expanded at read
-- time in the backend. Completing a recurring item materialises the finished
-- occurrence as its own child row (parent_id → the recurring template) and
-- rolls the template's starts_at forward — so past occurrences stay queryable
-- ("which NAPSA payments did I miss last quarter?" is a plain filter) and each
-- occurrence carries its own linked_event_id.
--
-- Like products (0009), this is user master data: RLS self-scoped CRUD; the
-- backend also writes via service role. IDEMPOTENT & NON-DESTRUCTIVE. Reuses
-- set_updated_at() and is_admin() from migration 0001.
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.schedule_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  business_id           uuid,                                  -- reserved seam (ADR-001 D2), null in v1

  kind                  text not null default 'reminder',      -- see check below
  title                 text not null,
  notes                 text,
  location              text,
  with_whom             text,                                  -- customer/supplier name (single-user tenants — no invites)
  amount                numeric,                               -- optional ZMW value → powers the record bridge

  starts_at             timestamptz not null,
  ends_at               timestamptz,                           -- null for instants (deadlines)
  all_day               boolean not null default false,

  recurrence            jsonb,                                 -- null or {freq, interval, until} — RRULE-lite
  remind_minutes_before integer,

  status                text not null default 'scheduled',     -- scheduled|done|missed|cancelled
  parent_id             uuid references public.schedule_items(id) on delete set null,  -- recurring template this occurrence came from
  linked_event_id       uuid references public.business_events(id) on delete set null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Guarded constraints (added only if missing, so re-runs don't error).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schedule_items_kind_chk') then
    alter table public.schedule_items add constraint schedule_items_kind_chk
      check (kind in ('meeting','pickup','delivery','deadline','payment_due','reminder','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schedule_items_status_chk') then
    alter table public.schedule_items add constraint schedule_items_status_chk
      check (status in ('scheduled','done','missed','cancelled'));
  end if;
end $$;

-- An earlier draft of this migration lacked parent_id — upgrade in place if so.
alter table public.schedule_items
  add column if not exists parent_id uuid references public.schedule_items(id) on delete set null;

-- Range queries are always (tenant, time) — one composite index covers them.
create index if not exists schedule_items_user_starts_idx
  on public.schedule_items(user_id, starts_at);
-- Per-template occurrence history ("all my NAPSA completions").
create index if not exists schedule_items_parent_idx
  on public.schedule_items(parent_id) where parent_id is not null;

drop trigger if exists schedule_items_set_updated_at on public.schedule_items;
create trigger schedule_items_set_updated_at
  before update on public.schedule_items
  for each row execute function public.set_updated_at();

alter table public.schedule_items enable row level security;

drop policy if exists schedule_items_select_self  on public.schedule_items;
drop policy if exists schedule_items_insert_self  on public.schedule_items;
drop policy if exists schedule_items_update_self  on public.schedule_items;
drop policy if exists schedule_items_delete_self  on public.schedule_items;
drop policy if exists schedule_items_select_admin on public.schedule_items;

create policy schedule_items_select_self  on public.schedule_items for select using (auth.uid() = user_id);
create policy schedule_items_insert_self  on public.schedule_items for insert with check (auth.uid() = user_id);
create policy schedule_items_update_self  on public.schedule_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy schedule_items_delete_self  on public.schedule_items for delete using (auth.uid() = user_id);
create policy schedule_items_select_admin on public.schedule_items for select using (public.is_admin());

grant select, insert, update, delete on public.schedule_items to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0012
-- ════════════════════════════════════════════════════════════════════════════
