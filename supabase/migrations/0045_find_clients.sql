-- ═══════════════════════════════════════════════════════════════════════════
-- AI-BOS: Find clients  (migration 0045, Growth, 5 November 2026)
-- ───────────────────────────────────────────────────────────────────────────
-- An agent that finds businesses that could buy from the owner (the map
-- around 16 Zambian towns, or a list the owner pastes), reads their websites,
-- says how well each fits and why, and writes the first message, the
-- follow-ups and the answer to a reply (aibos-api find_clients.py).
--
-- AIBOS NEVER SENDS ANY OF IT. Every message is a draft until the owner
-- presses Send, which opens their own email or WhatsApp with it filled in.
--
--   * client_settings   one row per business: who signs, the booking link,
--                       follow-ups, the facts answers may use and the do not
--                       contact list (emails, whole domains, phone numbers);
--   * client_campaigns  what the owner sells and to whom, with the signs of a
--                       good fit and of one to leave alone;
--   * client_prospects  each business found: how to reach it, the fit and
--                       its reasons, the stage, follow-up dates. One row per
--                       address (dedupe_key), so nothing is found twice;
--   * client_messages   drafts, messages the owner sent and replies they
--                       pasted, with what each reply said (label).
--
-- The month's research allowance is counted in usage_events
-- (event = 'find_clients_research'), which already exists.
--
-- Deleting a business deletes its messages (on delete cascade): what the
-- Data Protection Act 2021 asks when someone wants their details removed.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.client_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  business_id      uuid not null,
  sender_name      text,
  sender_role      text,
  phone            text,
  booking_link     text,
  followups        int  not null default 2 check (followups between 0 and 3),
  followup_days    int  not null default 4 check (followup_days between 2 and 21),
  facts            text,
  do_not_contact   jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint client_settings_once unique (user_id, business_id)
);

create table if not exists public.client_campaigns (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  business_id      uuid not null,
  name             text not null,
  offer            text,
  who              text,
  pain             text,
  proof            text,
  good_fit         jsonb not null default '[]'::jsonb,
  rule_out         jsonb not null default '[]'::jsonb,
  keywords         jsonb not null default '[]'::jsonb,
  kinds            jsonb not null default '[]'::jsonb,
  towns            jsonb not null default '[]'::jsonb,
  status           text not null default 'active' check (status in ('active', 'paused')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists client_campaigns_owner_idx
  on public.client_campaigns (user_id, business_id);

create table if not exists public.client_prospects (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  business_id        uuid not null,
  campaign_id        uuid references public.client_campaigns(id) on delete set null,
  name               text not null,
  kind               text,
  town               text,
  address            text,
  website            text,
  email              text,
  phone              text,
  contact_name       text,
  contact_role       text,
  notes              text,
  source             text not null default 'typed' check (source in ('map', 'list', 'typed')),
  source_ref         text,
  -- e:<email> | w:<website> | o:<map place> | p:<phone> | n:<name>|<town>
  dedupe_key         text not null,
  fit                int check (fit between 0 and 100),
  fit_reasons        jsonb not null default '[]'::jsonb,
  summary            text,
  hook               text,
  researched_at      timestamptz,
  research_note      text,
  stage              text not null default 'new' check (stage in
                       ('new', 'researched', 'ready', 'contacted', 'replied', 'meeting', 'won', 'lost', 'skipped')),
  hot                boolean not null default false,
  followups_sent     int not null default 0,
  last_contacted_at  timestamptz,
  next_followup_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint client_prospects_once unique (user_id, business_id, dedupe_key)
);

create index if not exists client_prospects_stage_idx
  on public.client_prospects (user_id, business_id, stage);
create index if not exists client_prospects_followup_idx
  on public.client_prospects (user_id, next_followup_at) where next_followup_at is not null;

create table if not exists public.client_messages (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  business_id      uuid not null,
  prospect_id      uuid not null references public.client_prospects(id) on delete cascade,
  direction        text not null default 'out' check (direction in ('out', 'in')),
  kind             text not null default 'first' check (kind in ('first', 'followup', 'answer', 'reply')),
  channel          text not null default 'email' check (channel in ('email', 'whatsapp')),
  subject          text,
  body             text not null default '',
  whatsapp         text,
  status           text not null default 'draft' check (status in ('draft', 'sent', 'discarded', 'received')),
  label            text,
  written_by       text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create index if not exists client_messages_prospect_idx
  on public.client_messages (prospect_id, created_at desc);
create index if not exists client_messages_drafts_idx
  on public.client_messages (user_id, business_id) where status = 'draft';

comment on table public.client_prospects is
  'Find clients: businesses that could buy from the owner, with the fit, the stage and follow-up dates.';
comment on table public.client_messages is
  'Find clients: drafts, messages the owner sent from their own email or WhatsApp, and replies they pasted. AIBOS sends none of them.';

-- ── RLS: an owner reads their own; the API writes ──────────────────────────
alter table public.client_settings  enable row level security;
alter table public.client_campaigns enable row level security;
alter table public.client_prospects enable row level security;
alter table public.client_messages  enable row level security;

drop policy if exists client_settings_select_self on public.client_settings;
create policy client_settings_select_self on public.client_settings
  for select using (auth.uid() = user_id);

drop policy if exists client_campaigns_select_self on public.client_campaigns;
create policy client_campaigns_select_self on public.client_campaigns
  for select using (auth.uid() = user_id);

drop policy if exists client_prospects_select_self on public.client_prospects;
create policy client_prospects_select_self on public.client_prospects
  for select using (auth.uid() = user_id);

drop policy if exists client_messages_select_self on public.client_messages;
create policy client_messages_select_self on public.client_messages
  for select using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- End migration 0045
-- ═══════════════════════════════════════════════════════════════════════════
