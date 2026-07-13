-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Invoices  (migration 0019)   ·   audit item #7, the get-paid loop
-- ────────────────────────────────────────────────────────────────────────────
-- An invoice is a COMMITMENT to be paid, not a financial fact — the facts live
-- in the event spine, bridged exactly like the Scheduler and Payroll:
--
--   send      → confirmed credit Sale event   (+receivables, no cash)
--   mark paid → CustomerPayment event         (−receivables, +cash)
--   cancel    → void the linked Sale           (twin rebuild corrects reality)
--
-- sale_event_id / payment_event_id are those bridges. `lines` is jsonb
-- [{description, qty, unit_price}]; `total` is validated server-side to equal
-- the sum of lines (invoices.py compute_total) and stored for cheap listing.
--
-- IDEMPOTENT & NON-DESTRUCTIVE, house conventions. Run in the Supabase SQL
-- editor after 0018.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,

  number           text        not null,               -- INV-0001, per-user sequence
  customer_name    text        not null,               -- as written; party link below
  party_id         uuid        references public.parties(id) on delete set null,

  issued_at        timestamptz,                        -- stamped on send
  due_at           timestamptz,
  currency         text        not null default 'ZMW',
  lines            jsonb       not null default '[]'::jsonb,
  total            numeric     not null default 0,
  notes            text,

  status           text        not null default 'draft',  -- draft|sent|paid|cancelled
  sale_event_id    uuid,                               -- spine bridge (send)
  payment_event_id uuid,                               -- spine bridge (mark paid)
  paid_at          timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_status_chk') then
    alter table public.invoices add constraint invoices_status_chk
      check (status in ('draft','sent','paid','cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_user_number_uq') then
    alter table public.invoices add constraint invoices_user_number_uq
      unique (user_id, number);
  end if;
end $$;

create index if not exists invoices_user_status_idx on public.invoices(user_id, status);
create index if not exists invoices_user_due_idx    on public.invoices(user_id, due_at);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ── Row Level Security (house pattern: self + admin-read) ────────────────────
alter table public.invoices enable row level security;

drop policy if exists invoices_select_self  on public.invoices;
drop policy if exists invoices_insert_self  on public.invoices;
drop policy if exists invoices_update_self  on public.invoices;
drop policy if exists invoices_delete_self  on public.invoices;
drop policy if exists invoices_select_admin on public.invoices;

create policy invoices_select_self  on public.invoices for select using (auth.uid() = user_id);
create policy invoices_insert_self  on public.invoices for insert with check (auth.uid() = user_id);
create policy invoices_update_self  on public.invoices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy invoices_delete_self  on public.invoices for delete using (auth.uid() = user_id);
create policy invoices_select_admin on public.invoices for select using (public.is_admin());

grant select, insert, update, delete on public.invoices to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0019
-- ════════════════════════════════════════════════════════════════════════════
