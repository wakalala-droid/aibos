/**
 * AI-BOS — API Client
 * All requests go through /api/proxy (Next.js server) → Railway FastAPI.
 * This avoids CORS entirely — server-to-server calls have no restrictions.
 */

import { createClient } from '@/lib/supabase';

const PROXY = '/api/proxy';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  ok:              boolean;
  rows:            number;
  columns:         string[];
  records:         Record<string, unknown>[];
  pnl:             PNL;
  health_score:    number;
  health_label:    string;
  alerts:          Alert[];
  cashflow:        CashflowMonth[];
  runway_months:   number;
  forecast:        ForecastResult;
  anomalies:       Anomaly[];
  breakeven:       Breakeven;
  currency:        string;          // e.g. "ZMW" | "USD" | "EUR" | "GBP"
  currency_symbol: string;          // e.g. "K"   | "$"   | "€"   | "£"
}

export interface PNL {
  total_revenue:  number;
  total_costs:    number;
  total_profit:   number;
  avg_margin:     number;
  best_month:     string;
  worst_month:    string;
  revenue_growth?: number;
  cost_growth?:    number;
  profit_growth?:  number;
  margin_change?:  number;
  revenue_delta?:  number;
  costs_delta?:    number;
  profit_delta?:   number;
  margin_delta?:   number;
}

export interface Alert {
  id?:        string;
  month:      string;
  change_pct: number;
  direction:  string;
  type?:      string;
  severity?:  string;
  title?:     string;
  description?: string;
  value?:     number;
  expected?:  number;
}

export interface CashflowMonth {
  month_ahead:    number;
  projected_cash: number;
  status:         string;
}

export interface ForecastPoint {
  month:     string;
  predicted: number;
  low:       number;
  high:      number;
}

export interface ForecastResult {
  forecast:    ForecastPoint[];
  trend?:      string;
  growth_rate?: number;
  confidence?:  number;
  r_squared?:   number;
}

export interface Anomaly {
  id?:        string;
  month:      string;
  metric:     string;
  type:       string;
  direction:  string;
  change_pct: number;
  z_score:    number;
  severity:   string;
  root_cause?: string;
  field?:     string;
  value?:     number;
  expected?:  number;
  zScore?:    number;
}

export interface Breakeven {
  breakeven_revenue:          number;
  current_avg_revenue:        number;
  fixed_costs:                number;
  variable_costs:             number;
  contribution_margin_ratio:  number;
  margin_of_safety:           number;
  margin_of_safety_pct?:      number;
}

