// lib/notifications.ts — the in-app notification feed (audit #32).
//
// One normalized list of "things that need you", derived DETERMINISTICALLY
// from recorded data (twin + products + debtors) — the same honesty rule as
// the brief and DecisionsQueue: no signal without data behind it, and each
// item deep-links (audit #31) to the records that justify it. This is what
// feeds the header bell so a recording-only user (no uploaded Engine-1
// alerts) still gets meaningful, trustworthy notifications.
//
// Push delivery (web-push/VAPID) is the dormant-keys follow-up; the in-app
// centre is the higher-value half and ships first.
//
// TWO HALVES, ONE BELL.
//   DERIVED (buildNotifications, below) recomputes runway, overdue invoices and
//   low stock in the browser every time the header mounts. Those are CONDITIONS:
//   they have no moment at which they happened, and they clear themselves the
//   moment the condition does.
//   HAPPENED (fetchHappenedNotifications) reads the server feed from migration
//   0030, where a row is written when something actually occurred. A booking
//   request from a property's own website is the one that forced it: the owner
//   asked to be told whenever a booking is made, and a browser recomputing three
//   financial conditions can never carry that promise.
//
// The feed half is best-effort by design. Every failure, including the server's
// own { note } fallback shape, falls back to the derived half in silence,
// because a bell that errors is worse than a quiet one.

import type { Twin, Product } from './api';
import { authHeaders, getDebtors, listProducts } from './api';
import { fmt } from './utils';

const PROXY = '/api/proxy';

export type NotifySeverity = 'critical' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  severity: NotifySeverity;
  title: string;
  description: string;
  href?: string;
  /** Set only on feed items: the server row id, which marking-read needs.
   *  Its absence is how a caller tells a fact apart from a derivation. */
  serverId?: string;
  /** ISO moment the thing happened. Derived alerts have none, on purpose. */
  happenedAt?: string;
}

const RANK: Record<NotifySeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };

/** Build the live notification list. Best-effort per source; a failed fetch
 *  simply contributes nothing. `sym` is the currency symbol. */
export async function buildNotifications(twin: Twin | null, sym: string): Promise<Notification[]> {
  const out: Notification[] = [];

  // ── Cash runway (from the twin's own monthly burn) ──────────────────────────
  if (twin) {
    const cash = Number(twin.cash) || 0;
    const months = Math.max((twin.monthly?.length ?? 0), 1);
    const burn = (Number(twin.total_costs) || 0) / months;
    if (burn > 0) {
      const runway = Math.max(cash, 0) / burn;
      if (runway < 1.5) {
        out.push({
          id: 'runway', severity: 'critical',
          title: 'Cash runway is short',
          description: `About ${runway.toFixed(1)} months of cash left at your current burn.`,
          href: '/dashboard/cash',
        });
      } else if (runway < 3) {
        out.push({
          id: 'runway', severity: 'warning',
          title: 'Watch your cash runway',
          description: `Roughly ${runway.toFixed(1)} months of cash left — plan ahead.`,
          href: '/dashboard/cash',
        });
      }
    }
  }

  // ── Overdue invoices (from the debtors ledger) ──────────────────────────────
  try {
    const aging = await getDebtors();
    const overdue = aging.customers.filter((c) => c.oldest_days > 0);
    const total = overdue.reduce((a, c) => a + (c.buckets['1-30'] + c.buckets['31-60'] + c.buckets['60+']), 0);
    if (overdue.length > 0) {
      const worst = Math.max(...overdue.map((c) => c.oldest_days));
      out.push({
        id: 'overdue', severity: worst > 60 ? 'critical' : 'warning',
        title: `${overdue.length} customer${overdue.length === 1 ? '' : 's'} owe you overdue`,
        description: `${fmt(total, true, sym)} past due — a WhatsApp nudge usually does it.`,
        href: '/dashboard/invoices',
      });
    }
  } catch { /* no invoices / offline — skip */ }

  // ── Low stock (from the catalog's reorder levels) ───────────────────────────
  try {
    const products: Product[] = await listProducts();
    const low = products.filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? p.opening_stock) <= Number(p.reorder_level));
    if (low.length > 0) {
      const out0 = low.filter((p) => Number(p.on_hand ?? p.opening_stock) <= 0);
      out.push({
        id: 'low-stock', severity: out0.length > 0 ? 'critical' : 'warning',
        title: `${low.length} product${low.length === 1 ? '' : 's'} running low`,
        description: low.slice(0, 3).map((p) => p.name).join(', ') + (low.length > 3 ? '…' : ''),
        href: '/dashboard/inventory',
      });
    }
  } catch { /* no products — skip */ }

  out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return out;
}

