-- ════════════════════════════════════════════════════════════════════════════
-- AIBOS — Invoice payment links  (migration 0025)   ·   closes the get-paid loop
-- ────────────────────────────────────────────────────────────────────────────
-- 0019 gave the owner an invoice they could SHARE. This lets the customer PAY
-- it: a sent invoice carries an unguessable `pay_token`, the token addresses a
-- public payment page, and a successful mobile-money collection settles the
-- invoice through the SAME invoices.mark_paid() the owner's button uses — so
-- there is exactly one path from "money arrived" to a CustomerPayment event.
--
-- Two things this table exists to prevent:
--
--   1. LOST MONEY ON RESTART. Subscription collections live in an in-memory
--      dict (main.PAYMENTS). That is survivable for a checkout the buyer is
--      watching; it is NOT survivable here, where a customer may approve the
--      prompt minutes later and the provider webhook may arrive after a deploy.
--      A reference the server has forgotten is money taken against an invoice
--      that stays unpaid. So invoice collections are PERSISTED.
--
--   2. DOUBLE SETTLEMENT. `settled` is flipped once, before the spine event is
--      posted, so a re-poll racing the webhook cannot post two CustomerPayments
--      for one collection.
--
-- The token is a capability (same shape as the hospitality iCal feed, 0016):
-- knowing it is the only thing needed to VIEW and PAY the invoice, which is
-- exactly what you want to paste into WhatsApp. It grants nothing else — no
-- account access, no other invoice, no customer list.
--
-- IDEMPOTENT & NON-DESTRUCTIVE, house conventions. Run in the Supabase SQL
-- editor after 0024.
-- ════════════════════════════════════════════════════════════════════════════

-- ── The capability token on the invoice ──────────────────────────────────────
alter table public.invoices add column if not exists pay_token text;

-- Partial unique index: many invoices legitimately have no token yet (drafts,
-- and every invoice issued before this migration), and NULLs must not collide.
create unique index if not exists invoices_pay_token_uq
  on public.invoices(pay_token) where pay_token is not null;

-- ── Collection attempts against an invoice ───────────────────────────────────
create table if not exists public.invoice_payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid        not null references public.invoices(id) on delete cascade,
  -- Denormalised so a settlement can find the tenant without re-reading the
  -- invoice, and so RLS below is a single-column check.
  user_id       uuid        not null references auth.users(id) on delete cascade,

  reference     text        not null,        -- provider reference (UUID v4)
  network       text        not null,        -- 'mtn' | 'airtel'
  payer_phone   text,                        -- as entered by the payer
  amount        numeric     not null,        -- server-side from the invoice, never the client
  currency      text        not null default 'ZMW',

  status        text        not null default 'pending',   -- pending|successful|failed
  -- Flipped exactly once, BEFORE the CustomerPayment is posted. The guard that
  -- makes webhook-vs-poll races safe.
  settled       boolean     not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoice_payments_status_chk') then
    alter table public.invoice_payments add constraint invoice_payments_status_chk
      check (status in ('pending','successful','failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoice_payments_network_chk') then
    alter table public.invoice_payments add constraint invoice_payments_network_chk
      check (network in ('mtn','airtel'));
  end if;
  -- The provider reference is how a webhook finds this row. It must be unique
  -- globally, not per-user: the callback arrives with nothing but the reference.
  if not exists (select 1 from pg_constraint where conname = 'invoice_payments_reference_uq') then
    alter table public.invoice_payments add constraint invoice_payments_reference_uq
      unique (reference);
  end if;
end $$;

create index if not exists invoice_payments_invoice_idx on public.invoice_payments(invoice_id);
create index if not exists invoice_payments_user_idx    on public.invoice_payments(user_id, created_at desc);

drop trigger if exists invoice_payments_set_updated_at on public.invoice_payments;
create trigger invoice_payments_set_updated_at
  before update on public.invoice_payments
  for each row execute function public.set_updated_at();

-- ── Row Level Security (house pattern: self + admin-read) ────────────────────
-- The public payment page does NOT read through these policies — it is served
-- by the backend's service-role client after the token is verified, exactly
-- like the hospitality iCal feed. An anonymous visitor never touches Postgres
-- directly, so there is deliberately no anon policy here.
alter table public.invoice_payments enable row level security;

drop policy if exists invoice_payments_select_self  on public.invoice_payments;
drop policy if exists invoice_payments_select_admin on public.invoice_payments;

create policy invoice_payments_select_self  on public.invoice_payments for select using (auth.uid() = user_id);
create policy invoice_payments_select_admin on public.invoice_payments for select using (public.is_admin());

-- Read-only to the client. Rows are written by the backend (service role) as
-- the result of a real provider call — a client that could insert one could
-- claim a payment that never happened.
grant select on public.invoice_payments to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0025
-- ════════════════════════════════════════════════════════════════════════════
