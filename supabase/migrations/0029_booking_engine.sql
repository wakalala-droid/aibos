-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS — The booking request as real data  (migration 0029)
-- ────────────────────────────────────────────────────────────────────────────
-- A booking request arriving from a property's own website carried the guest's
-- name, email, phone, organisation, reason for coming, arrival time, how they
-- intend to pay, their note and their reference. ALL OF IT was joined into one
-- English sentence and written to `source_notes`, a free-text column nothing
-- reads back. The owner could see that somebody wanted a room and almost
-- nothing else, and no report, filter or search could ever reach any of it.
--
-- This turns those details into columns.
--
-- WHY THE CONTACT DETAILS ARE ON THE BOOKING AND ALSO ON THE GUEST.
-- They are not the same fact. `guests` is the CRM record of who a person IS;
-- these columns are what they TOLD US on this particular stay, which is the
-- number to ring about this booking even if the profile later changes. It also
-- makes the details survive the one path that can drop them: creating the guest
-- record on a public request is best-effort by design, because a request is
-- worth more than a CRM row, and until now a failure there lost the phone
-- number with it.
--
-- WHY ONLY `status` AND `source` ARE CONSTRAINED.
-- Those two are set by our own code and nothing else. `purpose`,
-- `payment_method` and `arrival_time` come from a form a stranger fills in on a
-- website that can change without this database being told. A CHECK there would
-- mean a guest losing a real booking because a marketing page added a new
-- dropdown option, so they are free text, normalised in the app instead.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- RLS already governs `bookings` from 0015; this only adds columns to an
-- already-secured table, so no new policy is needed.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. What the guest actually told us ──────────────────────────────────────
alter table public.bookings add column if not exists reference       text;
alter table public.bookings add column if not exists source          text not null default 'direct';
alter table public.bookings add column if not exists guest_name      text;
alter table public.bookings add column if not exists guest_email     text;
alter table public.bookings add column if not exists guest_phone     text;
alter table public.bookings add column if not exists organisation    text;
alter table public.bookings add column if not exists purpose         text;
alter table public.bookings add column if not exists arrival_time    text;
alter table public.bookings add column if not exists payment_method  text;
alter table public.bookings add column if not exists guest_notes     text;

-- What the website quoted them, kept apart from total_amount so an owner can
-- adjust what is actually charged without losing what the guest was shown.
alter table public.bookings add column if not exists quoted_total    numeric;

-- ── 2. When the decision was made, and why ──────────────────────────────────
-- An owner asked to see "who, when, what". created_at is the when of the
-- request; these are the when of the answer.
alter table public.bookings add column if not exists confirmed_at    timestamptz;
alter table public.bookings add column if not exists declined_at     timestamptz;
alter table public.bookings add column if not exists cancelled_at    timestamptz;
alter table public.bookings add column if not exists decline_reason  text;

-- ── 3. `declined` is not `cancelled` ────────────────────────────────────────
-- Cancelled means a stay that was agreed and then called off. Declined means a
-- request that was never agreed to in the first place. A booking engine has to
-- tell those apart: they are different conversations with the guest, different
-- rows in a report, and only one of them is ever a refund.
--
-- Both free the dates, so `declined` must stay OUT of BLOCKING_STATUSES in
-- hospitality.py. Keep this list and BOOKING_STATUSES there in lock-step;
-- test_booking_engine.py asserts they match.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'bookings_status_chk') then
    alter table public.bookings drop constraint bookings_status_chk;
  end if;
  alter table public.bookings add constraint bookings_status_chk
    check (status in ('confirmed','pending','cancelled','completed','no_show','declined'));

  if not exists (select 1 from pg_constraint where conname = 'bookings_source_chk') then
    alter table public.bookings add constraint bookings_source_chk
      check (source in ('direct','website','ota','phone','walk_in'));
  end if;
end $$;

-- ── 4. The queries this module actually runs ────────────────────────────────
-- The pending queue: "what is waiting on me, soonest arrival first".
create index if not exists bookings_status_idx
  on public.bookings(user_id, status, check_in);

-- Looking a guest up by the reference they quote on WhatsApp.
create index if not exists bookings_reference_idx
  on public.bookings(user_id, reference)
  where reference is not null;

-- A guest's own history, for the profile page.
create index if not exists bookings_guest_idx
  on public.bookings(user_id, guest_id)
  where guest_id is not null;

-- ── 5. Backfill what can be recovered ───────────────────────────────────────
-- Existing rows keep their source_notes verbatim; nothing is deleted. Only the
-- two facts that can be derived without parsing English are set: anything that
-- came through a channel was an OTA, and anything already carrying a website
-- request in its notes was a website booking.
update public.bookings
   set source = 'ota'
 where channel_id is not null and source = 'direct';

update public.bookings
   set source = 'website'
 where source = 'direct'
   and source_notes is not null
   and source_notes like 'Website booking request%';

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0029
-- ════════════════════════════════════════════════════════════════════════════
