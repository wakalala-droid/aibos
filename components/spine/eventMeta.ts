// AIBOS — Business Event display helpers (Evolution spine).
// Pure helpers shared by the Timeline and Record surfaces so event rendering is
// consistent everywhere (component_system.md: same meaning → same component).
import type { BusinessEvent, EventType } from '@/lib/api';
import { localDay, dayWords } from '@/lib/moneyLine';

// Cash direction for color/sign — mirrors the projector's fold (digital_twin.py).
const CASH_IN: EventType[] = ['Sale', 'CustomerPayment', 'Loan', 'Refund'];
const CASH_OUT: EventType[] = [
  'Purchase', 'Expense', 'Salary', 'SupplierPayment',
  'TaxPayment', 'AssetPurchase', 'InventoryReceipt',
];

/** A sale or purchase on credit moved no cash: it is money owed. */
export function onCredit(ev: BusinessEvent): boolean {
  return String(ev.payload?.payment_method ?? '').toLowerCase() === 'credit'
    && ['Sale', 'Purchase', 'InventoryReceipt'].includes(ev.event_type);
}

/** +1 inflow, -1 outflow, 0 neutral. Loan/Refund depend on direction.
 *  A credit sale is 0: showing it as "+K2,000" beside the "+K2,000" of the
 *  payment that settles it read as the same money coming in twice. */
export function cashSign(ev: BusinessEvent): -1 | 0 | 1 {
  if (onCredit(ev)) return 0;
  const dir = String((ev.payload?.direction ?? '')).toLowerCase();
  if (ev.event_type === 'Loan') return dir === 'repayment' ? -1 : 1;
  if (ev.event_type === 'Refund') return dir === 'from_supplier' ? 1 : -1;
  if (CASH_IN.includes(ev.event_type)) return 1;
  if (CASH_OUT.includes(ev.event_type)) return -1;
  return 0;
}

export function amountOf(ev: BusinessEvent): number {
  const a = ev.payload?.amount;
  return typeof a === 'number' ? a : Number(a) || 0;
}

/** Record types as an owner says them. The list showed the internal names:
 *  "CustomerPayment", "TaxPayment", "InventoryAdjustment". */
export const TYPE_LABEL: Record<EventType, string> = {
  Sale: 'Sale',
  Purchase: 'Purchase',
  Expense: 'Expense',
  InventoryReceipt: 'Stock received',
  InventoryAdjustment: 'Stock count change',
  Salary: 'Wages',
  SupplierPayment: 'Paid a supplier',
  CustomerPayment: 'Payment received',
  AssetPurchase: 'Equipment bought',
  TaxPayment: 'Tax payment',
  Loan: 'Loan',
  Refund: 'Refund',
  Transfer: 'Transfer',
};

export function typeLabel(t: EventType | string): string {
  return TYPE_LABEL[t as EventType] ?? String(t);
}

/** One-line human summary, e.g. "Sale · Alice" or "Expense · rent". */
export function summarize(ev: BusinessEvent): string {
  const p = ev.payload || {};
  const who = p.customer || p.supplier || p.employee || p.category || p.asset_name || p.item || p.tax_type;
  const dir = String(p.direction ?? '').toLowerCase();
  let kind = typeLabel(ev.event_type);
  if (ev.event_type === 'Loan') kind = dir === 'repayment' ? 'Loan repayment' : 'Loan received';
  if (ev.event_type === 'Refund') kind = dir === 'from_supplier' ? 'Refund from a supplier' : 'Refund to a customer';
  if (onCredit(ev)) kind = ev.event_type === 'Sale' ? 'Sale on credit' : `${kind} on credit`;
  return who ? `${kind} · ${who}` : kind;
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(iso).slice(0, 10);
  }
}

