-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: payslips that reach the staff themselves  (migration 0042)
-- ────────────────────────────────────────────────────────────────────────────
-- A payslip was a PDF the owner downloaded one person at a time and passed on
-- by hand, so nobody on staff ever heard from AIBOS. Each person can now carry
-- a phone and an email: AIBOS emails their payslip with the PDF attached, and
-- the owner sends it on WhatsApp from their own phone in one tap.
--
--   * employees.phone / employees.email: where that person's payslip goes.
--   * payslips.sent_at / payslips.sent_via: when it went and how ('email', or
--     'whatsapp' when the owner opened it in WhatsApp from AIBOS), so the
--     Staff page can say who has theirs and who is still waiting.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.employees add column if not exists phone text;
alter table public.employees add column if not exists email text;

comment on column public.employees.phone is
  'The person''s own number, in full international form (+260977123456). Their payslip goes here on WhatsApp.';
comment on column public.employees.email is
  'The person''s own email. AIBOS emails their payslip here, with the PDF attached.';

alter table public.payslips add column if not exists sent_at  timestamptz;
alter table public.payslips add column if not exists sent_via text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payslips_sent_via_chk') then
    alter table public.payslips add constraint payslips_sent_via_chk
      check (sent_via is null or sent_via in ('email', 'whatsapp'));
  end if;
end $$;

comment on column public.payslips.sent_at is
  'When this payslip last reached the employee (emailed by AIBOS or opened in WhatsApp by the owner).';
comment on column public.payslips.sent_via is
  'How it went: email or whatsapp.';

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0042
-- ════════════════════════════════════════════════════════════════════════════
