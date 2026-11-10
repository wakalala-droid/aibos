-- ═══════════════════════════════════════════════════════════════════════════
-- AI-BOS: Find clients on LinkedIn, the safe way  (migration 0046, 10 Nov 2026)
-- ───────────────────────────────────────────────────────────────────────────
-- Explee sends from a LinkedIn account connected to it. LinkedIn's User
-- Agreement (section 8.2) bars bots that add contacts or send messages, and
-- its open API gives apps no search and no messaging, so AIBOS never opens
-- LinkedIn itself (aibos-api find_clients.py). Instead:
--
--   * client_prospects.linkedin  the business's LinkedIn page, or the profile
--                                of the person who decides: from a link on
--                                their own website, a list, or pasted by the
--                                owner after a LinkedIn search they opened;
--   * client_messages.linkedin   the note to send with a LinkedIn invitation,
--                                written to 200 characters (a free account's
--                                limit), next to the email and WhatsApp words;
--   * client_messages.channel    may now be 'linkedin': the owner pasted the
--                                note in their own LinkedIn and pressed send.
--
-- AIBOS STILL SENDS NOTHING. The page copies the note and opens LinkedIn; the
-- owner sends it there and presses I sent it, so the follow-ups come.
--
-- Until this is run the API keeps working without LinkedIn, and GET /health
-- lists 46 under migrations_missing.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.client_prospects add column if not exists linkedin text;
alter table public.client_messages  add column if not exists linkedin text;

-- The channel check from 0045, now with LinkedIn.
alter table public.client_messages drop constraint if exists client_messages_channel_check;
alter table public.client_messages add constraint client_messages_channel_check
  check (channel in ('email', 'whatsapp', 'linkedin'));

comment on column public.client_prospects.linkedin is
  'Find clients: their LinkedIn page or profile, kept for the owner to open. AIBOS never opens LinkedIn itself.';
comment on column public.client_messages.linkedin is
  'Find clients: the note for a LinkedIn invitation (200 characters). The owner pastes and sends it in their own LinkedIn.';
comment on table public.client_messages is
  'Find clients: drafts, messages the owner sent from their own email, WhatsApp or LinkedIn, and replies they pasted. AIBOS sends none of them.';

-- ═══════════════════════════════════════════════════════════════════════════
-- End migration 0046
-- ═══════════════════════════════════════════════════════════════════════════
