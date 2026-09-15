-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Emails to the guest, sent as the property  (migration 0031)
-- ────────────────────────────────────────────────────────────────────────────
-- A guest who booked on a property's own website was shown a confirmation
-- screen and then heard nothing in writing, ever. Not when the request arrived,
-- not when the owner said yes, not when the owner said no. The owner had to
-- chase every guest by hand, and a guest who closed the tab had no record of
-- their reference or their dates.
--
-- The owner of the first property to use this was clear that the guest must NOT
-- hear from AI-BOS. The email is from the property: its name, its address, and
-- a reply that lands in the property's own inbox. AI-BOS is invisible.
--
-- WHY THE SENDER IS A SETTING AND NOT A CONSTANT.
-- An email can only be sent FROM a domain verified with the mail provider. A
-- property that has verified its own domain sends from it. One that has not
-- still sends, under its own name, from the platform's verified domain, with
-- replies going to its own inbox. The code tries the property's address first
-- and falls back only when the provider refuses the domain.
--
-- OFF BY DEFAULT. Emailing somebody's guests is an outward-facing act. An owner
-- turns it on, having seen what will be sent.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.properties
  add column if not exists guest_emails_enabled       boolean not null default false,
  -- Display name the guest sees. Null means the property's own name.
  add column if not exists guest_email_from_name      text,
  -- e.g. reservations@dunslim-apartments.com. Only used if its domain is
  -- verified with the mail provider; otherwise the platform address is used.
  add column if not exists guest_email_from           text,
  -- Where a guest's reply lands, e.g. the property's Gmail.
  add column if not exists guest_email_reply_to       text,
  add column if not exists guest_contact_phone        text,
  -- Shown in the "confirmed" email. Written by the owner, in their own words.
  add column if not exists guest_payment_instructions text,
  -- The property's own logo at the top of every guest email. A PNG or JPG:
  -- most mail apps will not show an SVG. Null means the property's name in text.
  add column if not exists guest_email_logo_url       text;

-- When each email went to the guest: {"received": ts, "confirmed": ts, ...}.
-- Also what stops the same email going twice when a button is pressed twice.
alter table public.bookings
  add column if not exists guest_emails jsonb not null default '{}'::jsonb;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0031
-- ════════════════════════════════════════════════════════════════════════════
