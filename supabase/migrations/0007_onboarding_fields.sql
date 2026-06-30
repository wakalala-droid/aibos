-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Onboarding fields  (migration 0007)   ·   Evolution Initiative 1
-- ────────────────────────────────────────────────────────────────────────────
-- Adds the few Business-Setup-Wizard fields that don't already exist on profiles.
-- Business name / industry / currency / location already exist (migration 0001),
-- so the wizard mostly REUSES them; this only adds what's missing. The wizard's
-- "Initial cash" is NOT stored here — it seeds business_state.opening_cash (the
-- Digital Twin), via the backend POST /twin/seed.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists tax_status      text;     -- e.g. 'unregistered' | 'turnover_tax' | 'vat'
alter table public.profiles add column if not exists employees       integer;  -- headcount
alter table public.profiles add column if not exists operating_hours text;     -- e.g. '08:00-18:00'
alter table public.profiles add column if not exists language        text default 'en';
alter table public.profiles add column if not exists onboarded_at    timestamptz;  -- set when the wizard completes

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0007
-- ════════════════════════════════════════════════════════════════════════════