// ─── Upload file ──────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  options: { current_cash?: number; months_ahead?: number; z_threshold?: number; fixed_cost_pct?: number } = {}
): Promise<UploadResult> {
  const params = new URLSearchParams({
    current_cash:   String(options.current_cash   ?? 50000),
    months_ahead:   String(options.months_ahead   ?? 3),
    z_threshold:    String(options.z_threshold    ?? 2.0),
    fixed_cost_pct: String(options.fixed_cost_pct ?? 0.40),
  });

  const form = new FormData();
  form.append('file', file);

  // Backend requires a verified Supabase JWT (tenant-scoped uploads). Don't set
  // Content-Type — FormData sets its own multipart boundary.
  const res = await fetch(`${PROXY}/upload?${params}`, {
    method:  'POST',
    headers: await authHeaders(),
    body:    form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? err.detail ?? `Upload failed ${res.status}`);
  }

  return res.json();
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendChatMessage(payload: {
  question:       string;
  user_id:        string;
  session_label?: string;
  pnl?:           PNL;
  alerts?:        Alert[];
  persist?:       boolean;
}): Promise<{ ok: boolean; answer: string }> {
  const res = await fetch(`${PROXY}/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body:    JSON.stringify(payload),
  });
  return res.json();
}

// ─── Excel export ─────────────────────────────────────────────────────────────

export async function downloadExcel(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${PROXY}/export/excel`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Excel export failed');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `aibos_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function pingAPI(): Promise<boolean> {
  try {
    const res = await fetch(`${PROXY}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Payments — Mobile Money (MTN MoMo + Airtel Money) ─────────────────────────

export type PaymentNetwork = 'mtn' | 'airtel';
export type PaymentStatus = 'pending' | 'successful' | 'failed';

export interface InitiatePaymentPayload {
  network: PaymentNetwork;
  plan: 'pro' | 'proplus' | 'growth';
  billing: 'monthly' | 'annual';
  payer_phone: string;
  user_id?: string;
  currency?: string;
}

export interface InitiatePaymentResult {
  reference: string;
  status: PaymentStatus;
  amount: number;
  network: PaymentNetwork;
  plan: string;
}

/** Which Morning-Brief delivery channels the backend has keys for. */
export async function briefDeliveryConfig(): Promise<{ email: boolean; whatsapp: boolean }> {
  try {
    const res = await fetch(`${PROXY}/notify/config`);
    const d = (await res.json()) as { email?: boolean; whatsapp?: boolean };
    return { email: !!d.email, whatsapp: !!d.whatsapp };
  } catch {
    return { email: false, whatsapp: false };
  }
}

/** Kick off a mobile-money collection. Returns a reference to poll. */
export async function initiatePayment(payload: InitiatePaymentPayload): Promise<InitiatePaymentResult> {
  const res = await fetch(`${PROXY}/payments/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ currency: 'ZMW', ...payload }),
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error('Unexpected response from the payment service.'); }
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Payment could not start (${res.status}).`);
  return data as unknown as InitiatePaymentResult;
}

/** Poll a collection's status until it resolves. */
export async function checkPaymentStatus(reference: string): Promise<{ reference: string; status: PaymentStatus; plan: string; billing: string }> {
  const res = await fetch(`${PROXY}/payments/status/${encodeURIComponent(reference)}`, {
    headers: await authHeaders(),
  });
  const data = (await res.json().catch(() => ({ status: 'pending' }))) as { reference?: string; status?: PaymentStatus; plan?: string; billing?: string };
  return { reference, status: (data.status ?? 'pending'), plan: data.plan ?? '', billing: data.billing ?? 'monthly' };
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// EVOLUTION SPINE — Business Events + Digital Twin
// All calls are tenant-scoped on the backend via the Supabase JWT, which the proxy
// forwards from the Authorization header (app/api/proxy/[...path]/route.ts).
// ═══════════════════════════════════════════════════════════════════════════════

/** Attach the current Supabase access token so the backend can verify the user. */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export type EventType =
  | 'Sale' | 'Purchase' | 'Expense' | 'InventoryReceipt' | 'InventoryAdjustment'
  | 'Salary' | 'SupplierPayment' | 'CustomerPayment' | 'AssetPurchase'
  | 'TaxPayment' | 'Loan' | 'Refund' | 'Transfer';

export type EventSource = 'manual' | 'voice' | 'receipt' | 'qr' | 'excel' | 'csv' | 'pos' | 'api';
export type EventStatus = 'pending' | 'confirmed' | 'void';

export interface EventInput {
  event_type: EventType;
  payload: Record<string, unknown>;
  source?: EventSource;
  occurred_at?: string;
  confidence?: number;
  status?: 'pending' | 'confirmed';
  currency?: string;
  note?: string;
}

export interface BusinessEvent {
  id: string;
  event_type: EventType;
  occurred_at: string;
  recorded_at: string;
  source: EventSource;
  confidence: number;
  status: EventStatus;
  payload: Record<string, unknown>;
  corrections?: Record<string, unknown>;
  audit?: Array<{ at: string; actor: string; action: string; note?: string }>;
}

export interface EventProposal {
  event_type: EventType | null;
  payload: Record<string, unknown>;
  confidence: number;
  reasoning: string;
}

export interface Twin {
  currency: string;
  cash: number;
  total_revenue: number;
  total_costs: number;
  total_profit: number;
  avg_margin: number;
  receivables: number;
  payables: number;
  inventory_value: number;
  customers: number;
  suppliers: number;
  employees: number;
  health_score: number;
  health_label: string;
  monthly: Array<{ month: string; revenue: number; costs: number }>;
  event_count: number;
}

async function spineFetch(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const headers = { ...(init.headers as Record<string, string>), ...(await authHeaders()) };
  const res = await fetch(`${PROXY}${path}`, { ...init, headers });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return data;
}

// ── Invoices: the get-paid loop (audit #7) ────────────────────────────────────

export interface InvoiceLine { description: string; qty: number; unit_price: number }

export interface Invoice {
  id: string;
  number: string;
  customer_name: string;
  issued_at: string | null;
  due_at: string | null;
  currency: string;
  lines: InvoiceLine[];
  total: number;
  notes: string | null;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  sale_event_id: string | null;
  payment_event_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export async function listInvoices(status?: Invoice['status']): Promise<Invoice[]> {
  const q = status ? `?status=${status}` : '';
  const data = await spineFetch(`/invoices${q}`);
  return (data.invoices as Invoice[]) ?? [];
}

export async function createInvoice(input: {
  customer_name: string; lines: InvoiceLine[]; due_at?: string | null; notes?: string | null; currency?: string;
}): Promise<Invoice> {
  const data = await spineFetch('/invoices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return data.invoice as Invoice;
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const data = await spineFetch(`/invoices/${id}/send`, { method: 'POST' });
  return data.invoice as Invoice;
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  const data = await spineFetch(`/invoices/${id}/mark-paid`, { method: 'POST' });
  return data.invoice as Invoice;
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const data = await spineFetch(`/invoices/${id}/cancel`, { method: 'POST' });
  return data.invoice as Invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  await spineFetch(`/invoices/${id}`, { method: 'DELETE' });
}

export interface DebtorRow {
  name: string;
  key: string;
  total: number;
  invoice_total: number;
  credit_total: number;
  buckets: Record<'current' | '1-30' | '31-60' | '60+', number>;
  oldest_days: number;
  nudge: string;
}

export interface AgingReport {
  as_of: string;
  customers: DebtorRow[];
  totals: Record<string, number>;
}

// ── Team members: roles + accountant seat (audit #27, #28) ────────────────────

export type TeamMemberRole = 'staff' | 'accountant';
export interface TeamMember {
  id: string;
  email: string;
  role: TeamMemberRole;
  status: 'pending' | 'active' | 'revoked';
  invited_at: string;
  accepted_at: string | null;
}

export async function listMembers(): Promise<TeamMember[]> {
  const data = await spineFetch('/members');
  return (data.members as TeamMember[]) ?? [];
}

export async function inviteMember(email: string, role: TeamMemberRole): Promise<TeamMember> {
  const data = await spineFetch('/members', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
  return data.member as TeamMember;
}

export async function updateMemberRole(id: string, role: TeamMemberRole): Promise<TeamMember> {
  const data = await spineFetch(`/members/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  return data.member as TeamMember;
}

export async function revokeMember(id: string): Promise<void> {
  await spineFetch(`/members/${id}`, { method: 'DELETE' });
}

/** Loyverse items export → the product catalog in one upload (audit #29). */
export async function importLoyverseItems(file: File): Promise<{
  store: string | null; created_count: number; skipped_existing: number; warnings: string[];
}> {
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(`${PROXY}/products/import/loyverse`, {
    method: 'POST',
    headers: await authHeaders(),          // no Content-Type — FormData sets it
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || `Import failed (${res.status})`);
  return data as { store: string | null; created_count: number; skipped_existing: number; warnings: string[] };
}

/** Voice note → text via server-side Whisper (audit #17) — the fallback for
 *  phones without the Web Speech API. The transcript then rides the same
 *  classify → propose → confirm flow as typed text. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'note.webm');
  const res = await fetch(`${PROXY}/transcribe`, {
    method: 'POST',
    headers: await authHeaders(),          // no Content-Type — FormData sets it
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || `Transcription failed (${res.status})`);
  return ((data as { text?: string }).text || '').trim();
}

/** AR aging per customer + ready-to-send WhatsApp nudge drafts (audit #15). */
export async function getDebtors(businessName?: string | null): Promise<AgingReport> {
  const q = businessName ? `?business_name=${encodeURIComponent(businessName)}` : '';
  const data = await spineFetch(`/debtors${q}`);
  return data as unknown as AgingReport;
}

export async function invoiceShareText(id: string, businessName?: string | null, payNote?: string | null): Promise<string> {
  const q = new URLSearchParams();
  if (businessName) q.set('business_name', businessName);
  if (payNote) q.set('pay_note', payNote);
  const data = await spineFetch(`/invoices/${id}/share-text?${q.toString()}`);
  return (data.text as string) ?? '';
}

// ── Live customer intelligence (Engine 2 over the spine — audit #5) ──────────

export interface LiveCustomerIntel {
  insufficient: boolean;
  coverage: { sales_events: number; sales_with_customer: number; customers: number };
  needed?: { transactions: number; customers: number };
  hint?: string;
  rfm?: unknown[];
  segments?: unknown[];
  clv_tiers?: unknown[];
  retention?: unknown;
  customer_intel_brief?: string;
  source?: string;
}

/** Engine 2 computed from recorded events. Throws on 402 (Free tier). */
export async function getCustomerIntelligence(): Promise<LiveCustomerIntel> {
  const data = await spineFetch('/intelligence/customers');
  return data as unknown as LiveCustomerIntel;
}

/** Free text → a proposed (not yet saved) event. */
export async function classifyActivity(text: string, currency = 'ZMW'): Promise<EventProposal> {
  const data = await spineFetch('/events/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, currency }),
  });
  return data.proposal as EventProposal;
}

/** Persist a (reviewed) event through the Nervous-System pipeline. */
export async function createEvent(input: EventInput): Promise<BusinessEvent> {
  const data = await spineFetch('/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return data.event as BusinessEvent;
}

export async function listEvents(params: { status?: EventStatus; event_type?: EventType; limit?: number } = {}): Promise<BusinessEvent[]> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.event_type) q.set('event_type', params.event_type);
  q.set('limit', String(params.limit ?? 200));
  const data = await spineFetch(`/events?${q.toString()}`);
  return (data.events as BusinessEvent[]) ?? [];
}

