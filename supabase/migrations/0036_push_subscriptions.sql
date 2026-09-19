-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: notifications on the phone  (migration 0036)
-- ────────────────────────────────────────────────────────────────────────────
-- A booking request, a guest's payment or a plan renewal lands in the bell,
-- which an owner only sees when they next open AIBOS. With AIBOS installed on
-- the phone, the same alert can arrive as a notification on the lock screen.
--
-- Each row is one browser that the owner turned notifications on in: the
-- address its maker (Google, Apple, Mozilla) gave us to deliver to, and the
-- two keys that message is encrypted with so only that browser can read it.
-- A person can have several (their phone, the shop computer).
--
-- Nothing here is private to read: the keys encrypt TO the browser and cannot
-- decrypt anything. A dead subscription is removed by the API when its maker
-- says the browser is gone.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- The delivery address. Unique: re-subscribing the same browser updates the
  -- row it already has instead of piling up duplicates.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

-- ── RLS: a person sees only their own; the API writes ──────────────────────
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
create policy push_subscriptions_select_self on public.push_subscriptions
  for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0036
-- ════════════════════════════════════════════════════════════════════════════
