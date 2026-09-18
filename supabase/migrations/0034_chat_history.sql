-- ════════════════════════════════════════════════════════════════════════════
-- AI-BOS: the AI chat remembers  (migration 0034)
-- ────────────────────────────────────────────────────────────────────────────
-- The chat forgot everything. Each question went to the AI on its own, so
-- "and last month?" after "how much did we make in August?" meant nothing to
-- it, and the owner had to say the whole thing again. The conversation also
-- lived only in the open page: a reload, a second device or tomorrow morning
-- started from nothing.
--
-- This table keeps each person's conversation, per business. The website shows
-- it again when the chat opens, and sends the recent part of it with every
-- question so the AI answers in context.
--
-- WHOSE CONVERSATION. The person typing (user_id), within the business they
-- are working in (business_id). Staff invited into a business keep their own
-- conversation; the owner never sees a staff member's questions, and a
-- conversation about one business never leaks into another.
--
-- Without this migration the chat still remembers within the page and on that
-- one device (the browser keeps a copy). Running it makes the memory follow
-- the owner to every device.
--
-- IDEMPOTENT & NON-DESTRUCTIVE. Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete cascade,

  role         text not null check (role in ('user', 'assistant')),
  content      text not null,

  -- The browser's own id for the message. Saving is retried when the signal
  -- drops, and a retry must not put the same message in twice.
  client_id    text,

  created_at   timestamptz not null default now(),

  constraint chat_messages_client_unique unique (user_id, client_id)
);

-- The one query this table serves: one person's recent conversation in one
-- business, newest first.
create index if not exists chat_messages_thread_idx
  on public.chat_messages(user_id, business_id, created_at desc);

-- ── RLS: a person reads only their own conversation; the API writes ─────────
alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select_self on public.chat_messages;
create policy chat_messages_select_self on public.chat_messages
  for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- End migration 0034
-- ════════════════════════════════════════════════════════════════════════════
