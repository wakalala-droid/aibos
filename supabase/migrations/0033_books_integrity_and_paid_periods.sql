-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Every account has books, and a paid plan has an end date
-- (migration 0033)
-- ────────────────────────────────────────────────────────────────────────────
-- 1. A DEFAULT BUSINESS FOR EVERY ACCOUNT. Migration 0023 gave one to every
--    profile that existed when it ran and nothing created one afterwards. Since
--    0023 re-keyed business_state to (user_id, business_id) NOT NULL, an account
--    with no business could not rebuild its books: a sale was saved and then
--    the request failed. This backfills the missing ones and adds a trigger so
--    no new account is ever without one. One default per owner is enforced.
--
--    Rows written WITHOUT a business are NOT stamped here. The API files them
--    on each owner's first visit, after voiding postings that must not count
--    (a Sale for a booking since cancelled, a second Sale for an invoice whose
--    first send failed). That repair needs the booking and invoice rules in
--    aibos-api/books_repair.py, tested there, and is not repeated in SQL.
--
-- 2. INVOICE NUMBERS PER BUSINESS. Each business counts its own INV-0001, but
--    0019 made a number unique per OWNER, so a second business could not issue
--    its first invoice.
--
-- 3. PAID PERIODS. A mobile-money payment wrote the tier and nothing else, so
--    one monthly payment unlocked a plan for ever. profiles.paid_until records
--    when it runs out (the API allows a 7-day grace). Checkouts are persisted in
--    subscription_payments, so a restart between "approve on your phone" and the
--    confirmation no longer takes money and grants nothing.
--
-- 0. CATCH-UP. A read-only check of the live database on 2026-09-16 found
--    four earlier migrations missing, while /health reported none missing
--    (it only probed 27 onward; it now probes every one):
--      0012 (part)  schedule_items.parent_id   ticking off a recurring item failed
--      0024         budgets                    the Budgets screen had no table
--      0025         invoices.pay_token,        every invoice Send failed, AFTER
--                   invoice_payments           posting its Sale
--      0026         profiles.website etc.      onboarding could not be finished
--    Their statements are repeated here, unchanged and still idempotent, so
--    this one paste brings the database fully up to date.
--
-- S. SECURITY, FIRST, so it lands even if something later in the file errors.
--    The guard trigger from 0001/0010 pins role and tier on UPDATE only, while
--    RLS lets a signed-in user INSERT their own profiles row with any values.
--    Email sign-up is on with automatic confirmation, so anyone could create an
--    account with the public key and insert their own row as role='admin',
--    tier='growth': every *_select_admin policy (all customers' data) and every
--    paid feature. Inserts are now pinned exactly as updates are.
--    Memberships and businesses are also closed to direct client writes (the
--    API is the only writer): an owner could plant an active membership naming
--    someone else, or create extra businesses without the Growth plan.
--    The last statement of this file lists every admin and paid account, so
--    anything unexpected can be seen and corrected.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ── S1. A new profile can never start privileged ────────────────────────────
alter table public.profiles add column if not exists paid_until timestamptz;

create or replace function public.guard_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (auth.uid() is null) and existing admins may provision
  -- any row; everyone else gets the defaults whatever they sent.
  if auth.uid() is not null and not public.is_admin() then
    new.role              := 'member';
    new.tier              := 'free';
    new.subscription_tier := 'free';
    new.tier_source       := 'self';
    new.tier_granted_by   := null;
    new.tier_granted_at   := null;
    new.paid_until        := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_insert on public.profiles;
create trigger profiles_guard_insert
  before insert on public.profiles
  for each row execute function public.guard_profile_insert();

-- ── S2. Memberships and businesses are written by the API only ──────────────
drop policy if exists business_members_write_owner on public.business_members;
revoke insert, update, delete on public.business_members from authenticated;

drop policy if exists businesses_write_self on public.businesses;
revoke insert, update, delete on public.businesses from authenticated;

-- ── 0a. From 0012: occurrence history for recurring schedule items ─────────
alter table public.schedule_items
  add column if not exists parent_id uuid references public.schedule_items(id) on delete set null;
create index if not exists schedule_items_parent_idx
  on public.schedule_items(parent_id) where parent_id is not null;

-- ── 0b. From 0024: budgets & targets ────────────────────────────────────────
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  business_id uuid,
  month       text        not null,
  metric      text        not null,
  target      numeric     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'budgets_metric_chk') then
    alter table public.budgets add constraint budgets_metric_chk
      check (metric in ('revenue','costs','profit'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'budgets_uq') then
    alter table public.budgets add constraint budgets_uq
      unique (user_id, business_id, month, metric);
  end if;
end $$;

create index if not exists budgets_user_month_idx on public.budgets(user_id, month);

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;
drop policy if exists budgets_select_self on public.budgets;
drop policy if exists budgets_write_self  on public.budgets;
drop policy if exists budgets_select_admin on public.budgets;
create policy budgets_select_self on public.budgets for select using (auth.uid() = user_id);
create policy budgets_write_self  on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy budgets_select_admin on public.budgets for select using (public.is_admin());
grant select, insert, update, delete on public.budgets to authenticated;

-- ── 0c. From 0025: invoice payment links ────────────────────────────────────
alter table public.invoices add column if not exists pay_token text;

create unique index if not exists invoices_pay_token_uq
  on public.invoices(pay_token) where pay_token is not null;

create table if not exists public.invoice_payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid        not null references public.invoices(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  reference     text        not null,
  network       text        not null,
  payer_phone   text,
  amount        numeric     not null,
  currency      text        not null default 'ZMW',
  status        text        not null default 'pending',
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

alter table public.invoice_payments enable row level security;
drop policy if exists invoice_payments_select_self  on public.invoice_payments;
drop policy if exists invoice_payments_select_admin on public.invoice_payments;
create policy invoice_payments_select_self  on public.invoice_payments for select using (auth.uid() = user_id);
create policy invoice_payments_select_admin on public.invoice_payments for select using (public.is_admin());
grant select on public.invoice_payments to authenticated;

-- ── 0d. From 0026: business identity on the profile ─────────────────────────
alter table public.profiles add column if not exists website               text;
alter table public.profiles add column if not exists identity_place_id     text;
alter table public.profiles add column if not exists identity_source       text;
alter table public.profiles add column if not exists identity_confirmed_at timestamptz;

create index if not exists profiles_identity_place_id_idx
  on public.profiles (identity_place_id)
  where identity_place_id is not null;

-- ── 1a. One default business per owner ──────────────────────────────────────
-- Keep the earliest default if a race ever made two.
with ranked as (
  select id, row_number() over (partition by owner_id order by created_at, id) as rn
  from public.businesses
  where is_default
)
update public.businesses b
   set is_default = false
  from ranked r
 where b.id = r.id and r.rn > 1;

create unique index if not exists businesses_one_default_per_owner
  on public.businesses(owner_id) where is_default;

-- ── 1b. Every profile gets a default business ───────────────────────────────
create or replace function public.ensure_default_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.businesses where owner_id = new.id) then
    insert into public.businesses (owner_id, name, industry, currency, is_default)
    values (new.id,
            coalesce(nullif(trim(new.business_name), ''), 'My business'),
            new.industry,
            coalesce(nullif(new.currency, ''), 'ZMW'),
            true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_default_business on public.profiles;
create trigger profiles_default_business
  after insert on public.profiles
  for each row execute function public.ensure_default_business();

-- The name typed in onboarding arrives AFTER the profile row exists, so the
-- default business follows it while it still has the placeholder (or the old)
-- name. A name the owner chose for the business itself is never overwritten.
create or replace function public.follow_business_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(new.business_name), '') is not null
     and new.business_name is distinct from old.business_name then
    update public.businesses
       set name = trim(new.business_name)
     where owner_id = new.id
       and is_default
       and (name = 'My business' or name = coalesce(trim(old.business_name), ''));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_follow_business_name on public.profiles;
create trigger profiles_follow_business_name
  after update of business_name on public.profiles
  for each row execute function public.follow_business_name();

insert into public.businesses (owner_id, name, industry, currency, is_default)
select p.id,
       coalesce(nullif(trim(p.business_name), ''), 'My business'),
       p.industry,
       coalesce(nullif(p.currency, ''), 'ZMW'),
       true
  from public.profiles p
 where not exists (select 1 from public.businesses b where b.owner_id = p.id)
on conflict do nothing;

-- ── 2. Invoice numbers are unique per business ──────────────────────────────
alter table public.invoices drop constraint if exists invoices_user_number_uq;
create unique index if not exists invoices_user_business_number_uq
  on public.invoices (user_id,
                      coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid),
                      number);

