-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: casual workers, leave, minimum wages and NAPSA by age
-- (migration 0044, 3 November 2026)
-- ────────────────────────────────────────────────────────────────────────────
-- What the payroll keeps for the rest of the law:
--
--   * employment_type 'casual': paid by the hour with the 25% casual loading
--     (Employment Code Act s.3), taxed on ZRA's daily tables;
--     employees.hourly_rate is their rate before the loading.
--   * employees.date_of_birth / napsa_to_65: NAPSA stops at the pensionable
--     age of 60, or 65 when the member chose it and the employer agreed
--     (National Pension Scheme Act 2026, s.2 and s.29), by itself.
--   * employees.leave_opening / leave_rate: leave days owed from before AIBOS,
--     and the days earned a month (at least 2, Employment Code Act s.36).
--   * employees.wage_order / wage_category: which Minimum Wages Order covers
--     them (general, shop, domestic: SI 48, 50, 49 of 2023) and its category.
--   * employees.guard: a watchperson or guard (hourly rate on 240 hours, s.75).
--
-- The employer's address joins its numbers in profiles.payroll_employer
-- (jsonb, migration 0043): a pay statement names it (SI 50 of 2023, 12(5)).
-- Payslips keep the hours, overtime and leave of each month in breakdown.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor, after 0043.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.employees add column if not exists hourly_rate    numeric;
alter table public.employees add column if not exists date_of_birth  date;
alter table public.employees add column if not exists napsa_to_65    boolean not null default false;
alter table public.employees add column if not exists leave_opening  numeric not null default 0;
alter table public.employees add column if not exists leave_rate     numeric not null default 2;
alter table public.employees add column if not exists wage_order     text;
alter table public.employees add column if not exists wage_category  text;
alter table public.employees add column if not exists guard          boolean not null default false;

do $$
begin
  -- A casual worker is a third kind of employment.
  if exists (select 1 from pg_constraint where conname = 'employees_type_chk') then
    alter table public.employees drop constraint employees_type_chk;
  end if;
  alter table public.employees add constraint employees_type_chk
    check (employment_type in ('permanent', 'contract', 'casual'));

  if not exists (select 1 from pg_constraint where conname = 'employees_leave_chk') then
    alter table public.employees add constraint employees_leave_chk
      check (leave_opening >= 0 and leave_rate >= 0 and leave_rate <= 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_wage_order_chk') then
    alter table public.employees add constraint employees_wage_order_chk
      check (wage_order is null or wage_order in ('general', 'shop', 'domestic'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'employees_hourly_rate_chk') then
    alter table public.employees add constraint employees_hourly_rate_chk
      check (hourly_rate is null or hourly_rate >= 0);
  end if;
end $$;

comment on column public.employees.hourly_rate is
  'A casual worker''s hourly rate before the 25% casual loading (Employment Code Act s.3).';
comment on column public.employees.date_of_birth is
  'NAPSA stops at 60 (65 with napsa_to_65) by itself from this (National Pension Scheme Act 2026).';
comment on column public.employees.napsa_to_65 is
  'The member chose to retire at 65 and the employer agreed (s.29(2)(b)): NAPSA continues to 65.';
comment on column public.employees.leave_opening is
  'Leave days owed to this person from before AIBOS.';
comment on column public.employees.leave_rate is
  'Leave days earned a month: at least 2 (Employment Code Act s.36).';
comment on column public.employees.wage_order is
  'The Minimum Wages Order covering them: general (SI 48), shop (SI 50) or domestic (SI 49) of 2023, or none.';
comment on column public.employees.wage_category is
  'The category under that Order: I to VII (none for domestic workers).';
comment on column public.employees.guard is
  'A watchperson or guard: the hourly rate is basic pay over 240 hours, not 208 (s.75(4)).';

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0044
-- ════════════════════════════════════════════════════════════════════════════
