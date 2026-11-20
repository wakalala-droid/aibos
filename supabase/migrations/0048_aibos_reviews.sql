-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: owners review AIBOS  (migration 0048)
-- ────────────────────────────────────────────────────────────────────────────
-- The review centre (owner, 20 Nov 2026). An owner rates AIBOS from one to
-- five and says why, on Review AIBOS in the app, and chooses where it goes:
--
--   * to the AIBOS team only, or
--   * also onto the AIBOS website, with the name, business and town they
--     give. Their logo goes with it only if they tick that too.
--
-- One review per account. Its writer can change it or take it back at any
-- time, and taking it back takes it off the website at once.
--
-- An AI-BOS administrator can hide a review from the website, only for abuse,
-- spam or someone's private details, never because it is unhappy. The
-- website shows every review its writer shared that is not hidden, newest
-- first, and the average of all of them.
--
-- (public.reviews is something else: hotel guests reviewing their stay,
-- migration 0015.)
--
--   * aibos_reviews  one row per account: the stars, the words, the name
--                    to show, the two yeses (website, logo) and the admin's
--                    shown or hidden.
--
-- Without this migration Review AIBOS says it is not ready yet, the website
-- shows no reviews, and the ask to review cannot be sent.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.aibos_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- The business the owner was in when they wrote it (for the admin's view).
  business_id   uuid references public.businesses(id) on delete set null,

  rating        smallint not null,
  body          text not null,
  -- What the website shows under the words, as the owner typed it.
  name          text,
  business      text,
  town          text,

  -- The owner's yeses. Nothing reaches the website without the first; the
  -- logo needs the second as well.
  show_on_site  boolean not null default false,
  show_logo     boolean not null default false,

  -- The administrator's say: 'hidden' only for abuse, spam or private details.
  status        text not null default 'shown',
  -- Where it was written ('app'; later perhaps 'whatsapp').
  source        text not null default 'app',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint aibos_reviews_one_each unique (user_id),
  constraint aibos_reviews_rating check (rating between 1 and 5),
  constraint aibos_reviews_body check (char_length(body) between 10 and 600),
  constraint aibos_reviews_status check (status in ('shown', 'hidden'))
);

-- The website's list: shared, not hidden, newest first.
create index if not exists aibos_reviews_site_idx
  on public.aibos_reviews(created_at desc) where show_on_site and status = 'shown';

-- ── RLS: the owner reads their own; the API writes ──────────────────────────
alter table public.aibos_reviews enable row level security;

drop policy if exists aibos_reviews_select_self on public.aibos_reviews;
create policy aibos_reviews_select_self on public.aibos_reviews
  for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0048
-- ════════════════════════════════════════════════════════════════════════════
