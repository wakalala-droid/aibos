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

import type { Twin, Product } from './api';
import { getDebtors, listProducts } from './api';
import { fmt } from './utils';

export type NotifySeverity = 'critical' | 'warning' | 'info';

export interface Notification {
  id: string;
  severity: NotifySeverity;
  title: string;
  description: string;
  href?: string;
}

const RANK: Record<NotifySeverity, number> = { critical: 0, warning: 1, info: 2 };

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