export async function confirmEvent(id: string): Promise<BusinessEvent> {
  const data = await spineFetch(`/events/${id}/confirm`, { method: 'POST' });
  return data.event as BusinessEvent;
}

export async function correctEvent(id: string, patch: { payload?: Record<string, unknown>; occurred_at?: string; event_type?: EventType }): Promise<BusinessEvent> {
  const data = await spineFetch(`/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return data.event as BusinessEvent;
}

export async function voidEvent(id: string, reason?: string): Promise<BusinessEvent> {
  const q = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  const data = await spineFetch(`/events/${id}${q}`, { method: 'DELETE' });
  return data.event as BusinessEvent;
}

export interface ResetOptions {
  source?: EventSource;          // e.g. 'excel' — flush only that producer's events
  wipe_memory?: boolean;         // forget learned import mappings / aliases
  wipe_products?: boolean;
  wipe_schedule?: boolean;
  reset_opening_cash?: boolean;
}

export interface ResetResult {
  deleted_events: number;
  deleted_memory: number;
  deleted_products: number;
  deleted_schedule: number;
  twin: Twin;
}

/** Start afresh: permanently delete recorded data (hard delete — requires typed RESET). */
export async function resetTimeline(opts: ResetOptions = {}): Promise<ResetResult> {
  const data = await spineFetch('/events/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'RESET', ...opts }),
  });
  return data as unknown as ResetResult;
}

// ── Ingestion: Excel → events + QR (Initiatives 2, 7) ──────────────────────────

export interface ExcelPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  sheets: string[];
  active_sheet: string;
  suggestion: Record<string, string>;
  /** Default event type inferred from the amount column header (Revenue→Sale). */
  suggested_type?: EventType;
  /** True when the sheet has both income- and expense-like columns (a P&L summary). */
  summary_like?: boolean;
  event_types: EventType[];
}

export interface BulkResult {
  saved_count: number;
  error_count: number;
  errors: Array<{ row?: number; index?: number; error: string }>;
}

/** Parse a spreadsheet and get columns + sample rows + a suggested mapping. */
export async function excelPreview(file: File, sheet?: string): Promise<ExcelPreview> {
  const form = new FormData();
  form.append('file', file);
  const q = sheet ? `?sheet=${encodeURIComponent(sheet)}` : '';
  const data = await spineFetch(`/events/excel/preview${q}`, { method: 'POST', body: form });
  return data as unknown as ExcelPreview;
}

/** Map reviewed rows → events and bulk-import (partial import supported). */
export async function excelCommit(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  defaults: { event_type?: EventType; currency?: string },
): Promise<BulkResult> {
  const data = await spineFetch('/events/excel/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, mapping, defaults }),
  });
  return data as unknown as BulkResult;
}

/** Receipt photo/upload → vision-OCR → a proposed Purchase (reviewed before saving). */
export async function ingestReceipt(file: File, currency = 'ZMW'): Promise<EventProposal> {
  const form = new FormData();
  form.append('file', file);
  const data = await spineFetch(`/ingest/receipt?currency=${encodeURIComponent(currency)}`, {
    method: 'POST',
    body: form,
  });
  return data.proposal as EventProposal;
}

/** Decoded QR string → a proposed event (reviewed before saving). */
export async function ingestQr(payload: string, currency = 'ZMW'): Promise<EventProposal> {
  const data = await spineFetch('/ingest/qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, currency }),
  });
  return data.proposal as EventProposal;
}

// ── Products catalog (Initiative 3) ────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  buy_price: number;
  sell_price: number;
  opening_stock: number;
  reorder_level: number;
  supplier?: string;
  on_hand?: number;
}

export type ProductInput = Partial<Omit<Product, 'id' | 'on_hand'>> & { name: string };

export async function listProducts(): Promise<Product[]> {
  const data = await spineFetch('/products');
  return (data.products as Product[]) ?? [];
}

export async function createProduct(p: ProductInput): Promise<Product> {
  const data = await spineFetch('/products', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
  });
  return data.product as Product;
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  const data = await spineFetch(`/products/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return data.product as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  await spineFetch(`/products/${id}`, { method: 'DELETE' });
}

// ── Scheduler (meetings, pick-ups, deadlines) ───────────────────────────────────

export type ScheduleKind =
  | 'meeting' | 'pickup' | 'delivery' | 'deadline' | 'payment_due' | 'reminder' | 'other';
export type ScheduleStatus = 'scheduled' | 'done' | 'missed' | 'cancelled';

/** RRULE-lite — expanded server-side; `until` is an ISO date (inclusive). */
export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  until?: string;
}

