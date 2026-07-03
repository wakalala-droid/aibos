// lib/outbox.ts — offline outbox for business events.
//
// The recording habit is the product; a dropped connection must never break
// it. When createEvent can't reach the server because the NETWORK is down,
// the event is queued here (localStorage) and posted automatically when
// signal returns. Server rejections are NOT queued — invalid data should
// surface immediately, not silently retry forever.
//
// The service worker never buffers API traffic (see public/sw.js) — this
// module is the single place offline writes live, so the owner can always be
// told exactly what's waiting.

import { createEvent, type EventInput, type BusinessEvent } from './api';

export interface OutboxItem {
  id: string;
  input: EventInput;
  queued_at: string; // ISO
}

const KEY = 'aibos-outbox-v1';

// ── Storage ───────────────────────────────────────────────────────────────────

function read(): OutboxItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch { /* storage full/blocked — items stay in memory of the caller only */ }
  notify();
}

// ── Subscriptions (UI chips re-render on queue changes) ──────────────────────

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeOutbox(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function outboxCount(): number {
  if (typeof window === 'undefined') return 0;
  return read().length;
}

// ── Queue + flush ─────────────────────────────────────────────────────────────

/** True when the failure is the NETWORK (offline/unreachable), not the server. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true; // fetch() network failures are TypeErrors
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network|load failed|fetch failed/i.test(msg);
}

export function queueEvent(input: EventInput): OutboxItem {
  const item: OutboxItem = {
    id: `ob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    input,
    queued_at: new Date().toISOString(),
  };
  write([...read(), item]);
  return item;
}

/**
 * Create an event, queueing it locally if the network is down.
 * Server-side rejections still throw — bad data must surface, not retry.
 */
export async function createEventOrQueue(
  input: EventInput,
): Promise<{ queued: boolean; event?: BusinessEvent }> {
  try {
    const event = await createEvent(input);
    return { queued: false, event };
  } catch (err) {
    if (isNetworkError(err)) {
      queueEvent(input);
      return { queued: true };
    }
    throw err;
  }
}

/**
 * Post everything waiting. Stops at the first network failure (still offline);
 * drops items the server explicitly rejects so one bad record can't jam the
 * queue forever. Returns what happened so callers can refresh the twin and
 * tell the owner.
 */
export async function flushOutbox(): Promise<{ posted: number; rejected: number; remaining: number }> {
  if (typeof window === 'undefined') return { posted: 0, rejected: 0, remaining: 0 };
  let items = read();
  let posted = 0;
  let rejected = 0;

  for (const item of [...items]) {
    try {
      await createEvent(item.input);
      posted += 1;
      items = items.filter((i) => i.id !== item.id);
      write(items);
    } catch (err) {
      if (isNetworkError(err)) break; // still offline — try again later
      rejected += 1;                  // server said no — surface, don't loop
      items = items.filter((i) => i.id !== item.id);
      write(items);
    }
  }
  return { posted, rejected, remaining: items.length };
}
