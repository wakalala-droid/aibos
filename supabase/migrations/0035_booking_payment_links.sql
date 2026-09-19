-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: payment links for bookings, and deposits kept on a cancelled stay  (migration 0035)
-- ────────────────────────────────────────────────────────────────────────────
-- A guest who booked a stay had no way to pay from their phone. The owner had
-- to chase the deposit on WhatsApp, wait for a mobile money SMS, then open the
-- calendar and press "Deposit paid" by hand. Invoices already have a payment
-- link (migration 0025); bookings now have the same.
--
-- The owner makes a link for a stay, for everything still owed or for a
-- deposit. The guest opens it, sees the stay and the amount, and approves a
-- mobile money prompt. When the money arrives the booking marks itself
-- "Deposit paid" or "Paid in full", through the same bookkeeping as the
-- owner's own buttons, so the payment reaches the books exactly once.
--
--   bookings.pay_token     the link's secret part (random, 32 bytes)
--   bookings.pay_request   the amount the link asks for; empty means
--                          everything still owed
--   booking_payments       each mobile money collection against a stay,
--                          kept so a guest who approves minutes later, or a
--                          confirmation that arrives after a restart, is
--                          never money taken with the booking left unpaid
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.bookings add column if not exists pay_token   text;
alter table public.bookings add column if not exists pay_request numeric;

-- Money the owner KEPT when a stay was called off (a non-refundable deposit).
-- Cancelling used to void the stay's income and every payment on it, so a
-- deposit the owner kept vanished from their cash. Now it stays as income.
alter table public.bookings add column if not exists kept_amount numeric;

create unique index if not exists bookings_pay_token_idx
  on public.bookings(pay_token) where pay_token is not null;

create table if not exists public.booking_payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  reference    text not null unique,                 -- provider reference (UUID v4)
  network      text not null,                        -- 'mtn' | 'airtel'
  payer_phone  text,
  amount       numeric not null,                     -- read server-side, never the guest's
  currency     text not null default 'ZMW',
  status       text not null default 'pending',
  -- Claimed exactly once before the booking is updated, so a status check and
  -- the provider's confirmation cannot both record the same money.
  settled      boolean not null default false,
  created_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_payments_status_chk') then
    alter table public.booking_payments add constraint booking_payments_status_chk
      check (status in ('pending','successful','failed'));
  end if;
end $$;

create index if not exists booking_payments_pending_idx
  on public.booking_payments(status, created_at) where status = 'pending';
create index if not exists booking_payments_booking_idx
  on public.booking_payments(booking_id, created_at desc);

-- ── RLS: the owner reads their own; the API writes ─────────────────────────
alter table public.booking_payments enable row level security;

drop policy if exists booking_payments_select_self on public.booking_payments;
create policy booking_payments_select_self on public.booking_payments
  for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0035
-- ════════════════════════════════════════════════════════════════════════════
