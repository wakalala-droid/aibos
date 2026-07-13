// lib/briefData.ts — one fetcher for everything the Morning Brief needs
// beyond the twin (audit #9). SimpleHome and the Today card both call this,
// so the brief's inputs can never drift between surfaces. Every source is
// best-effort (Promise.allSettled): a failed fetch omits its lines rather
// than breaking the homepage.

import { listProducts, listEvents, listSchedule, listInvoices, type Product, type BusinessEvent } from './api';
import { bucketSales, expectedOf } from './brief';

export interface BriefExtras {
  products: Product[];
  salesToday: BusinessEvent[];
  salesYesterday: BusinessEvent[];
  expectedDeliveries: BusinessEvent[];
  commitmentsToday: string[];
  overdueInvoices: { count: number; total: number } | null;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return d.getHours() === 0 && d.getMinutes() === 0
    ? ''
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export async function fetchBriefExtras(): Promise<BriefExtras> {
  const [p, e, r, s, inv] = await Promise.allSettled([
    listProducts(),
    listEvents({ event_type: 'Sale', limit: 300 }),
    listEvents({ event_type: 'InventoryReceipt', status: 'pending', limit: 50 }),
    listSchedule(2),
    listInvoices('sent'),
  ]);

  const { today, yesterday } = bucketSales(e.status === 'fulfilled' ? e.value : []);

  // Today's commitments: scheduled items starting before local midnight.
  const endToday = new Date(); endToday.setHours(24, 0, 0, 0);
  const commitments = (s.status === 'fulfilled' ? s.value : [])
    .filter((it) => it.status === 'scheduled' && new Date(it.starts_at) < endToday)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((it) => {
      const t = timeOf(it.starts_at);
      return t ? `${it.title} — ${t}` : it.title;
    });

  const nowIso = new Date().toISOString();
  const overdue = (inv.status === 'fulfilled' ? inv.value : [])
    .filter((i) => i.due_at && i.due_at < nowIso);

  return {
    products: p.status === 'fulfilled' ? p.value : [],
    salesToday: today,
    salesYesterday: yesterday,
    expectedDeliveries: expectedOf(r.status === 'fulfilled' ? r.value : []),
    commitmentsToday: commitments,
    overdueInvoices: overdue.length > 0
      ? { count: overdue.length, total: overdue.reduce((a, i) => a + i.total, 0) }
      : null,
  };
}
