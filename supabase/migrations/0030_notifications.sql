-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Notifications that survive a closed laptop  (migration 0030)
-- ────────────────────────────────────────────────────────────────────────────
-- An owner asked to be told whenever a booking is made, "without fail". Today
-- nothing tells them at all: the public booking endpoint writes a pending row
-- and returns, and the only way anyone learns a request arrived is by opening
-- the hospitality calendar and noticing an amber square inside a 14-day window.
-- A request for dates three weeks out is invisible until someone pages forward
-- to it.
--
-- The bell in the dashboard header is real but it is derived-only: it recomputes
-- runway, overdue invoices and low stock in the browser on mount, and knows
-- nothing that did not come from those three sources. There is nowhere to put a
-- fact that HAPPENED.
--
-- WHY A TABLE AND NOT JUST AN EMAIL.
-- "Without fail" cannot rest on a third-party mail key. RESEND_API_KEY and the
-- WhatsApp credentials are both unset on this deployment right now, so an
-- email-only alert would have been a silent no-op on the very day it shipped.
-- A row in the owner's own database is the one delivery that cannot be
-- unconfigured: email and WhatsApp become extra reach on top of it, not the
-- thing it depends on.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- What happened. Kept as text rather than an enum so a new kind of event
  -- never needs a migration before it can be reported.
  kind        text not null,                      -- booking_request|booking_cancelled|...
  title       text not null,
  body        text,
  -- Where to go to deal with it, as an in-app path.
  link        text,
  -- The ids behind it, so a click can open the exact record.
  meta        jsonb not null default '{}'::jsonb,

  -- Null until the owner has seen it. A timestamp rather than a boolean so
  -- "how long did that sit there" is answerable.
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- The only two queries this table serves: the unread count, and the feed.
create index if not exists notifications_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

create index if not exists notifications_feed_idx
  on public.notifications(user_id, created_at desc);

-- One notification per thing that happened. The public booking endpoint is
-- retried by browsers and by bots, and an owner opening the dashboard to
-- fourteen copies of one booking would learn to ignore the bell.
create unique index if not exists notifications_dedupe_idx
  on public.notifications(user_id, kind, (meta->>'booking_id'))
  where meta->>'booking_id' is not null;

-- ── RLS: an owner sees only their own, and only the service role writes ─────
-- Writes come from the API on the service-role key (a booking request arrives
-- unauthenticated, so there is no session to write as). The owner needs to read
-- them and to mark them read, and nothing else.
alter table public.notifications enable row level security;

-- Dropped first so a second run replaces rather than errors, which is the
-- pattern every other migration in this set uses.
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0030
-- ════════════════════════════════════════════════════════════════════════════
