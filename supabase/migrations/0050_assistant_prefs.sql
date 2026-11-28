-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: the sphere's settings  (migration 0050)
-- ────────────────────────────────────────────────────────────────────────────
-- The AI-BOS sphere (the live guide and the chat, now one) has three choices
-- each person makes in Settings, kept on their profile so they follow them to
-- every phone and computer:
--
--   * voice          which voice AI-BOS speaks in (Kore unless chosen)
--   * spoken_report  offer the spoken report when they first open AI-BOS
--                    each day ("Got a moment? Here is how the business is
--                    looking")
--   * tips           the sphere offers a short tip on a page they have not
--                    seen before
--
-- One json column, read and written by aibos-api assistant_prefs.py, which
-- keeps only these keys. Without this migration the app keeps the choices on
-- the device and Settings says this migration is needed.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists assistant_prefs jsonb not null default '{}'::jsonb;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0050
-- ════════════════════════════════════════════════════════════════════════════