export interface ScheduleItem {
  id: string;
  kind: ScheduleKind;
  title: string;
  notes?: string | null;
  location?: string | null;
  with_whom?: string | null;
  amount?: number | null;
  starts_at: string;
  ends_at?: string | null;
  all_day: boolean;
  recurrence?: Recurrence | null;
  remind_minutes_before?: number | null;
  status: ScheduleStatus;
  /** Set on materialised occurrences of a recurring item — points at the template. */
  parent_id?: string | null;
  linked_event_id?: string | null;
  /** Expanded by the backend: every occurrence (ISO) within the requested horizon. */
  next_occurrences?: string[];
}

export type ScheduleItemInput =
  Partial<Omit<ScheduleItem, 'id' | 'status' | 'parent_id' | 'next_occurrences'>> &
  { title: string; starts_at: string };

export async function listSchedule(horizonDays = 60): Promise<ScheduleItem[]> {
  const data = await spineFetch(`/schedule?horizon_days=${horizonDays}`);
  return (data.items as ScheduleItem[]) ?? [];
}

/** One tap: recurring PAYE/NAPSA/NHIMA reminders on the 10th, amounts from
 *  the latest payroll run. Idempotent (audit #25). */
export async function seedStatutorySchedule(): Promise<{ created_count: number; skipped_existing: number }> {
  const data = await spineFetch('/schedule/statutory', { method: 'POST' });
  return data as unknown as { created_count: number; skipped_existing: number };
}

