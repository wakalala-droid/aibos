-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: each business is paid into its OWN account  (migration 0038)
-- ────────────────────────────────────────────────────────────────────────────
-- Invoice and stay payment links collect a business's money. Until now the
-- mobile money keys were one set for the whole platform, on the server, so the
-- day they were filled in every customer's invoices would have paid into one
-- account. Now each owner connects their own account (Lenco) in Business
-- profile and a payment link only ever uses the account of the business that
-- made it.
--
-- payment_accounts holds the owner's API key SEALED by the API with
-- FIELD_ENCRYPTION_KEY before it is written. Row level security is on with NO
-- policies: nobody reads this table from a browser, not even the owner. Only
-- the API (service role) does and it never sends the key back.
--
-- invoice_payments and booking_payments learn which provider took each
-- payment, so only that provider can settle it and invoice payments may now
-- be made on Zamtel as well as MTN and Airtel.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.payment_accounts (
  user_id       uuid        primary key references auth.users(id) on delete cascade,
  provider      text        not null,                  -- 'lenco'
  environment   text        not null default 'live',   -- 'live' | 'sandbox'
  secret_enc    text        not null,                  -- sealed by the API, never plaintext
  key_hint      text,                                  -- last four characters, for the owner
  account_name  text,                                  -- as the provider names the account
  account_ref   text,                                  -- the provider's till or account id
  connected_by  uuid,                                  -- who pasted the key
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_accounts_provider_chk') then
    alter table public.payment_accounts add constraint payment_accounts_provider_chk
      check (provider in ('lenco'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_accounts_environment_chk') then
    alter table public.payment_accounts add constraint payment_accounts_environment_chk
      check (environment in ('live', 'sandbox'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_accounts_sealed_chk') then
    -- A key that was not sealed first is refused by the database itself.
    alter table public.payment_accounts add constraint payment_accounts_sealed_chk
      check (secret_enc like 'enc:v1:%');
  end if;
end $$;

-- ── RLS: on with no policies. Only the API reads or writes this table. ──────
alter table public.payment_accounts enable row level security;

-- ── Which provider took each payment ────────────────────────────────────────
alter table public.invoice_payments add column if not exists provider text;
alter table public.booking_payments add column if not exists provider text;

-- Zamtel, through Lenco.
alter table public.invoice_payments drop constraint if exists invoice_payments_network_chk;
alter table public.invoice_payments add constraint invoice_payments_network_chk
  check (network in ('mtn', 'airtel', 'zamtel'));

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0038
-- ════════════════════════════════════════════════════════════════════════════
