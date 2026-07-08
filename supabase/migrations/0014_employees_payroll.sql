-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Employees & Payroll  (migration 0014)   ·   Payroll module
-- ────────────────────────────────────────────────────────────────────────────
-- The company's people + a statutory payroll engine (Zambian PAYE / NAPSA /
-- NHIMA / gratuity). Three tables:
--   • employees     — the register (master data, like products/0009): who works
--                     here, their pay, pay day, staff loan and gratuity terms.
--   • payroll_runs  — one row per pay period actually run (period = 'YYYY-MM'),
--                     carrying the period totals.
--   • payslips      — per-employee line inside a run: the full statutory
--                     breakdown, and linked_event_id → the Salary business_event
--                     posted for that person (the record bridge, same seam the
--                     Scheduler uses in 0012).
--
-- Statutory rates are NOT stored here — they live centrally in payroll.py so a
-- budget change is a one-line, AIBOS-maintained edit (the owner never touches
-- rates). Each payslip snapshots the amounts it computed, so past runs stay
-- truthful even after a rate change (a replayed history, like the event spine).
--
-- User master data: RLS self-scoped CRUD; the backend also writes via service
-- role. IDEMPOTENT & NON-DESTRUCTIVE. Reuses set_updated_at() and is_admin()
-- from migration 0001. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ── employees ────────────────────────────────────────────────────────────────
create table if not exists public.employees (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  business_id       uuid,                                  -- reserved seam (ADR-001 D2), null in v1

  name              text not null,
  position          text,
  employment_type   text not null default 'permanent',     -- permanent|contract
  status            text not null default 'active',         -- active|left
  start_date        date,
  end_date          date,                                   -- when they left

  basic_pay         numeric not null default 0,             -- monthly gross emolument, in currency
  currency          text not null default 'ZMW',
  pay_day           integer not null default 28,            -- day-of-month salary is paid (1–28)
  napsa_number      text,
  tpin              text,                                   -- ZRA taxpayer id

  gratuity_eligible boolean not null default false,         -- fixed-term contracts accrue gratuity
  gratuity_rate     numeric not null default 0.25,          -- ≥0.25 of basic (Employment Code Act s.54/73)
  contract_end      date,

  loan_balance      numeric not null default 0,             -- outstanding staff loan
  loan_monthly      numeric not null default 0,             -- deducted each run until cleared

  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── payroll_runs ─────────────────────────────────────────────────────────────
create table if not exists public.payroll_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  business_id uuid,

  period      text not null,                                -- 'YYYY-MM'
  pay_date    date,
  currency    text not null default 'ZMW',
  totals      jsonb not null default '{}'::jsonb,           -- {gross,net,paye,napsa_employee,napsa_employer,nhima_employee,loans,gratuity}
  status      text not null default 'completed',            -- completed|void

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── payslips ─────────────────────────────────────────────────────────────────
create table if not exists public.payslips (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  run_id            uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id       uuid references public.employees(id) on delete set null,

  period            text not null,                          -- denormalised 'YYYY-MM' for easy filtering
  employee_name     text,                                   -- snapshot (survives an employee delete)

  gross             numeric not null default 0,
  napsa_employee    numeric not null default 0,
  napsa_employer    numeric not null default 0,
  nhima_employee    numeric not null default 0,
  taxable           numeric not null default 0,             -- gross − napsa_employee
  paye              numeric not null default 0,
  loan_deduction    numeric not null default 0,
  other_deductions  numeric not null default 0,
  net               numeric not null default 0,
  gratuity_accrued  numeric not null default 0,             -- employer provision, not a deduction

  breakdown         jsonb not null default '{}'::jsonb,     -- rate snapshot + per-band detail
  linked_event_id   uuid references public.business_events(id) on delete set null,

  created_at        timestamptz not null default now()
);

-- Guarded constraints (added only if missing, so re-runs don't error).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_type_chk') then
    alter table public.employees add constraint employees_type_chk
      check (employment_type in ('permanent','contract'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_status_chk') then
    alter table public.employees add constraint employees_status_chk
      check (status in ('active','left'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_pay_day_chk') then
    alter table public.employees add constraint employees_pay_day_chk
      check (pay_day between 1 and 28);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payroll_runs_status_chk') then
    alter table public.payroll_runs add constraint payroll_runs_status_chk
      check (status in ('completed','void'));
  end if;
  -- One run per period per tenant — makes the pay run idempotent (upsert target).
  if not exists (select 1 from pg_constraint where conname = 'payroll_runs_user_period_uq') then
    alter table public.payroll_runs add constraint payroll_runs_user_period_uq
      unique (user_id, period);
  end if;
end $$;

-- Indexes — every read is (tenant, …).
create index if not exists employees_user_status_idx    on public.employees(user_id, status);
create index if not exists payroll_runs_user_period_idx  on public.payroll_runs(user_id, period);
create index if not exists payslips_user_run_idx         on public.payslips(user_id, run_id);
create index if not exists payslips_employee_idx         on public.payslips(employee_id) where employee_id is not null;

-- updated_at triggers (payslips are immutable once written → no trigger).
drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists payroll_runs_set_updated_at on public.payroll_runs;
create trigger payroll_runs_set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();

-- ── RLS: self-scoped CRUD + admin read (mirrors 0012) ────────────────────────
alter table public.employees    enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips     enable row level security;

-- employees
drop policy if exists employees_select_self  on public.employees;
drop policy if exists employees_insert_self  on public.employees;
drop policy if exists employees_update_self  on public.employees;
drop policy if exists employees_delete_self  on public.employees;
drop policy if exists employees_select_admin on public.employees;
create policy employees_select_self  on public.employees for select using (auth.uid() = user_id);
create policy employees_insert_self  on public.employees for insert with check (auth.uid() = user_id);
create policy employees_update_self  on public.employees for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy employees_delete_self  on public.employees for delete using (auth.uid() = user_id);
create policy employees_select_admin on public.employees for select using (public.is_admin());

-- payroll_runs
drop policy if exists payroll_runs_select_self  on public.payroll_runs;
drop policy if exists payroll_runs_insert_self  on public.payroll_runs;
drop policy if exists payroll_runs_update_self  on public.payroll_runs;
drop policy if exists payroll_runs_delete_self  on public.payroll_runs;
drop policy if exists payroll_runs_select_admin on public.payroll_runs;
create policy payroll_runs_select_self  on public.payroll_runs for select using (auth.uid() = user_id);
create policy payroll_runs_insert_self  on public.payroll_runs for insert with check (auth.uid() = user_id);
create policy payroll_runs_update_self  on public.payroll_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy payroll_runs_delete_self  on public.payroll_runs for delete using (auth.uid() = user_id);
create policy payroll_runs_select_admin on public.payroll_runs for select using (public.is_admin());

-- payslips
drop policy if exists payslips_select_self  on public.payslips;
drop policy if exists payslips_insert_self  on public.payslips;
drop policy if exists payslips_update_self  on public.payslips;
drop policy if exists payslips_delete_self  on public.payslips;
drop policy if exists payslips_select_admin on public.payslips;
create policy payslips_select_self  on public.payslips for select using (auth.uid() = user_id);
create policy payslips_insert_self  on public.payslips for insert with check (auth.uid() = user_id);
create policy payslips_update_self  on public.payslips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy payslips_delete_self  on public.payslips for delete using (auth.uid() = user_id);
create policy payslips_select_admin on public.payslips for select using (public.is_admin());

grant select, insert, update, delete on public.employees    to authenticated;
grant select, insert, update, delete on public.payroll_runs to authenticated;
grant select, insert, update, delete on public.payslips     to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0014
-- ════════════════════════════════════════════════════════════════════════════
