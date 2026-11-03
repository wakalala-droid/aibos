-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: payroll to the letter of ZRA, NAPSA, NHIMA and the Employment Code
-- (migration 0043, 3 November 2026)
-- ────────────────────────────────────────────────────────────────────────────
-- The payroll now works PAYE out on ZRA's cumulative tables, keeps what each
-- person is owed in gratuity and pays it with their final pay, and writes the
-- tax pack and the leaving papers. What it needs to keep:
--
--   * employees.nrc / employees.nhima_number: how ZRA's PAYE return, NAPSA's
--     and NHIMA's returns and the certificate of service (Employment Code Act
--     s.59) name each person (the TPIN and NAPSA number were already kept).
--   * employees.second_job: this is not their main job, so PAYE is the top
--     rate on all of it (ZRA Employer's Guide to PAYE, 5.6).
--   * employees.gratuity_opening: gratuity owed from before the business used
--     AIBOS, so what is owed is never understated.
--   * employees.paye_prior: the pay and PAYE of earlier in the year, from the
--     business's payroll before AIBOS or a previous employer's ITF/P13, so the
--     cumulative tables can be used ({year, through, pay, paye, source}).
--   * profiles.payroll_employer: the employer's TPIN, NAPSA account number and
--     NHIMA number ({tpin, napsa, nhima}).
--
-- Payslips need no new column: what each one paid in gratuity, its extra pay,
-- leave days and how its PAYE was worked out are kept in payslips.breakdown.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.employees add column if not exists nrc              text;
alter table public.employees add column if not exists nhima_number     text;
alter table public.employees add column if not exists second_job       boolean not null default false;
alter table public.employees add column if not exists gratuity_opening numeric not null default 0;
alter table public.employees add column if not exists paye_prior       jsonb;

-- A rate typed as a percentage (25) was kept as it was and set aside 25 times
-- the basic pay a month. Kept as the share it means (0.25).
update public.employees set gratuity_rate = gratuity_rate / 100
 where gratuity_rate > 1 and gratuity_rate <= 100;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_gratuity_opening_chk') then
    alter table public.employees add constraint employees_gratuity_opening_chk check (gratuity_opening >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_gratuity_rate_chk') then
    -- A share of basic pay (0.25 is 25%): never a percentage typed as 25.
    alter table public.employees add constraint employees_gratuity_rate_chk
      check (gratuity_rate >= 0 and gratuity_rate <= 1) not valid;
  end if;
end $$;

comment on column public.employees.nrc is
  'National Registration Card number (123456/78/9), or a passport number. On the PAYE, NAPSA and NHIMA returns.';
comment on column public.employees.nhima_number is
  'NHIMA member number, for the NHIMA return and the certificate of service.';
comment on column public.employees.second_job is
  'True when this is not the person''s main job: PAYE is the top rate on all of it (ZRA Employer''s Guide 5.6).';
comment on column public.employees.gratuity_opening is
  'Gratuity owed to this person from before AIBOS. What AIBOS sets aside each month is added to it.';
comment on column public.employees.paye_prior is
  'Pay and PAYE earlier in the year, before AIBOS or from a previous employer''s ITF/P13: {year, through, pay, paye, source}.';

alter table public.profiles add column if not exists payroll_employer jsonb;

comment on column public.profiles.payroll_employer is
  'The employer''s TPIN, NAPSA account number and NHIMA number: {tpin, napsa, nhima}.';

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0043
-- ════════════════════════════════════════════════════════════════════════════
