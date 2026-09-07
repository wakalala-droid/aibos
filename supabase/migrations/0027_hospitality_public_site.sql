-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Hospitality public booking surface  (migration 0027)
-- ────────────────────────────────────────────────────────────────────────────
-- Lets a property's own website read availability and send a booking request
-- without a login. Every /hospitality/* route sits behind require_user, and the
-- only unauthenticated route in the module is the iCal feed. That is correct
-- for staff surfaces and useless for a public website: dunslimapartments.com
-- has no Supabase session and never will.
--
-- Two columns, both mirroring patterns already in this schema:
--
--   • properties.public_site_token — an unguessable token that IS the
--     capability, exactly as channels.ical_export_token already is for the
--     public feed. Null until the owner mints one, so nothing is exposed by
--     upgrading. Rotating it revokes the site instantly.
--
--   • units.public_slug — the handle a website uses in a URL. The website knows
--     its residences as 'mandela', 'mulima' and 'kaunda' and knows nothing about
--     AI-BOS unit ids. Without this the public endpoint would have to match on
--     unit_name, so renaming a unit in the dashboard would quietly break the
--     public site.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- RLS already governs both tables from 0015; these only add columns to
-- already-secured tables, so no new policy is needed. The public endpoints read
-- through the service-role client and stay scoped to the token's own property.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.properties
  add column if not exists public_site_token text;

alter table public.units
  add column if not exists public_slug text;

-- The token is the capability, so the lookup must be unique and indexed.
create unique index if not exists properties_site_token_uq
  on public.properties(public_site_token)
  where public_site_token is not null;

-- A slug is only meaningful within one property, and two units in the same
-- property sharing one would make the public route ambiguous.
create unique index if not exists units_property_slug_uq
  on public.units(property_id, public_slug)
  where public_slug is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0027
-- ════════════════════════════════════════════════════════════════════════════
