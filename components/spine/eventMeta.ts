// AIBOS — Business Event display helpers (Evolution spine).
// Pure helpers shared by the Timeline and Record surfaces so event rendering is
// consistent everywhere (component_system.md: same meaning → same component).
import type { BusinessEvent, EventType } from '@/lib/api';

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
  pending:   { fg: 'var(--amber)', bg: 'rgba(251,191,36,0.12)', label: 'Pending' },
  void:      { fg: 'var(--text-4)', bg: 'var(--bg-badge)', label: 'Voided' },
};

export const ALL_TYPES: EventType[] = [
  'Sale', 'Purchase', 'Expense', 'InventoryReceipt', 'InventoryAdjustment',
  'Salary', 'SupplierPayment', 'CustomerPayment', 'AssetPurchase',
  'TaxPayment', 'Loan', 'Refund', 'Transfer',
];
