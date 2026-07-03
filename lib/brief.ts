// lib/brief.ts — the Morning Brief (Pro+).
//
// A deterministic daily digest composed ENTIRELY from recorded data: the twin,
// the product catalog and the event log. No model call, no fabrication — if a
// line has no data behind it, the line is omitted (SAFEGUARD §0.1). This is
// the "AIBOS runs your day" moment: the owner opens the chat and the day is
// already summarised, with one concrete thing to do next.

import type { Twin, Product, BusinessEvent } from './api';
import { fmt } from './utils';

export interface BriefInputs {
  sym: string;
  businessName?: string | null;
  twin: Twin | null;
  products: Product[];
  /** Confirmed Sale events from today (local midnight onward). */
  salesToday: BusinessEvent[];
  /** Confirmed Sale events from yesterday. */
  salesYesterday: BusinessEvent[];
  /** Pending InventoryReceipt events dated today or later = expected deliveries. */
  expectedDeliveries: BusinessEvent[];
}

function sum(events: BusinessEvent[]): number {
  return events.reduce((t, e) => t + (Number(e.payload?.amount) || 0), 0);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Split a Sale list into [today, yesterday] buckets by occurred_at. */
export function bucketSales(sales: BusinessEvent[]): { today: BusinessEvent[]; yesterday: BusinessEvent[] } {
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
  const today: BusinessEvent[] = [];
  const yesterday: BusinessEvent[] = [];
  for (const e of sales) {
    if (e.status === 'void') continue;
    const at = new Date(e.occurred_at);
    if (at >= startToday) today.push(e);
    else if (at >= startYesterday) yesterday.push(e);
  }
  return { today, yesterday };
}

/** Pending receipts dated today or later — the deliveries the owner expects. */
export function expectedOf(receipts: BusinessEvent[]): BusinessEvent[] {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return receipts
    .filter((e) => e.status === 'pending' && new Date(e.occurred_at) >= start)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
}

export function composeMorningBrief(inp: BriefInputs): string {
  const money = (n: number) => fmt(n, true, inp.sym);
  const lines: string[] = [];
  const now = new Date();

  lines.push(`**Your Morning Brief — ${dayLabel(now)}**`);

  // Money position — always leads; it's the number every owner wakes up to.
  if (inp.twin) {
    const cash = Number(inp.twin.cash) || 0;
    const recv = Number(inp.twin.receivables) || 0;
    const pay = Number(inp.twin.payables) || 0;
    let m = `💰 Cash: **${money(cash)}**.`;
    if (recv > 0) m += ` Customers owe you ${money(recv)}.`;
    if (pay > 0) m += ` You owe suppliers ${money(pay)}.`;
    lines.push(m);
  }

  // How the trading day is going / went.
  const tToday = sum(inp.salesToday);
  const tYest = sum(inp.salesYesterday);
  if (inp.salesToday.length > 0) {
    lines.push(`📈 Today so far: ${inp.salesToday.length} sale${inp.salesToday.length === 1 ? '' : 's'}, **${money(tToday)}**.`);
  }
  if (inp.salesYesterday.length > 0) {
    lines.push(`🗓️ Yesterday: ${inp.salesYesterday.length} sale${inp.salesYesterday.length === 1 ? '' : 's'}, ${money(tYest)}.`);
  } else if (inp.twin && Number(inp.twin.event_count) > 0 && inp.salesToday.length === 0) {
    lines.push('🗓️ No sales recorded yesterday or today yet.');
  }

  // Stock watch.
  const low = inp.products.filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? 0) <= Number(p.reorder_level));
  if (low.length > 0) {
    const names = low.slice(0, 3).map((p) => `${p.name} (${Number(p.on_hand ?? 0)} left)`).join(', ');
    lines.push(`📦 Stock: **${low.length} item${low.length === 1 ? '' : 's'} low** — ${names}${low.length > 3 ? '…' : ''}.`);
  } else if (inp.products.length > 0) {
    lines.push(`📦 Stock: all ${inp.products.length} items above reorder level.`);
  }

  // Expected deliveries (pending receipts dated today+).
  const startTomorrow = new Date(); startTomorrow.setHours(24, 0, 0, 0);
  const dueToday = inp.expectedDeliveries.filter((e) => new Date(e.occurred_at) < startTomorrow);
  if (dueToday.length > 0) {
    const first = dueToday[0];
    const from = first.payload?.supplier ? ` from ${String(first.payload.supplier)}` : '';
    lines.push(`🚚 Expected today: ${String(first.payload?.item ?? 'a delivery')}${from}${dueToday.length > 1 ? ` (+${dueToday.length - 1} more)` : ''} — confirm it on **Activity** when it arrives.`);
  } else if (inp.expectedDeliveries.length > 0) {
    const next = inp.expectedDeliveries[0];
    lines.push(`🚚 Next expected delivery: ${dayLabel(new Date(next.occurred_at))}${next.payload?.supplier ? ` from ${String(next.payload.supplier)}` : ''}.`);
  }

  // One thing today — a single, concrete next action (never a list; decision
  // simplification per ux_intelligence.md).
  let action: string | null = null;
  if (low.length > 0) {
    action = `reorder ${low[0].name}${low[0].supplier ? ` from ${low[0].supplier}` : ''} before it runs out`;
  } else if (inp.twin && Number(inp.twin.receivables) > 0) {
    action = `collect part of the ${money(Number(inp.twin.receivables))} customers owe you`;
  } else if (inp.salesToday.length === 0 && inp.salesYesterday.length === 0) {
    action = 'record today\'s sales as they happen — everything else flows from that';
  }
  if (action) lines.push(`🎯 One thing today: ${action}.`);

  if (lines.length === 1) {
    return "**Your Morning Brief**\n\nNothing recorded yet — once you start recording sales and stock, I'll have your day summarised here every morning.";
  }
  return lines.join('\n\n');
}
