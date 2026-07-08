-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Hospitality iCal sync  (migration 0016)   ·   Phase 3
-- ────────────────────────────────────────────────────────────────────────────
-- Two-way iCal availability sync between AI-BOS and the OTAs (Booking.com, Airbnb,
-- etc.). Full OTA API partnership is a business-approval process a 3-unit operator
-- can't rely on short-term, so iCal — which every OTA supports even for small hosts
-- — is the interim channel manager. This migration adds the ONE column that makes
-- imports idempotent; the channels table itself already shipped in 0015.
--
--   • bookings.external_uid — the VEVENT UID of an availability block pulled from an
--     OTA feed. Lets a re-run of the nightly sync UPDATE the same block instead of
--     inserting a duplicate, and lets a block the OTA later drops be reconciled
--     (cancelled) rather than orphaned. Null for direct AI-BOS bookings.
--
-- Unique per (channel_id, external_uid) so the same UID can legitimately appear on
-- two different channels without colliding. IDEMPOTENT & NON-DESTRUCTIVE.
-- Run in the Supabase SQL editor. (RLS already governs bookings from 0015 — this
-- only adds a column to an already-secured table, so no new policy is needed.)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.bookings
  add column if not exists external_uid text;

-- One imported block per UID per channel (partial: only where both are present, so
-- the many direct bookings with null external_uid/channel_id don't collide).
create unique index if not exists bookings_channel_uid_uq
  on public.bookings(channel_id, external_uid)
  where external_uid is not null and channel_id is not null;

-- Lookup path for the sync reconciler: "all imported blocks for this channel".
create index if not exists bookings_channel_uid_idx
  on public.bookings(user_id, channel_id, external_uid);

-- Public iCal feed is served by an unguessable token → index the lookup.
create unique index if not exists channels_export_token_uq
  on public.channels(ical_export_token)
  where ical_export_token is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0016
-- ════════════════════════════════════════════════════════════════════════════