export async function createScheduleItem(input: ScheduleItemInput): Promise<ScheduleItem> {
  const data = await spineFetch('/schedule', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return data.item as ScheduleItem;
}

export async function updateScheduleItem(
  id: string,
  patch: Partial<ScheduleItemInput> & { linked_event_id?: string },
): Promise<ScheduleItem> {
  const data = await spineFetch(`/schedule/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return data.item as ScheduleItem;
}

/** Resolve an item. Recurring items materialise the finished occurrence as its
 *  own row and roll the template forward — the RESOLVED row is returned, so
 *  record-bridge callers must link events to the returned id, not the input id. */
export async function setScheduleStatus(
  id: string, status: ScheduleStatus, linkedEventId?: string,
): Promise<ScheduleItem> {
  const data = await spineFetch(`/schedule/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, linked_event_id: linkedEventId ?? null }),
  });
  return data.item as ScheduleItem;
}

export async function deleteScheduleItem(id: string): Promise<void> {
  await spineFetch(`/schedule/${id}`, { method: 'DELETE' });
}

// ── Employees & Payroll (Zambian statutory engine) ──────────────────────────────

export type EmploymentType = 'permanent' | 'contract';
export type EmployeeStatus = 'active' | 'left';

export interface Employee {
  id: string;
  name: string;
  position?: string | null;
  employment_type: EmploymentType;
  status: EmployeeStatus;
  start_date?: string | null;
  end_date?: string | null;
  basic_pay: number;
  currency: string;
  pay_day: number;
  napsa_number?: string | null;
  tpin?: string | null;
  gratuity_eligible: boolean;
  gratuity_rate: number;
  contract_end?: string | null;
  loan_balance: number;
  loan_monthly: number;
  notes?: string | null;
}

