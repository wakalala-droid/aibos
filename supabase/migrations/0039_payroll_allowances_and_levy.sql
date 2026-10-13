-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: payroll as ZRA, NAPSA and NHIMA count it  (migration 0039)
-- ────────────────────────────────────────────────────────────────────────────
-- A client said AIBOS worked out only half the NAPSA. The payroll table showed
-- the employee's 5% alone, and checking every rule behind it found more:
--
--   * PAYE and NAPSA are worked on GROSS pay (basic plus every cash allowance)
--     and NHIMA on BASIC pay only. An employee had one "monthly pay" figure, so
--     either NAPSA and PAYE missed the allowances or NHIMA was taken on them.
--     employees.allowances keeps the two apart.
--   * NAPSA stops at the retirement age of 60. employees.napsa_exempt says so.
--   * The Skills Development Levy (0.5% of gross, paid by the employer) was
--     never worked out. An employer with turnover under K800,000 a year does
--     not pay it; profiles.payroll_sdl is the owner's answer ('auto' works it
--     out from the sales in their books).
--
-- And indexes for the look-ups every payment now makes in business_events:
-- the idempotency key (client_ref) that stops a retried save posting twice,
-- and the references that tie a payment to its stay, invoice or provider.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Employees: allowances and the NAPSA age stop ────────────────────────────
alter table public.employees add column if not exists allowances   numeric not null default 0;
alter table public.employees add column if not exists napsa_exempt boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_allowances_chk') then
    alter table public.employees add constraint employees_allowances_chk check (allowances >= 0);
  end if;
end $$;

comment on column public.employees.basic_pay is
  'Basic salary a month. NHIMA is 1% of this; PAYE and NAPSA are on basic_pay + allowances.';
comment on column public.employees.allowances is
  'Regular cash allowances a month (housing, transport...). Counted by PAYE and NAPSA, not NHIMA.';
comment on column public.employees.napsa_exempt is
  'True when the employee no longer contributes to NAPSA (aged 60 or over).';

-- ── The owner's answer on the Skills Development Levy ───────────────────────
alter table public.profiles add column if not exists payroll_sdl text not null default 'auto';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_payroll_sdl_chk') then
    alter table public.profiles add constraint profiles_payroll_sdl_chk
      check (payroll_sdl in ('auto', 'pays', 'exempt'));
  end if;
end $$;

-- ── Look-ups every payment makes ────────────────────────────────────────────
create index if not exists business_events_client_ref_idx
  on public.business_events (user_id, (payload->>'client_ref'))
  where payload ? 'client_ref';

create index if not exists business_events_booking_ref_idx
  on public.business_events (user_id, (payload->>'booking_id'))
  where payload ? 'booking_id';

create index if not exists business_events_payment_ref_idx
  on public.business_events (user_id, (payload->>'payment_reference'))
  where payload ? 'payment_reference';

create index if not exists business_events_invoice_ref_idx
  on public.business_events (user_id, (payload->>'invoice_number'))
  where payload ? 'invoice_number';