export const STATUS_COLOR: Record<string, { fg: string; bg: string; label: string }> = {
  confirmed: { fg: 'var(--green)', bg: 'var(--green-dim)', label: 'Confirmed' },
  pending:  { fg: 'var(--amber)', bg: 'var(--amber-dim)', label: 'Waiting for you' },
  void:     { fg: 'var(--text-3)', bg: 'var(--bg-badge)', label: 'Removed' },
};

export const ALL_TYPES: EventType[] = [
  'Sale', 'Purchase', 'Expense', 'InventoryReceipt', 'InventoryAdjustment',
  'Salary', 'SupplierPayment', 'CustomerPayment', 'AssetPurchase',
  'TaxPayment', 'Loan', 'Refund', 'Transfer',
];

// ── Statement words (redesign 2026-10) ───────────────────────────────
// Home's recent activity and the Activity page read each entry like a bank
// statement: who or what on top, how it moved underneath, grouped by day.

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Who or what the entry was with: "Chanda", "Fuel", else the kind of entry. */
export function whoOf(ev: BusinessEvent): string {
  const p = (ev.payload ?? {}) as Record<string, unknown>;
  const name = [p.customer, p.supplier, p.employee, p.item, p.category, p.asset_name, p.tax_type]
    .map((v) => String(v ?? '').trim()).find(Boolean);
  return name ? cap(name) : kindOf(ev);
}

/** The kind of entry as an owner says it: "Sale on credit", "Loan repayment". */
export function kindOf(ev: BusinessEvent): string {
  const p = ev.payload || {};
  const dir = String(p.direction ?? '').toLowerCase();
  let kind = typeLabel(ev.event_type);
  if (ev.event_type === 'Loan') kind = dir === 'repayment' ? 'Loan repayment' : 'Loan received';
  if (ev.event_type === 'Refund') kind = dir === 'from_supplier' ? 'Refund from a supplier' : 'Refund to a customer';
  if (onCredit(ev)) kind = ev.event_type === 'Sale' ? 'Sale on credit' : `${kind} on credit`;
  return kind;
}

/** "14:05", or '' when the entry carries no real time. Imported and fixed
 *  entries are stored at midnight or noon UTC (EntryEditor), which would
 *  otherwise read as "02:00" or "14:00". */
export function clockOf(ev: BusinessEvent): string {
  const time = new Date(ev.occurred_at);
  const noTime = Number.isNaN(time.getTime())
    || (time.getUTCMinutes() === 0 && time.getUTCSeconds() === 0 && (time.getUTCHours() === 0 || time.getUTCHours() === 12));
  return noTime ? '' : time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const SOURCE_WORDS: Record<string, string> = {
  voice: 'said aloud', receipt: 'from a receipt', qr: 'from a QR code',
  excel: 'from a file', csv: 'from a file', pos: 'from the till', api: 'from another app',
};

/** The line under the name: kind, how it was paid, the time and where it came from. */
export function howOf(ev: BusinessEvent): string {
  const method = String(ev.payload?.payment_method ?? '').replace(/_/g, ' ');
  return [kindOf(ev), method && method !== 'credit' ? method : '', clockOf(ev), SOURCE_WORDS[ev.source] ?? '']
    .filter(Boolean).join(' · ');
}

/** "Today", "Yesterday" or "Thu 2 Oct" for a local YYYY-MM-DD key. */
export function dayHeading(key: string): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === localDay(today)) return 'Today';
  if (key === localDay(yesterday)) return 'Yesterday';
  const [y] = key.split('-').map(Number);
  return y === today.getFullYear() ? dayWords(key) : `${dayWords(key)} ${y}`;
}

/** Entries grouped by local day, in the order given. */
export function byDay(events: BusinessEvent[]): { key: string; rows: BusinessEvent[] }[] {
  const groups: { key: string; rows: BusinessEvent[] }[] = [];
  for (const ev of events) {
    const key = localDay(new Date(ev.occurred_at));
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.rows.push(ev); else groups.push({ key, rows: [ev] });
  }
  return groups;
}
