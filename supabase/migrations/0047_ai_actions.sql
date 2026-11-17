-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: AIBOS does things when the owner asks  (migration 0047)
-- ────────────────────────────────────────────────────────────────────────────
-- Phase 2 of AIBOS as Jarvis. The chat could only look things up. Now the
-- owner can say "remind me to pay rent on Friday" or "I sold 3 crates to
-- Banda for K360" and AIBOS does it, at the level of trust each kind of job
-- has earned:
--
--   * do it      small jobs that are easy to take back (a reminder, a draft
--                invoice). AIBOS does them at once and offers Undo.
--   * ask first  anything that puts money in the books, sends an invoice or
--                marks one paid. AIBOS says what it will do and waits for one
--                "yes", typed or spoken.
--   * earned     after the owner has said yes to the same kind of entry five
--                times in a row without taking one back, AIBOS offers to do
--                those by itself. Only entries no bigger than the largest one
--                the owner approved by hand, and Undo is always there.
--
-- AIBOS never sends a message to anyone and never moves money.
--
--   * ai_actions    every job AIBOS was asked to do, what it said it would
--                   do, whether the owner said yes, and what it did. The log
--                   behind Undo, the "earned" count and, later, the "Needs
--                   you" list.
--   * ai_autopilot  the kinds of job the owner has told AIBOS to do by itself.
--
-- Without this migration the chat still answers questions; it says it cannot
-- do jobs yet, and recording a sale from the chat works as before.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.ai_actions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete cascade,
  -- Who asked (the owner today; staff later).
  actor_id     uuid,

  kind         text not null,
  -- What the job needs, already checked: the reminder, the entry, the invoice.
  args         jsonb not null default '{}'::jsonb,
  -- The job in the owner's words: "Record a sale of K360.00 to Banda".
  said         text not null,

  status       text not null default 'waiting',
  -- How it ran: did (small job, done at once), asked (the owner said yes),
  -- automatic (a kind the owner told AIBOS to do by itself).
  how          text,
  -- What it made (ids), so Undo knows what to take back.
  result       jsonb,
  -- Where the job came from: chat, talk, or a worker (phase 3).
  source       text not null default 'chat',
  -- The chat question it came from. The chat can send one question twice
  -- (the stream fails, the plain request tries again); the same job from the
  -- same question is found here and not done twice.
  ref          text,

  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_actions_status_chk') then
    alter table public.ai_actions add constraint ai_actions_status_chk
      check (status in ('waiting', 'done', 'declined', 'undone', 'failed', 'expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_actions_how_chk') then
    alter table public.ai_actions add constraint ai_actions_how_chk
      check (how is null or how in ('did', 'asked', 'automatic'));
  end if;
end $$;

-- The two reads: one business's recent jobs (the log, the earned count), and
-- what is still waiting for the owner.
create index if not exists ai_actions_recent_idx
  on public.ai_actions(user_id, business_id, created_at desc);
create index if not exists ai_actions_waiting_idx
  on public.ai_actions(user_id, business_id) where status = 'waiting';

create table if not exists public.ai_autopilot (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete cascade,
  kind         text not null,
  is_on        boolean not null default false,
  updated_at   timestamptz not null default now(),

  constraint ai_autopilot_one unique (user_id, business_id, kind)
);

-- ── RLS: the owner reads their own; the API writes ──────────────────────────
alter table public.ai_actions enable row level security;
alter table public.ai_autopilot enable row level security;

drop policy if exists ai_actions_select_self on public.ai_actions;
create policy ai_actions_select_self on public.ai_actions
  for select using (auth.uid() = user_id);

drop policy if exists ai_autopilot_select_self on public.ai_autopilot;
create policy ai_autopilot_select_self on public.ai_autopilot
  for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0047
-- ════════════════════════════════════════════════════════════════════════════
