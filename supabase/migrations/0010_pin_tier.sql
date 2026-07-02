-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Migration 0010: pin `tier` against client-side self-escalation
--
-- Before this migration, RLS let a signed-in user UPDATE their own profiles row,
-- and the `guard_profile_role` trigger pinned only `role` — `tier` was left
-- self-settable "because the checkout flow writes it." That meant anyone could
-- open the browser console and run
--     supabase.from('profiles').update({ tier: 'growth' }).eq('id', <self>)
-- to unlock paid features for free.
--
-- Tier is now written ONLY by the service-role backend on a confirmed payment
-- (aibos-api `_grant_tier`) or by an admin via the service-role admin API. This
-- migration extends the guard trigger to pin `tier` (and its provenance columns)
-- to their previous values for ordinary authenticated self-updates, exactly as
-- `role` already is. The service-role client has `auth.uid()` = NULL, so it
-- bypasses the pin and legitimate grants still work.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ordinary authenticated self-update (not the service role, not an admin):
  -- pin every privilege column to its old value so a user can never escalate
  -- their own role OR tier from the browser. Service role (auth.uid() is null)
  -- and existing admins are unaffected, so payment grants and admin actions work.
  if auth.uid() is not null and not public.is_admin() then
    new.role            := old.role;
    new.tier            := old.tier;
    new.tier_source     := old.tier_source;
    new.tier_granted_by := old.tier_granted_by;
    new.tier_granted_at := old.tier_granted_at;
    -- Keep the legacy mirror column consistent with the pinned tier.
    new.subscription_tier := old.subscription_tier;
  end if;
  return new;
end;
$$;

-- Trigger already exists from migration 0001 (before update … guard_profile_role).
-- Re-assert it so a fresh database also gets it.
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0010
-- ════════════════════════════════════════════════════════════════════════════
