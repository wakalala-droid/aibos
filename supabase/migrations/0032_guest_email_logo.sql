-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — The property's logo on its guest emails  (migration 0032)
-- ────────────────────────────────────────────────────────────────────────────
-- Emails to a property's guests (0031) are sent in the property's name and must
-- never show AI-BOS. This is the property's own logo at the top of them.
--
-- A PNG or JPG on https: most mail apps will not show an SVG. Null means the
-- property's name is shown in type instead.
--
-- Its own migration rather than a line added to 0031, because 0031 had already
-- been run, and /health checks one column per migration number.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.properties
  add column if not exists guest_email_logo_url text;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0032
-- ════════════════════════════════════════════════════════════════════════════
