-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: plans paid by card, through Paddle  (migration 0037)
-- ────────────────────────────────────────────────────────────────────────────
-- Mobile money pays for one month or one year at a time. A card plan renews by
-- itself: Paddle charges the card every period until the customer cancels.
-- Each row is one of those card subscriptions, as Paddle last described it:
-- which plan, what it costs, when the card is next charged, and whether the
-- customer has cancelled the renewal.
--
-- The payments themselves go where every plan payment goes, into
-- subscription_payments (network 'paddle', reference = Paddle's transaction
-- id), so Plan & billing lists them with the rest.
--
-- Written by the API only (service role), from Paddle's signed webhook. A
-- customer may read their own rows and nothing else. This is deliberately NOT
-- on profiles: a person can update parts of their own profile row, and the
-- Paddle customer id is what opens their card page and invoices.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.card_subscriptions (
  subscription_id text        primary key,          -- Paddle's sub_...
  user_id         uuid        not null references auth.users(id) on delete cascade,
  customer_id     text,                             -- Paddle's ctm_...
  -- Paddle's own words: active, trialing, past_due (card declined, Paddle is
  -- retrying), paused, canceled.
  status          text        not null default 'active',
  plan            text,                             -- 'pro' | 'proplus' | 'growth'
  billing         text,                             -- 'monthly' | 'annual'
  price_id        text,
  amount          numeric,                          -- the recurring price, e.g. 25
  currency        text        not null default 'USD',
  period_end      timestamptz,                      -- end of the period being paid for
  next_billed_at  timestamptz,                      -- when the card is next charged
  cancel_at       timestamptz,                      -- renewal cancelled: the plan ends here
  canceled_at     timestamptz,
  environment     text        not null default 'live',   -- 'live' | 'sandbox'
  -- When Paddle last changed this subscription. Paddle does not promise to
  -- deliver events in order, so an older event never overwrites a newer one.
  event_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists card_subscriptions_user_idx
  on public.card_subscriptions(user_id, updated_at desc);
create index if not exists card_subscriptions_customer_idx
  on public.card_subscriptions(customer_id);

drop trigger if exists card_subscriptions_set_updated_at on public.card_subscriptions;
create trigger card_subscriptions_set_updated_at
  before update on public.card_subscriptions
  for each row execute function public.set_updated_at();

-- ── RLS: a person reads only their own; the API writes ──────────────────────
alter table public.card_subscriptions enable row level security;

drop policy if exists card_subscriptions_select_self  on public.card_subscriptions;
drop policy if exists card_subscriptions_select_admin on public.card_subscriptions;
create policy card_subscriptions_select_self  on public.card_subscriptions
  for select using (auth.uid() = user_id);
create policy card_subscriptions_select_admin on public.card_subscriptions
  for select using (public.is_admin());

-- ── A card payment can be refunded ──────────────────────────────────────────
-- Every card payment has a 30-day money-back guarantee. When Paddle refunds
-- one in full, its row in subscription_payments reads 'refunded' (it used to
-- allow only pending, successful and failed).
do $$
begin
  if exists (select 1 from pg_constraint
             where conname = 'subscription_payments_status_chk'
               and pg_get_constraintdef(oid) not like '%refunded%') then
    alter table public.subscription_payments drop constraint subscription_payments_status_chk;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subscription_payments_status_chk') then
    alter table public.subscription_payments add constraint subscription_payments_status_chk
      check (status in ('pending','successful','failed','refunded'));
  end if;
end $$;

comment on table public.card_subscriptions is
  'Plans paid by card through Paddle, one row per Paddle subscription. Written by the API from Paddle''s signed webhook.';

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0037
-- ════════════════════════════════════════════════════════════════════════════
