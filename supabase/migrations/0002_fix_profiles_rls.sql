-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Migration 0002: fix `profiles` self-access under RLS
--
-- Symptom this fixes: a signed-in user reading their OWN profiles row from the
-- browser got `null` back (role/tier/business_name all empty), even though the
-- row clearly exists. The app currently works around it by reading/writing the
-- profile through the service-role route `/api/profile`. This migration repairs
-- the database itself so direct, RLS-scoped self-access works again.
--
-- Root cause covered: (1) the `authenticated`/`anon` roles may lack the base
-- table GRANTs (RLS can only narrow what a role is already granted — with no
-- GRANT, every read is denied and surfaces as null), and (2) the self-access
-- policies are re-asserted cleanly. `is_admin()` stays SECURITY DEFINER so the
-- admin policy never recurses into RLS on `profiles`.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Base privileges. Without these, RLS policies are moot (no grant = no rows).
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles      to authenticated;
grant select, insert            on public.usage_events to authenticated;
grant select on public.admin_account_overview to authenticated;

-- 2. Make sure RLS is on (the policies below are the actual access rules).
alter table public.profiles enable row level security;

-- 3. Re-assert the self-access policies (drop-then-create = idempotent).
drop policy if exists profiles_select_self  on public.profiles;
drop policy if exists profiles_update_self  on public.profiles;
drop policy if exists profiles_insert_self  on public.profiles;

create policy profiles_select_self
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- 4. Admin can read/update every row (is_admin() is SECURITY DEFINER → no
--    recursion into profiles RLS).
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0002
-- ════════════════════════════════════════════════════════════════════════════
