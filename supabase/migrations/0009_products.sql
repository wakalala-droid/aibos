-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Products catalog  (migration 0009)   ·   Evolution Initiative 3
-- ────────────────────────────────────────────────────────────────────────────
-- The product master list: name, prices, opening stock, reorder level, supplier.
-- Per-SKU on-hand is DERIVED from Business Events (receipts − sales ± adjustments),
-- computed in the backend stock module — this table is just the catalog.
--
-- Unlike events/twin/memory (pipeline-written), products are user master data, so
-- the user may CRUD their own rows directly (RLS self-scoped); the backend also
-- writes via service role. IDEMPOTENT & NON-DESTRUCTIVE. Reuses set_updated_at().
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  sku            text,
  category       text,
  unit           text not null default 'unit',
  buy_price      numeric not null default 0,
  sell_price     numeric not null default 0,
  opening_stock  numeric not null default 0,
  reorder_level  numeric not null default 0,
  supplier       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One product per name per tenant (case-insensitive) — prevents dupes; also the
-- key the stock module matches Sale/Receipt line items against.
create unique index if not exists products_user_name_uniq
  on public.products(user_id, lower(name));
create index if not exists products_user_idx on public.products(user_id);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists products_select_self on public.products;
drop policy if exists products_insert_self on public.products;
drop policy if exists products_update_self on public.products;
drop policy if exists products_delete_self on public.products;
drop policy if exists products_select_admin on public.products;

create policy products_select_self on public.products for select using (auth.uid() = user_id);
create policy products_insert_self on public.products for insert with check (auth.uid() = user_id);
create policy products_update_self on public.products for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy products_delete_self on public.products for delete using (auth.uid() = user_id);
create policy products_select_admin on public.products for select using (public.is_admin());

grant select, insert, update, delete on public.products to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0009
-- ════════════════════════════════════════════════════════════════════════════
