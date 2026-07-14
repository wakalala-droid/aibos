-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Multiple businesses under one login  (migration 0023)  ·  audit #16
-- ────────────────────────────────────────────────────────────────────────────
-- The Growth anchor: portfolios (a shop + a salon + two flats), separate books,
-- one login. Backward compatible BY CONSTRUCTION — every existing account is
-- backfilled ONE default business and all its data is stamped with that id, so
-- with a single business every query scopes to it and behaviour is identical.
--
-- ORDER MATTERS on live data (the plan's delicate step): create + backfill the
-- businesses, add business_id columns, backfill them from the default business,
-- THEN re-key business_state to (user_id, business_id). Running top-to-bottom
-- in one editor paste does this correctly. IDEMPOTENT & NON-DESTRUCTIVE.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. businesses ────────────────────────────────────────────────────────────
create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  industry    text,
  currency    text        not null default 'ZMW',
  is_default  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists businesses_owner_idx on public.businesses(owner_id, created_at);

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

alter table public.businesses enable row level security;
drop policy if exists businesses_select_self on public.businesses;
drop policy if exists businesses_write_self  on public.businesses;
drop policy if exists businesses_select_admin on public.businesses;
create policy businesses_select_self on public.businesses for select using (auth.uid() = owner_id);
create policy businesses_write_self  on public.businesses for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy businesses_select_admin on public.businesses for select using (public.is_admin());
grant select, insert, update, delete on public.businesses to authenticated;

-- ── 2. Backfill one default business per existing profile ────────────────────
insert into public.businesses (owner_id, name, industry, currency, is_default)
select p.id,
       coalesce(nullif(trim(p.business_name), ''), 'My business'),
       p.industry,
       coalesce(nullif(p.currency, ''), 'ZMW'),
       true
from public.profiles p
where not exists (select 1 from public.businesses b where b.owner_id = p.id);

-- ── 3. Add business_id to every business-scoped table (nullable) ─────────────
-- business_events already reserved it (0005). Add to the rest.
alter table public.business_state add column if not exists business_id uuid;
alter table public.products       add column if not exists business_id uuid;
alter table public.parties        add column if not exists business_id uuid;
alter table public.invoices       add column if not exists business_id uuid;
alter table public.schedule_items add column if not exists business_id uuid;

-- ── 4. Backfill business_id = the owner's default business ───────────────────
do $$
declare t record;
begin
  for t in
    select unnest(array['business_events','business_state','products','parties','invoices','schedule_items']) as tbl
  loop
    execute format(
      'update public.%I x set business_id = b.id
         from public.businesses b
        where b.owner_id = x.user_id and b.is_default and x.business_id is null', t.tbl);
  end loop;
end $$;

-- ── 5. Re-key business_state to (user_id, business_id) ───────────────────────
-- The delicate step: only run once business_id is backfilled (step 4 above).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.business_state'::regclass and contype = 'p'
      and conname = 'business_state_pkey'
      and (select count(*) from unnest(conkey)) = 1     -- current PK is user_id alone
  ) then
    alter table public.business_state drop constraint business_state_pkey;
    -- default the seam so future single-business inserts never violate NOT NULL
    update public.business_state set business_id = gen_random_uuid() where business_id is null;
    alter table public.business_state alter column business_id set not null;
    alter table public.business_state add constraint business_state_pkey primary key (user_id, business_id);
  end if;
end $$;

create index if not exists business_events_business_idx on public.business_events(user_id, business_id);
create index if not exists products_business_idx        on public.products(user_id, business_id);
create index if not exists parties_business_idx         on public.parties(user_id, business_id);
create index if not exists invoices_business_idx        on public.invoices(user_id, business_id);
create index if not exists schedule_items_business_idx  on public.schedule_items(user_id, business_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0023
-- ════════════════════════════════════════════════════════════════════════════