export type EmployeeInput =
  Partial<Omit<Employee, 'id' | 'status'>> & { name: string };

/** One person's line inside a pay run — the full statutory breakdown. */
export interface Payslip {
  id?: string;
  run_id?: string;
  employee_id?: string | null;
  period: string;
  employee_name?: string | null;
  gross: number;
  napsa_employee: number;
  napsa_employer: number;
  nhima_employee: number;
  taxable: number;
  paye: number;
  loan_deduction: number;
  other_deductions: number;
  net: number;
  gratuity_accrued: number;
  breakdown?: Record<string, unknown>;
  linked_event_id?: string | null;
}

export interface PayrollTotals {
  gross: number;
  napsa_employee: number;
  napsa_employer: number;
  nhima_employee: number;
  paye: number;
  loan_deduction: number;
  net: number;
  gratuity_accrued: number;
  headcount: number;
}

/** A statutory remittance (PAYE→ZRA, NAPSA, NHIMA) drafted as a pending TaxPayment. */
export interface RemittanceDraft {
  tax_type: 'PAYE' | 'NAPSA' | 'NHIMA';
  authority: string;
  amount: number;
  period: string;
  currency?: string;
  due_date: string;
  event_id?: string | null;         // set once drafted (absent in preview)
}

export interface PayrollRun {
  id: string;
  period: string;
  pay_date?: string | null;
  currency: string;
  totals: PayrollTotals;
  status: 'completed' | 'void';
  payslips?: Payslip[];
  remittances?: RemittanceDraft[];
}

export interface PayrollPreview {
  period: string;
  payslips: Payslip[];
  totals: PayrollTotals;
  remittances: RemittanceDraft[];
  rates: PayrollRates | null;
}

export interface PayrollRates {
  effective_from: string;
  currency: string;
  paye_bands: Array<{ up_to: number | null; rate: number }>;
  napsa_rate: number;
  napsa_ceiling: number;
  nhima_rate: number;
  source: string;
}

