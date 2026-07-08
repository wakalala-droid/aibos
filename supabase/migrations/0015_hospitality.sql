-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — Hospitality module  (migration 0015)   ·   Short-let PMS layer
-- ────────────────────────────────────────────────────────────────────────────
-- A property-operations layer bolted onto the financial core for short-let /
-- serviced-apartment operators (v1 client: Dunslim Apartments, Lusaka — 3 units).
--
-- Design notes that this schema deliberately follows:
--   • Tenant column is user_id (NOT org_id) — matches the event spine and every
--     other AI-BOS table, so RLS and the record bridge line up. A business_id
--     seam is reserved (ADR-001 D2) but null in v1, as in 0014.
--   • units is the SINGLE SOURCE OF TRUTH for amenities / bed-bath / base rate.
--     Every OTA channel pulls from this row — the fix for the diverging-listing
--     problem the client audit found.
--   • Money does NOT get wired into engine.py here. A confirmed booking posts a
--     Sale event and an expense posts an Expense event through the event spine
--     (nervous_system.ingest), the same record bridge payroll (0014) and the
--     Scheduler (0012) use — so occupancy revenue and property costs flow into
--     the existing P&L / cashflow / anomaly reports for free. linked_event_id on
--     bookings/expenses is that bridge.
--   • guests.id_document_number holds APPLICATION-LEVEL ciphertext (Fernet in the
--     API), never plaintext — Supabase's transparent at-rest encryption does not
--     protect against a leaked service-role key, and the whole API runs on that
--     key. The column is text because it stores an opaque token.
--
-- Enums are text + guarded CHECK constraints (the 0014 convention, not pg enums,
-- so adding a value later is a one-line non-migrating change). IDEMPOTENT &
-- NON-DESTRUCTIVE. Reuses set_updated_at() and is_admin() from migration 0001.
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ── properties ───────────────────────────────────────────────────────────────
create table if not exists public.properties (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid,                                    -- reserved seam, null in v1

  name         text not null,                           -- "Dunslim Apartments — Makeni Road"
  address      text,
  latitude     numeric,
  longitude    numeric,
  description  text,
  status       text not null default 'active',          -- active|inactive|maintenance

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── units ── SINGLE SOURCE OF TRUTH for a listing ────────────────────────────
create table if not exists public.units (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  property_id       uuid not null references public.properties(id) on delete cascade,

  unit_name         text not null,                      -- "Unit A — 2BR"
  bedrooms          integer not null default 0,
  bathrooms         numeric not null default 0,
  max_guests        integer not null default 1,
  amenities         jsonb not null default '[]'::jsonb, -- canonical list, pushed to every channel
  base_nightly_rate numeric not null default 0,
  currency          text not null default 'ZMW',
  photos            jsonb not null default '[]'::jsonb, -- array of storage URLs

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── channels ── one row per place a unit is listed / synced ──────────────────
create table if not exists public.channels (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  unit_id              uuid not null references public.units(id) on delete cascade,

  channel_type         text not null default 'direct',  -- direct|booking_com|airbnb|ical_generic
  external_listing_id  text,
  ical_import_url      text,                             -- pull availability from an OTA
  ical_export_token    text,                             -- opaque token for the AI-BOS-hosted feed URL
  sync_status          text not null default 'unconfigured', -- ok|error|unconfigured
  last_synced_at       timestamptz,
  last_sync_note       text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── guests ── the CRM master record ──────────────────────────────────────────
create table if not exists public.guests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,

  full_name          text not null,
  email              text,
  phone              text,                               -- E.164, WhatsApp-compatible
  id_document_type   text,                               -- passport|national_id|other
  id_document_number text,                               -- APP-LEVEL CIPHERTEXT (never plaintext)
  nationality        text,
  is_repeat_guest    boolean not null default false,     -- maintained by the app on booking write
  stay_count         integer not null default 0,
  notes              text,                               -- staff-only discretion notes
  vip_flag           boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── bookings ── the core reservation record ──────────────────────────────────
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  unit_id         uuid not null references public.units(id) on delete cascade,
  guest_id        uuid references public.guests(id) on delete set null,
  channel_id      uuid references public.channels(id) on delete set null, -- null = direct

  check_in        date not null,
  check_out       date not null,
  guests_count    integer not null default 1,
  status          text not null default 'confirmed',     -- confirmed|pending|cancelled|completed|no_show
  total_amount    numeric not null default 0,
  currency        text not null default 'ZMW',
  deposit_amount  numeric,
  payment_status  text not null default 'unpaid',         -- unpaid|partial|paid|refunded
  source_notes    text,

  -- Record bridge → the Sale business_event this booking posted (revenue in the
  -- books). Null until posted / for held blocks pulled from an OTA calendar.
  linked_event_id uuid references public.business_events(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── rate_rules ── seasonal / dow / min-stay adjustments over base_nightly_rate ─
create table if not exists public.rate_rules (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  unit_id          uuid not null references public.units(id) on delete cascade,

  rule_type        text not null,                         -- seasonal|day_of_week|min_stay_discount
  start_date       date,
  end_date         date,
  days_of_week     integer[],                             -- 0–6, for day_of_week rules
  min_nights       integer,                               -- for min_stay_discount
  adjustment_type  text not null default 'percentage',    -- fixed_override|percentage
  adjustment_value numeric not null default 0,
  priority         integer not null default 0,            -- stacking order (higher wins)
  active           boolean not null default true,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── housekeeping_tasks ───────────────────────────────────────────────────────
create table if not exists public.housekeeping_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  unit_id      uuid not null references public.units(id) on delete cascade,
  booking_id   uuid references public.bookings(id) on delete set null, -- checkout that triggered it

  task_type    text not null default 'turnover_clean',   -- turnover_clean|deep_clean|maintenance|inspection
  due_date     date,
  assigned_to  text,                                      -- staff name/contact (no staff-auth at this scale)
  status       text not null default 'pending',           -- pending|in_progress|done|blocked
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── expenses ── property costs; feeds engine.py via the spine ────────────────
create table if not exists public.hospitality_expenses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  property_id    uuid references public.properties(id) on delete set null,
  unit_id        uuid references public.units(id) on delete set null,      -- null = property-level

  category       text not null default 'other',           -- utilities|staff|security|cleaning_supplies|maintenance|marketing|ota_commission|other
  amount         numeric not null default 0,
  currency       text not null default 'ZMW',
  date_incurred  date,
  description    text,
  receipt_url    text,

  -- Record bridge → the Expense business_event this row posted (cost in the books).
  linked_event_id uuid references public.business_events(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── reviews ── consolidated across sources (manual entry / CSV first) ────────
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  unit_id       uuid references public.units(id) on delete set null,

  source        text not null default 'direct',           -- booking_com|airbnb|direct|google
  rating        numeric,                                   -- normalised to a 5-point scale
  review_text   text,
  reviewer_name text,
  review_date   date,
  response_text text,                                      -- owner/staff reply, drafted in-app

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── referral_partners ────────────────────────────────────────────────────────
create table if not exists public.referral_partners (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  partner_type    text not null default 'other',           -- restaurant|influencer|corporate_agent|other
  name            text not null,
  contact_info    text,
  referral_code   text,
  commission_type text not null default 'flat',            -- flat|percentage|reciprocal_nonmonetary
  commission_value numeric,
  active          boolean not null default true,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── referral_events ──────────────────────────────────────────────────────────
create table if not exists public.referral_events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  referral_partner_id uuid not null references public.referral_partners(id) on delete cascade,
  booking_id          uuid references public.bookings(id) on delete set null,

  event_type          text not null default 'booking_attributed', -- booking_attributed|restaurant_referral_sent|content_posted
  value               numeric,                             -- commission owed / revenue attributed
  event_date          date,

  created_at          timestamptz not null default now()
);

-- ── messages_log ── transactional guest comms only ──────────────────────────
create table if not exists public.messages_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  booking_id      uuid references public.bookings(id) on delete set null,

  channel         text not null default 'whatsapp',        -- whatsapp|sms|email
  direction       text not null default 'outbound',        -- outbound|inbound
  template_used   text,                                    -- pre_arrival|check_in_instructions|post_stay_review_request
  body            text,
  sent_at         timestamptz not null default now(),
  delivery_status text not null default 'sent',            -- sent|delivered|failed

  created_at      timestamptz not null default now()
);

-- ── Guarded CHECK constraints (added only if missing, so re-runs don't error) ─
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_status_chk') then
    alter table public.properties add constraint properties_status_chk
      check (status in ('active','inactive','maintenance'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'units_counts_chk') then
    alter table public.units add constraint units_counts_chk
      check (bedrooms >= 0 and bathrooms >= 0 and max_guests >= 1 and base_nightly_rate >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'channels_type_chk') then
    alter table public.channels add constraint channels_type_chk
      check (channel_type in ('direct','booking_com','airbnb','ical_generic'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'channels_sync_chk') then
    alter table public.channels add constraint channels_sync_chk
      check (sync_status in ('ok','error','unconfigured'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'guests_id_type_chk') then
    alter table public.guests add constraint guests_id_type_chk
      check (id_document_type is null or id_document_type in ('passport','national_id','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_status_chk') then
    alter table public.bookings add constraint bookings_status_chk
      check (status in ('confirmed','pending','cancelled','completed','no_show'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_pay_chk') then
    alter table public.bookings add constraint bookings_pay_chk
      check (payment_status in ('unpaid','partial','paid','refunded'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_dates_chk') then
    alter table public.bookings add constraint bookings_dates_chk
      check (check_out > check_in);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rate_rules_type_chk') then
    alter table public.rate_rules add constraint rate_rules_type_chk
      check (rule_type in ('seasonal','day_of_week','min_stay_discount')
         and adjustment_type in ('fixed_override','percentage'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'housekeeping_type_chk') then
    alter table public.housekeeping_tasks add constraint housekeeping_type_chk
      check (task_type in ('turnover_clean','deep_clean','maintenance','inspection')
         and status in ('pending','in_progress','done','blocked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hospitality_expenses_cat_chk') then
    alter table public.hospitality_expenses add constraint hospitality_expenses_cat_chk
      check (category in ('utilities','staff','security','cleaning_supplies','maintenance','marketing','ota_commission','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_source_chk') then
    alter table public.reviews add constraint reviews_source_chk
      check (source in ('booking_com','airbnb','direct','google'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referral_partners_type_chk') then
    alter table public.referral_partners add constraint referral_partners_type_chk
      check (partner_type in ('restaurant','influencer','corporate_agent','other')
         and commission_type in ('flat','percentage','reciprocal_nonmonetary'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referral_code_user_uq') then
    alter table public.referral_partners add constraint referral_code_user_uq
      unique (user_id, referral_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referral_events_type_chk') then
    alter table public.referral_events add constraint referral_events_type_chk
      check (event_type in ('booking_attributed','restaurant_referral_sent','content_posted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_log_chk') then
    alter table public.messages_log add constraint messages_log_chk
      check (channel in ('whatsapp','sms','email') and direction in ('outbound','inbound')
         and delivery_status in ('sent','delivered','failed'));
  end if;
end $$;

-- ── Indexes — every read is (tenant, …) ──────────────────────────────────────
create index if not exists properties_user_idx           on public.properties(user_id);
create index if not exists units_user_property_idx        on public.units(user_id, property_id);
create index if not exists channels_user_unit_idx         on public.channels(user_id, unit_id);
create index if not exists guests_user_idx                on public.guests(user_id);
create index if not exists bookings_user_unit_idx         on public.bookings(user_id, unit_id);
create index if not exists bookings_unit_dates_idx        on public.bookings(unit_id, check_in, check_out);
create index if not exists bookings_user_status_idx       on public.bookings(user_id, status);
create index if not exists rate_rules_user_unit_idx       on public.rate_rules(user_id, unit_id);
create index if not exists housekeeping_user_status_idx   on public.housekeeping_tasks(user_id, status);
create index if not exists hospitality_expenses_user_idx  on public.hospitality_expenses(user_id, property_id);
create index if not exists reviews_user_unit_idx          on public.reviews(user_id, unit_id);
create index if not exists referral_partners_user_idx     on public.referral_partners(user_id);
create index if not exists referral_events_user_idx       on public.referral_events(user_id, referral_partner_id);
create index if not exists messages_log_user_booking_idx  on public.messages_log(user_id, booking_id);

-- ── updated_at triggers (referral_events & messages_log are append-only) ──────
do $$
declare t text;
begin
  foreach t in array array[
    'properties','units','channels','guests','bookings','rate_rules',
    'housekeeping_tasks','hospitality_expenses','reviews','referral_partners'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I;', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- ── RLS: self-scoped CRUD + admin read (mirrors 0014) ────────────────────────
-- Generated uniformly for every table: SELECT/INSERT/UPDATE/DELETE where
-- auth.uid() = user_id, plus an admin SELECT. The backend also writes via the
-- service-role client, which bypasses RLS — auth.py has already verified the
-- caller, exactly as in payroll/scheduler.
do $$
declare t text;
begin
  foreach t in array array[
    'properties','units','channels','guests','bookings','rate_rules',
    'housekeeping_tasks','hospitality_expenses','reviews','referral_partners',
    'referral_events','messages_log'
  ] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I_select_self  on public.%I;', t, t);
    execute format('drop policy if exists %I_insert_self  on public.%I;', t, t);
    execute format('drop policy if exists %I_update_self  on public.%I;', t, t);
    execute format('drop policy if exists %I_delete_self  on public.%I;', t, t);
    execute format('drop policy if exists %I_select_admin on public.%I;', t, t);

    execute format('create policy %I_select_self on public.%I for select using (auth.uid() = user_id);', t, t);
    execute format('create policy %I_insert_self on public.%I for insert with check (auth.uid() = user_id);', t, t);
    execute format('create policy %I_update_self on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t, t);
    execute format('create policy %I_delete_self on public.%I for delete using (auth.uid() = user_id);', t, t);
    execute format('create policy %I_select_admin on public.%I for select using (public.is_admin());', t, t);

    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0015
-- ════════════════════════════════════════════════════════════════════════════