// ── The server feed: things that HAPPENED (migration 0030) ────────────────────
// Same /api/proxy hop and the same authHeaders() as every other call, so the
// backend scopes the rows to this user and this business with no CORS in play.

/** One row as the backend stores it. Field names match the table, so there is
 *  no second mapping here to drift out of step with migration 0030. */
interface FeedRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  meta: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

/** Colour carries meaning, so a kind has to say which meaning. A booking asked
 *  for is good news that still needs an answer; a cancellation is a loss of
 *  money the owner had counted on. Anything new the backend starts writing
 *  lands on 'info' rather than on nothing at all. */
const FEED_SEVERITY: Record<string, NotifySeverity> = {
  booking_request: 'success',
  booking_cancelled: 'warning',
};

function toNotification(row: FeedRow): Notification {
  // The backend writes the body as several short lines, one fact each, because
  // email needs the breaks. The tray is one line of context under a title, and
  // the full record is one tap away behind the link, so flatten it here.
  const description = (row.body ?? '')
    .split('\n').map((s) => s.trim()).filter(Boolean).join(' ');
  return {
    // Namespaced so a server row can never collide with 'runway' or 'low-stock'.
    id: `feed:${row.id}`,
    serverId: row.id,
    severity: FEED_SEVERITY[row.kind] ?? 'info',
    title: row.title,
    description,
    href: row.link || undefined,
    happenedAt: row.created_at,
  };
}

/** Unread things that happened, newest first.
 *
 *  Returns null, never an empty array, when the feed could not be read. The
 *  difference matters to the caller: [] means "nothing is waiting for you" and
 *  is safe to render, while null means "we do not know" and must leave whatever
 *  is already on screen alone. One bad poll should not blank the bell.
 *
 *  A server-side read failure answers 200 with { notifications: [], note }, so
 *  the note is checked as carefully as the HTTP status. */
export async function fetchHappenedNotifications(limit = 20): Promise<Notification[] | null> {
  try {
    const res = await fetch(`${PROXY}/notifications?unread_only=true&limit=${limit}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { notifications?: FeedRow[]; note?: string };
    if (typeof data.note === 'string') return null;
    return (data.notifications ?? []).map(toNotification);
  } catch {
    // Offline, no session, or an HTML error page from the proxy. All of them
    // mean the same thing to the bell: show the derived half and say nothing.
    return null;
  }
}

/** Mark one row read. Best-effort: a failure just means the row comes back on
 *  the next poll, which is the harmless direction to fail in. */
export async function markNotificationRead(serverId: string): Promise<void> {
  try {
    await fetch(`${PROXY}/notifications/${encodeURIComponent(serverId)}/read`, {
      method: 'POST',
      headers: await authHeaders(),
    });
  } catch { /* the owner has already moved on to the record itself */ }
}

/** One list for the bell: what happened on top, what was derived below.
 *
 *  Newest first only sorts things that have a date. A derived alert has none,
 *  and pretending it happened "now" would park a recomputed condition above a
 *  booking that arrived this morning on every single mount. So the rule the
 *  owner actually asked for falls out cleanly: a thing that happened outranks a
 *  derived alert, and the derived ones keep the severity order buildNotifications
 *  already gave them. */
export function mergeNotifications(happened: Notification[], derived: Notification[]): Notification[] {
  // Parsed, not compared as text: the same instant can be written with a +02:00
  // offset or a Z, and sorting those as strings puts them in the wrong order.
  const at = (item: Notification) => {
    const t = Date.parse(item.happenedAt ?? '');
    return Number.isFinite(t) ? t : 0;
  };
  const newestFirst = [...happened].sort((a, b) => at(b) - at(a));
  return [...newestFirst, ...derived];
}

/** "20 minutes ago" for a feed row. Plain words, no clock arithmetic for the
 *  reader to do. Empty for anything undated, which is how derived alerts skip
 *  the line entirely. */
export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString();
}