export async function listEmployees(): Promise<Employee[]> {
  const data = await spineFetch('/employees');
  return (data.employees as Employee[]) ?? [];
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const data = await spineFetch('/employees', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return data.employee as Employee;
}

export async function updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee> {
  const data = await spineFetch(`/employees/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return data.employee as Employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  await spineFetch(`/employees/${id}`, { method: 'DELETE' });
}

export async function getPayrollRates(): Promise<PayrollRates | null> {
  const data = await spineFetch('/payroll/rates');
  return (data.rates as PayrollRates) ?? null;
}

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  const data = await spineFetch('/payroll/runs');
  return (data.runs as PayrollRun[]) ?? [];
}

export async function getPayrollRun(id: string): Promise<PayrollRun> {
  const data = await spineFetch(`/payroll/runs/${id}`);
  return data.run as PayrollRun;
}

/** Compute a period without persisting — the on-screen table (free). */
export async function previewPayroll(period: string, payDate?: string): Promise<PayrollPreview> {
  const data = await spineFetch('/payroll/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, pay_date: payDate ?? null, preview: true }),
  });
  return data.preview as PayrollPreview;
}

/** Commit a pay period — posts a Salary event per employee (Pro). */
export async function runPayroll(period: string, payDate?: string): Promise<PayrollRun> {
  const data = await spineFetch('/payroll/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, pay_date: payDate ?? null, preview: false }),
  });
  return data.run as PayrollRun;
}

// ── Future hooks: recommendations + simulation (Initiatives 10, 12) ────────────

export interface Recommendation {
  title: string;
  rationale: string;
  expected_outcome: string;
  downside: string;
  confidence: number;
  source_engine: string;
  evidence: Array<{ label: string; value: string }>;
  alternatives: string[];
  impact: { metric?: string; delta?: number; unit?: string };
  priority: 'low' | 'medium' | 'high';
  /** Ledger annotations (audit #20) — absent before migration 0021 runs. */
  rec_id?: string;
  status?: 'open' | 'accepted' | 'dismissed';
  times_shown?: number;
}

export async function getRecommendations(): Promise<Recommendation[]> {
  const data = await spineFetch('/recommendations');
  return (data.recommendations as Recommendation[]) ?? [];
}

/** Owner feedback on a recommendation: 'accepted' (did this) or 'dismissed'. */
export async function setRecommendationStatus(recId: string, status: 'accepted' | 'dismissed'): Promise<void> {
  await spineFetch(`/recommendations/${recId}/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export interface AdviceTrackRecord {
  available: boolean;
  total?: { shown: number; accepted: number; dismissed: number; open: number };
  acceptance_rate?: number | null;
}

/** AIBOS's own advice scoreboard — self-auditing intelligence (audit #20). */
export async function getAdviceTrackRecord(): Promise<AdviceTrackRecord> {
  const data = await spineFetch('/recommendations/track-record');
  return data as unknown as AdviceTrackRecord;
}

export interface SimResult {
  ok: boolean;
  error?: string;
  baseline: Record<string, number>;
  projected: Record<string, number>;
  deltas: Record<string, number>;
  assumptions: string[];
  explanation: string;
  note: string;
}

export async function simulate(scenario: {
  type: string; value?: number; count?: number; monthly_salary?: number; months?: number;
}): Promise<SimResult> {
  const data = await spineFetch('/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  return data as unknown as SimResult;
}

/** Seed the twin's opening cash + currency (Setup Wizard). */
export async function seedTwin(opening_cash: number, currency = 'ZMW'): Promise<Twin> {
  const data = await spineFetch('/twin/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opening_cash, currency }),
  });
  return data.twin as Twin;
}

/** Update the caller's own profile (onboarding/business details) via the Next route. */
export async function updateProfile(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Could not save profile (${res.status}).`);
  }
  const data = await res.json();
  return (data.profile ?? {}) as Record<string, unknown>;
}

export async function getTwin(): Promise<Twin> {
  const data = await spineFetch('/twin');
  return data.twin as Twin;
}

/** The twin shaped like an upload payload (monthly/kpi/health) so the existing
 *  dashboard store can consume it via setUploadResult — backward-compat bridge. */
export async function getTwinFinancials(): Promise<Record<string, unknown>> {
  return spineFetch('/twin/financials');
}

export async function subscribeEmail(payload: { user_id: string; email: string; frequency?: string }): Promise<{ ok: boolean }> {
  // Use the Supabase-backed Next route (durable), not the proxy — the old
  // `?endpoint=` form hit no backend route and returned an HTML 404 page,
  // which broke JSON parsing.
  const res = await fetch('/api/brief/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: payload.email, frequency: payload.frequency }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Could not subscribe (${res.status}).`);
  }
  return res.json();
}
