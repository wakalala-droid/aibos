-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Budgets & targets  (migration 0024)  ·  audit item #37
-- ────────────────────────────────────────────────────────────────────────────
-- Variance today only compares month-over-month. A budget lets the owner
-- compare actuals against a PLAN — "I aimed for K50,000 revenue, K30,000
-- costs this month; where am I?" One row per (business, month, metric).
--
-- Actuals are DERIVED from the twin/events on read (never stored); this table
-- holds only the targets the owner set. Business-scoped from birth (audit #16).
-- IDEMPOTENT & NON-DESTRUCTIVE, house conventions. Run in the Supabase editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  business_id uuid,                                   -- multi-business scope
  month       text        not null,                   -- 'YYYY-MM'
  metric      text        not null,                   -- revenue|costs|profit
  target      numeric     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'budgets_metric_chk') then
    alter table public.budgets add constraint budgets_metric_chk
      check (metric in ('revenue','costs','profit'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'budgets_uq') then
    alter table public.budgets add constraint budgets_uq
      unique (user_id, business_id, month, metric);
  end if;
end $$;

create index if not exists budgets_user_month_idx on public.budgets(user_id, month);

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;
drop policy if exists budgets_select_self on public.budgets;
drop policy if exists budgets_write_self  on public.budgets;
drop policy if exists budgets_select_admin on public.budgets;
create policy budgets_select_self on public.budgets for select using (auth.uid() = user_id);
create policy budgets_write_self  on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy budgets_select_admin on public.budgets for select using (public.is_admin());
grant select, insert, update, delete on public.budgets to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0024
-- ════════════════════════════════════════════════════════════════════════════
