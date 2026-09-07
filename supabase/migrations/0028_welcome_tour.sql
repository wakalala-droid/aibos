-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Welcome tour after an upgrade  (migration 0028)
-- ────────────────────────────────────────────────────────────────────────────
-- When an account is moved onto a paid plan, the owner should be told what they
-- just gained, and shown where it lives. Until now nothing said anything: the
-- locks came off and the customer had to notice on their own.
--
--   • profiles.welcome_seen_tier — the plan whose welcome this account has
--     already closed. The tour shows while the account is on a paid plan AND
--     this column does not match it.
--
-- Storing the TIER rather than a boolean is what makes a second upgrade work.
-- With a flag, an owner who went Pro then later Growth would have dismissed
-- "seen the welcome" forever and would never be told what Growth added. With
-- the tier, every step up gets its own welcome and a downgrade stays quiet.
--
-- It is a preference, not a privilege: the profiles guard trigger (0010) pins
-- role and tier on a self-update and deliberately does not pin this, so a
-- customer closing their own welcome is a normal write.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists welcome_seen_tier text;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0028
-- ════════════════════════════════════════════════════════════════════════════
