-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Business identity provenance  (migration 0026)
-- ────────────────────────────────────────────────────────────────────────────
-- The Setup Wizard can now find a business's existing online presence and
-- offer it back as a one-tap pre-fill (aibos-api/identity.py → GET
-- /identity/lookup). The fields it fills ALREADY EXIST on profiles from
-- migration 0001 — business_name, industry, location, phone, logo_url — and
-- from 0007 — operating_hours. This migration adds only what was missing:
--
--   1. `website`            — the listing's site, previously nowhere to put.
--   2. PROVENANCE           — which fields came from outside, from where, and
--                             whether a human confirmed them.
--
-- Provenance is the point. Imported data is a SUGGESTION the owner accepted,
-- not a fact AIBOS observed, and the difference has to survive in the row:
-- nothing derived from an external listing may ever be treated as spine-grade
-- truth. `identity_confirmed_at` is written only when the owner taps "Yes,
-- that's my business" — a NULL there means nothing was ever imported.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists website               text;
alter table public.profiles add column if not exists identity_place_id     text;         -- Google Places id of the confirmed listing
alter table public.profiles add column if not exists identity_source       text;         -- 'google_places' | null (typed by hand)
alter table public.profiles add column if not exists identity_confirmed_at timestamptz;  -- when the OWNER confirmed the match

-- Finding a business again later (drift checks: "your listing says you now
-- close at 20:00") is a lookup by place id, so index it — sparsely, because
-- most rows will never have one.
create index if not exists profiles_identity_place_id_idx
  on public.profiles (identity_place_id)
  where identity_place_id is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0026
-- ════════════════════════════════════════════════════════════════════════════