-- ── 3a. When a paid plan runs out ───────────────────────────────────────────
-- (profiles.paid_until was added in S1, before the insert guard that uses it.)

-- The guard from 0010, now also pinning paid_until: a signed-in user must not
-- be able to extend their own subscription from the browser console.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role              := old.role;
    new.tier              := old.tier;
    new.tier_source       := old.tier_source;
    new.tier_granted_by   := old.tier_granted_by;
    new.tier_granted_at   := old.tier_granted_at;
    new.subscription_tier := old.subscription_tier;
    new.paid_until        := old.paid_until;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ── 3b. Subscription checkouts ──────────────────────────────────────────────
create table if not exists public.subscription_payments (
  reference    text        primary key,            -- provider reference (UUID v4)
  user_id      uuid        not null references auth.users(id) on delete cascade,
  network      text        not null,               -- 'mtn' | 'airtel'
  plan         text        not null,               -- 'pro' | 'proplus' | 'growth'
  billing      text        not null default 'monthly',
  amount       numeric     not null,               -- server-side price, never the client's
  currency     text        not null default 'ZMW',
  payer_phone  text,
  status       text        not null default 'pending',
  -- Claimed exactly once before the plan is granted, so a status poll and the
  -- provider's webhook cannot both grant it.
  granted      boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscription_payments_status_chk') then
    alter table public.subscription_payments add constraint subscription_payments_status_chk
      check (status in ('pending','successful','failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'subscription_payments_billing_chk') then
    alter table public.subscription_payments add constraint subscription_payments_billing_chk
      check (billing in ('monthly','annual'));
  end if;
end $$;

create index if not exists subscription_payments_user_idx
  on public.subscription_payments(user_id, created_at desc);

drop trigger if exists subscription_payments_set_updated_at on public.subscription_payments;
create trigger subscription_payments_set_updated_at
  before update on public.subscription_payments
  for each row execute function public.set_updated_at();

alter table public.subscription_payments enable row level security;
drop policy if exists subscription_payments_select_self  on public.subscription_payments;
drop policy if exists subscription_payments_select_admin on public.subscription_payments;
create policy subscription_payments_select_self  on public.subscription_payments
  for select using (auth.uid() = user_id);
create policy subscription_payments_select_admin on public.subscription_payments
  for select using (public.is_admin());
-- Written by the API (service role) only.
grant select on public.subscription_payments to authenticated;

-- ── Review: who is an admin, and who is on a paid plan ──────────────────────
-- Shown in the SQL editor's results. Every row should be someone you know:
-- an admin you appointed, or a customer who paid or was granted a plan.
select p.email, p.role, p.tier, p.tier_source, p.tier_granted_by, p.created_at
  from public.profiles p
 where p.role = 'admin' or coalesce(p.tier, 'free') <> 'free'
 order by p.created_at desc;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0033
-- ════════════════════════════════════════════════════════════════════════════
