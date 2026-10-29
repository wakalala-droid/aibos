/**
 * AIBOS — API Client
 * All requests go through /api/proxy (Next.js server) → the FastAPI backend,
 * wherever that is hosted. The address is resolved once in lib/api-base.ts.
 * This avoids CORS entirely — server-to-server calls have no restrictions.
 */

import { createClient } from '@/lib/supabase';
import type { PaidTier } from '@/lib/tiers';
import { booksChanged } from '@/lib/booksSignal';
import { inIosApp, withoutSales } from '@/lib/iosApp';

const PROXY = '/api/proxy';

/** Largest file the web proxy can carry. Vercel refuses a request body over
 *  4.5 MB before our code runs, with a bare "Request Entity Too Large", so a
 *  bigger spreadsheet failed with a message that gave the owner nothing to do.
 *  The API itself would take 15 MB. */
export const MAX_UPLOAD_BYTES = 4_400_000;

/**
 * A phone photo made small enough to send and plenty sharp enough to read.
 *
 * A modern phone camera writes 3 to 8 MB per shot, over what the web proxy
 * carries, so scanning a receipt failed on exactly the phones most likely to
 * be used for it. Longest side 2000px as JPEG keeps a till slip legible at a
 * few hundred KB. Anything that cannot be decoded here goes as it was.
 */
export async function shrinkPhoto(file: File, maxSide = 2000): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/') || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;   // e.g. HEIC where the browser cannot decode it
  }
}

/** A plain sentence when a file is too big to send, else null. */
export function uploadTooLarge(file: File): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  const mb = (file.size / 1_000_000).toFixed(1);
  return `This file is ${mb} MB and the most we can take is 4 MB. Save just the sheet you need as a new file (CSV is smallest), then upload that.`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  ok:             boolean;
  rows:           number;
  columns:        string[];
  records:        Record<string, unknown>[];
  pnl:            PNL;
  health_score:   number;
  health_label:   string;
  alerts:         Alert[];
  cashflow:       CashflowMonth[];
  runway_months:  number;
  forecast:       ForecastResult;
  anomalies:      Anomaly[];
  breakeven:      Breakeven;
  currency:       string;          // e.g. "ZMW" | "USD" | "EUR" | "GBP"
  currency_symbol: string;          // e.g. "K"   | "$"   | "€"   | "£"
}

export interface PNL {
  total_revenue: number;
  total_costs:   number;
  total_profit:  number;
  avg_margin:    number;
  best_month:    string;
  worst_month:   string;
  revenue_growth?: number;
  cost_growth?:   number;
  profit_growth?: number;
  margin_change?: number;
  revenue_delta?: number;
  costs_delta?:   number;
  profit_delta?:  number;
  margin_delta?:  number;
}

export interface Alert {
  id?:       string;
  month:     string;
  change_pct: number;
  direction: string;
  type?:     string;
  severity?: string;
  title?:    string;
  description?: string;
  value?:    number;
  expected?: number;
}

export interface CashflowMonth {
  month_ahead:   number;
  projected_cash: number;
  status:        string;
}

export interface ForecastPoint {
  month:    string;
  predicted: number;
  low:      number;
  high:     number;
}

export interface ForecastResult {
  forecast:   ForecastPoint[];
  trend?:     string;
  growth_rate?: number;
  confidence?: number;
  r_squared?:  number;
}

export interface Anomaly {
  id?:       string;
  month:     string;
  metric:    string;
  type:      string;
  direction: string;
  change_pct: number;
  z_score:   number;
  severity:  string;
  root_cause?: string;
  field?:    string;
  value?:    number;
  expected?: number;
  zScore?:   number;
}

export interface Breakeven {
  breakeven_revenue:         number;
  current_avg_revenue:       number;
  fixed_costs:               number;
  variable_costs:            number;
  contribution_margin_ratio: number;
  margin_of_safety:          number;
  margin_of_safety_pct?:     number;
}

// ─── Upload file ──────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  options: { current_cash?: number; months_ahead?: number; z_threshold?: number; fixed_cost_pct?: number } = {}
): Promise<UploadResult> {
  const params = new URLSearchParams({
    current_cash:  String(options.current_cash   ?? 50000),
    months_ahead:  String(options.months_ahead   ?? 3),
    z_threshold:   String(options.z_threshold    ?? 2.0),
    fixed_cost_pct: String(options.fixed_cost_pct ?? 0.40),
  });

  const form = new FormData();
  form.append('file', file);

  // Backend requires a verified Supabase JWT (tenant-scoped uploads). Don't set
  // Content-Type — FormData sets its own multipart boundary.
  const res = await fetch(`${PROXY}/upload?${params}`, {
    method: 'POST',
    headers: await authHeaders(),
    body:   form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? err.detail ?? `Upload failed ${res.status}`);
  }

  return res.json();
}

// The chat lives in components/chat (streaming, with a per-question qid) and
// the exports in downloadFile below. Two helpers that used to sit here posted
// the wrong shape to /chat and called an /export/excel route that never existed.

// ─── Health check ─────────────────────────────────────────────────────────────

export async function pingAPI(): Promise<boolean> {
  try {
    const res = await fetch(`${PROXY}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
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

// ─── Subscribe ────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// EVOLUTION SPINE — Business Events + Digital Twin
// All calls are tenant-scoped on the backend via the Supabase JWT, which the proxy
// forwards from the Authorization header (app/api/proxy/[...path]/route.ts).
// ═══════════════════════════════════════════════════════════════════════════════

/** Attach the current Supabase access token so the backend can verify the user. */
/** localStorage key for the active business id (audit #16). */
export const ACTIVE_BUSINESS_KEY = 'aibos-active-business-v1';
/** localStorage key for whose books someone invited elsewhere is working in:
 *  'self' or the inviting owner's id. Unset = the server's default. */
export const ACTING_AS_KEY = 'aibos-acting-as-v1';

export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  // Active-business scope — read on every call so a switch takes effect at once.
  try {
    const biz = window.localStorage.getItem(ACTIVE_BUSINESS_KEY);
    if (biz) headers['X-Business-Id'] = biz;
    const actingAs = window.localStorage.getItem(ACTING_AS_KEY);
    if (actingAs) headers['X-Acting-As'] = actingAs;
  } catch { /* SSR / private mode — no scope header, backend uses the default */ }
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* no session */ }
  return headers;
}

export interface Business {
  id: string;
  name: string;
  industry: string | null;
  currency: string;
  is_default: boolean;
}

// ── What AIBOS has learned (audit #57) ────────────────────────────────────────
export interface MemorySummary {
  available: boolean;
  total?: number;
  aliases?: number;
  category_rules?: number;
  type_rules?: number;
  sample_aliases?: { from: string; to: string; hits: number }[];
}
export async function getMemorySummary(): Promise<MemorySummary> {
  const data = await spineFetch('/memory/summary');
  return data as unknown as MemorySummary;
}

export interface MemoryMapping { id: string; kind: string; key: string; value: Record<string, unknown>; hits: number }
export async function getMemoryMappings(): Promise<MemoryMapping[]> {
  const data = await spineFetch('/memory/mappings');
  return (data.mappings as MemoryMapping[]) ?? [];
}
export async function forgetMapping(id: string): Promise<void> {
  await spineFetch(`/memory/mappings/${id}`, { method: 'DELETE' });
}

// ── Accountant export pack (audit #27/#28) ────────────────────────────────────
/** Fetch an authed file endpoint and save it. The backend may answer with a
 *  PDF or, where reportlab is unavailable, a .txt of the same content — so the
 *  extension follows the response, never the caller's assumption. */
async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${PROXY}${path}`, { headers: await authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(data.detail || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const name = blob.type.startsWith('text/plain') ? filename.replace(/\.pdf$/, '.txt') : filename;
  saveBlob(blob, name);
}

/** Hand a file to the browser to save. The link has to be in the document for
 *  Firefox to follow it, and revoking the URL in the same tick can cancel the
 *  download in Safari before it starts. */
function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 30_000);
}
// ── Teach AIBOS your business: the owner interview (migration 0041) ─────────
export type InterviewKind = 'text' | 'money' | 'number' | 'month' | 'choice' | 'multi' | 'months';
export interface InterviewQuestion {
  id: string;
  chapter: string;
  kind: InterviewKind;
  /** Short name for the answer, as "What AIBOS knows" lists it. */
  label: string;
  ask: string;
  why: string;
  placeholder?: string;
  options?: string[];
}
export interface InterviewAnswer {
  value?: string | number | string[] | number[];
  /** The owner's own wording, kept when it says more than the figure. */
  text?: string;
  skipped?: boolean;
  at: string;
}
export interface InterviewState {
  business: string | null;
  industry: string | null;
  currency: string;
  symbol: string;
  chapters: { id: string; title: string; intro: string }[];
  questions: InterviewQuestion[];
  answers: Record<string, InterviewAnswer>;
  /** The first question still open, or null when every one is done. */
  next: string | null;
  progress: { done: number; answered: number; total: number; finished: boolean };
  finished_at: string | null;
  plan_applied_at: string | null;
  /** One line back about the answer just given. */
  said: string | null;
}
export interface InterviewPlan {
  ok: boolean;
  reason?: string;
  months: { month: string; revenue: number | null; profit: number | null }[];
  horizon?: number;
  basis?: string;
  to_write?: number;
  /** Months that already hold a target, with what the plan would have set. */
  kept?: { month: string; metric: string; target: number; planned: number }[];
  /** How many of those the owner set by hand (the rest this plan wrote). */
  own?: number;
  applied_at?: string | null;
}

export async function getInterview(): Promise<InterviewState> {
  return (await spineFetch('/interview')) as unknown as InterviewState;
}

/** Save, skip or clear one answer. A bad answer throws with the words to show. */
export async function answerInterview(
  id: string, value: unknown, opts: { skip?: boolean; clear?: boolean } = {},
): Promise<InterviewState> {
  const data = await spineFetch('/interview/answer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, value, skip: !!opts.skip, clear: !!opts.clear }),
  });
  return data as unknown as InterviewState;
}

export async function getInterviewPlan(): Promise<InterviewPlan> {
  return (await spineFetch('/interview/plan')) as unknown as InterviewPlan;
}

/** Write the goals as monthly targets; a target set by hand is kept. */
export async function applyInterviewPlan(): Promise<{ written: number; kept: number; first_month?: string }> {
  const data = await spineFetch('/interview/plan', { method: 'POST' });
  return { written: Number(data.written ?? 0), kept: Number(data.kept ?? 0),
           first_month: data.first_month as string | undefined };
}

/** The AIBOS workbook, made for this business and named after it. */
export async function downloadWorkbook(): Promise<void> {
  const res = await fetch(`${PROXY}/templates/workbook.xlsx`, { headers: await authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(data.detail || `Download failed (${res.status})`);
  }
  const named = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '');
  saveBlob(await res.blob(), named?.[1] || 'AIBOS workbook.xlsx');
}
// ── Notifications on the phone (upgrade 10) ──────────────────────────────────
/** `apns`: the API can also reach the iPhone app's lock screen (Apple's key is set). */
export async function getPushKey(): Promise<{ configured: boolean; key: string | null; apns: boolean }> {
  const data = await spineFetch('/push/key');
  return { configured: Boolean(data.configured), key: (data.key as string) ?? null, apns: Boolean(data.apns) };
}
export async function subscribePush(sub: PushSubscriptionJSON): Promise<void> {
  await spineFetch('/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
  });
}
export async function unsubscribePush(endpoint: string): Promise<void> {
  await spineFetch('/push/subscribe', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, keys: {} }),
  });
}
/** The iPhone app has no web push: its alerts go through Apple's push service,
 *  to the token the app hands the page (aibos-ios, Push.swift). */
export async function subscribeIosPush(token: string): Promise<void> {
  await spineFetch('/push/apns', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  });
}
export async function unsubscribeIosPush(token: string): Promise<void> {
  await spineFetch('/push/apns', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  });
}
export async function sendTestPush(): Promise<{ sent?: number }> {
  return (await spineFetch('/push/test', { method: 'POST' })) as unknown as { sent?: number };
}
/** The owner's own Morning Brief to their own WhatsApp, now. `to` is the
 *  number's last three digits. A refusal throws in Meta's own words. */
export async function sendTestWhatsAppBrief(): Promise<{ ok?: boolean; to?: string }> {
  return (await spineFetch('/notify/test-whatsapp', { method: 'POST' })) as unknown as { ok?: boolean; to?: string };
}
/** What one announcement did, or would do (dry_run). Admin only: the API
 *  checks the caller against an address Google has proven they own. */
export interface AnnounceResult {
  key: string; people: number; with_devices: number;
  told: number; already: number; pushed: number; not_pushed: number; errors: number;
  dry_run?: boolean;
}
export async function announce(input: {
  title: string; body?: string; link?: string; key?: string; dry_run?: boolean;
}): Promise<AnnounceResult> {
  const data = await spineFetch('/admin/announce', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return data as unknown as AnnounceResult;
}

/** The card payment reminder (admin): every account on a paid plan that a card
 *  is not paying for is asked to put it on a card, by bell, phone and email.
 *  A dry run counts them and shows the first message. */
export interface CardReminderResult {
  key: string; people: number; with_email: number; with_devices: number;
  told: number; already: number; emailed: number; pushed: number; remaining: number; errors: number;
  dry_run?: boolean;
  sample?: { title: string; body: string; button: string; link: string } | null;
}
export async function sendCardReminder(input: { key?: string; dry_run?: boolean }): Promise<CardReminderResult> {
  const data = await spineFetch('/admin/card-reminder', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return data as unknown as CardReminderResult;
}

/** One phone or computer that has notifications on, in plain words
 *  ("Chrome on an Android phone"). Reminders and alerts reach only these. */
export interface PushDevice { id: string; device: string; since: string | null }
export async function getPushDevices(): Promise<PushDevice[]> {
  const data = await spineFetch('/push/devices');
  return (data.devices as PushDevice[]) ?? [];
}

// ── Tidy up test and mistaken entries (upgrade 16) ───────────────────────────
export type TidyKind = 'zero_records' | 'undone_invoices' | 'empty_bookings' | 'undone_payroll';
export type TidyFound = Record<TidyKind, { id: string; label: string }[]>;

export async function findTidyUp(): Promise<TidyFound> {
  const data = await spineFetch('/cleanup');
  return {
    zero_records: (data.zero_records as TidyFound['zero_records']) ?? [],
    undone_invoices: (data.undone_invoices as TidyFound['undone_invoices']) ?? [],
    empty_bookings: (data.empty_bookings as TidyFound['empty_bookings']) ?? [],
    undone_payroll: (data.undone_payroll as TidyFound['undone_payroll']) ?? [],
  };
}
export async function applyTidyUp(kinds: TidyKind[]): Promise<Partial<Record<TidyKind, number>>> {
  const data = await spineFetch('/cleanup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kinds }),
  });
  return (data.done as Partial<Record<TidyKind, number>>) ?? {};
}

// ── Where the cash is (upgrade 9) ─────────────────────────────────────────────
export interface CashByMethod {
  cash: number; mobile_money: number; bank: number; unsaid: number; opening: number; total: number;
}
/** One place the books and a money record disagree, in plain words. */
export interface BooksCheckProblem {
  kind: string;
  message: string;
  amount: number | null;
  ref?: string | null;
  link?: string | null;
  /** False for a note that changes no figure (a fraction of a ngwee). */
  money: boolean;
}

/** Every money record held against the books, to the ngwee (GET /books/check). */
export interface BooksCheck {
  ok: boolean;
  checked_at: string;
  checked: { entries: number; invoices: number; collections: number; stays: number; payslips: number; books: number };
  problems: BooksCheckProblem[];
  problem_count: number;
  money_problem_count: number;
  healed: string[];
  summary: string;
}

export async function checkBooks(): Promise<BooksCheck> {
  const data = await spineFetch('/books/check');
  return data.check as BooksCheck;
}

export async function getCashByMethod(): Promise<CashByMethod> {
  return (await spineFetch('/twin/cash-by-method')) as unknown as CashByMethod;
}

// ── The money views (aibos-api books_views.py): every money figure, one read ──

/** Where money sits, as "Where it is" splits it. */
export type HowPaid = 'cash' | 'mobile_money' | 'bank' | 'unsaid';
/** What an owner may say an entry was paid by. Card settles into the bank. */
export type SayHow = 'cash' | 'mobile_money' | 'bank' | 'card';

export interface MoneyPoint { day: string; balance: number; in: number; out: number }
export interface MoneyMonth { month: string; in: number; out: number; net: number; trading_in: number; trading_out: number }
export interface MoneyLasts {
  ok: boolean;
  months: number;
  reason?: string;
  from?: string;
  to?: string;
  out_a_month?: number;
  in_a_month?: number;
  shrinks_a_month?: number;
  shrinking?: boolean;
  months_left?: number;
}

/** GET /books/money: the money right now and everything said about it. */
export interface MoneyView {
  cash: number;
  opening: number;
  split: CashByMethod;
  line: { days: number; points: MoneyPoint[]; in: number; out: number; active_days: number };
  months: MoneyMonth[];
  lasts: MoneyLasts;
  /** Entries still waiting for the owner that would move money: in no figure yet. */
  waiting: { count: number; in: number; out: number };
  entries: number;
}

/** The owner's minutes from UTC, so days are the owner's own days. */
export function tzMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export async function getMoney(days = 30): Promise<MoneyView> {
  return (await spineFetch(`/books/money?days=${days}&tz=${tzMinutes()}`)) as unknown as MoneyView;
}

/** One entry behind a "Where it is" figure, with what it adds to that figure. */
export interface HowPaidEntry { event: BusinessEvent; amount: number; fix: 'method' | 'transfer' }
export interface HowPaidList { how: HowPaid; entries: HowPaidEntry[]; count: number; total: number; figure: number }

export async function getHowPaid(how: HowPaid): Promise<HowPaidList> {
  return (await spineFetch(`/books/how-paid?how=${how}`)) as unknown as HowPaidList;
}

/** Say how an entry's money moved; for a transfer, where from and where to. */
export async function sayHowPaid(eventId: string, said: { how: SayHow } | { from: SayHow; to: SayHow }):
  Promise<{ event: BusinessEvent; split: CashByMethod }> {
  const data = await spineFetch(`/books/how-paid/${encodeURIComponent(eventId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(said),
  });
  return data as unknown as { event: BusinessEvent; split: CashByMethod };
}

export interface MoneyOutPart { event_type: EventType; category: string | null; total: number; count: number }

/** Where the money went between two moments (confirmed entries, every one). */
export async function getMoneyOut(start?: Date, end?: Date): Promise<{ parts: MoneyOutPart[]; total: number; count: number }> {
  const q = new URLSearchParams();
  if (start) q.set('start', start.toISOString());
  if (end) q.set('end', end.toISOString());
  const qs = q.toString();
  return (await spineFetch(`/books/money-out${qs ? `?${qs}` : ''}`)) as unknown as { parts: MoneyOutPart[]; total: number; count: number };
}

/** One purchase in the VAT view (aibos-api books_views.vat_claim). */
export interface VatEntry {
  id: string;
  event_type: EventType;
  occurred_at: string;
  supplier: string | null;
  amount: number;
  /** The VAT recorded on it; null when none was. */
  vat: number | null;
  /** The seller's TPIN and the invoice, when a ZRA Smart Invoice backs it. */
  tpin?: string;
  invoice?: string | null;
}

/** GET /books/vat: the VAT on a period's purchases, split by whether it can be claimed. */
export interface VatClaim {
  claim: { vat: number; count: number; no_vat_figure: number; entries: VatEntry[] };
  lost: { spent: number; vat_shown: number; count: number; entries: VatEntry[] };
  /** A Smart Invoice recorded again: claimed once, listed to be removed. */
  twice: { vat: number; count: number; entries: VatEntry[] };
  /** Has the business recorded any purchase at all? */
  ever: boolean;
}

export async function getVatClaim(start?: Date, end?: Date): Promise<VatClaim> {
  const q = new URLSearchParams();
  if (start) q.set('start', start.toISOString());
  if (end) q.set('end', end.toISOString());
  const qs = q.toString();
  return (await spineFetch(`/books/vat${qs ? `?${qs}` : ''}`)) as unknown as VatClaim;
}

/** What a month costs whatever is sold, and what grows with sales (the breakeven). */
export interface CostSplit {
  ok: boolean;
  months: number;
  reason?: string;
  from?: string;
  to?: string;
  sales_a_month?: number;
  fixed_a_month?: number;
  variable_a_month?: number;
  variable_share?: number | null;
  breakeven_a_month?: number;
  fixed_named?: string[];
}

export async function getCosts(): Promise<CostSplit> {
  const data = await spineFetch(`/books/costs?tz=${tzMinutes()}`);
  return data.costs as CostSplit;
}

// ── Plan & billing (upgrades 1 and 2) ─────────────────────────────────────────
export type PlanState = 'free' | 'included' | 'active' | 'grace' | 'expired';

export interface PlanPayment {
  id: string;
  date: string;
  plan: string;
  plan_name: string;
  billing: 'monthly' | 'annual';
  amount: number;
  currency: string;
  method: string;
  phone_tail: string | null;
  status: 'pending' | 'successful' | 'failed' | 'refunded';
  receipt: boolean;
  /** A card payment: Paddle's invoice is its receipt (getCardInvoiceUrl). */
  invoice?: boolean;
  paid_until?: string | null;
}

/** A plan paid by card: Paddle charges it every period until it is cancelled. */
export interface CardPlan {
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled';
  plan: string;
  billing: 'monthly' | 'annual';
  amount: number | null;
  currency: string;
  renews_on: string | null;
  cancel_at: string | null;
}

export interface MyBilling {
  own_plan: boolean;
  note?: string;
  plan?: string;
  plan_name?: string;
  billing?: 'monthly' | 'annual';
  price?: number | null;
  /** The currency of `price`: ZMW, or USD for a card plan. */
  currency?: string;
  state?: PlanState;
  sentence?: string;
  paid_until?: string | null;
  renews_on?: string | null;
  switches_off_on?: string | null;
  days_left?: number | null;
  pay_link?: string;
  payments?: PlanPayment[];
  card?: CardPlan | null;
  /** Whether card payments are switched on at all. */
  card_payments?: boolean;
  /** Whether Paddle's own page (change card, invoices) can be opened. */
  card_manageable?: boolean;
}

export async function getMyBilling(): Promise<MyBilling> {
  return (await spineFetch('/me/billing')) as unknown as MyBilling;
}

export const downloadPlanReceipt = (paymentId: string, number: string) =>
  downloadFile(`/me/billing/receipts/${encodeURIComponent(paymentId)}.pdf`, `${number}.pdf`);

// ── Card payments, through Paddle (lib/paddle.ts opens the checkout) ─────────
export interface CardPrice { amount: number; currency: string }
export type CardPrices = Partial<Record<string, Partial<Record<'monthly' | 'annual', CardPrice>>>>;

export interface CardConfig {
  enabled: boolean;
  environment: 'live' | 'sandbox' | null;
  client_token?: string | null;
  prices: CardPrices;
  /** Only admins are shown cards: a sandbox key (test cards work for anyone)
   *  or a live one before its first real payment. `stage` says which. */
  testers_only: boolean;
  stage?: 'off' | 'setting_up' | 'sandbox' | 'waiting_for_website_approval'
    | 'admins_until_first_payment' | 'open';
}

const NO_CARDS: CardConfig = { enabled: false, environment: null, prices: {}, testers_only: false };

/** Whether cards are on, and the card prices. Public; never throws. */
export async function getCardConfig(): Promise<CardConfig> {
  try {
    const res = await fetch(`${PROXY}/payments/paddle/config`);
    if (!res.ok) return NO_CARDS;
    const d = (await res.json()) as Partial<CardConfig>;
    return { ...NO_CARDS, ...d, prices: d.prices ?? {} };
  } catch {
    return NO_CARDS;
  }
}

export interface CardCheckout {
  transaction_id: string;
  amount: number;
  currency: string;
  client_token: string;
  environment: 'live' | 'sandbox';
  plan: string;
  billing: 'monthly' | 'annual';
}

const post = (path: string, body?: unknown) =>
  spineFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

/** The API makes the Paddle transaction; the page only opens it. */
export async function startCardCheckout(plan: PaidTier, billing: 'monthly' | 'annual'): Promise<CardCheckout> {
  return (await post('/payments/paddle/checkout', { plan, billing })) as unknown as CardCheckout;
}

export interface CardChangePreview {
  action: 'charge' | 'credit';
  amount: number;
  currency: string;
  next_billed_at: string | null;
  next_amount: number | null;
}

export async function previewCardChange(plan: PaidTier, billing: 'monthly' | 'annual'): Promise<CardChangePreview> {
  const d = await post('/payments/paddle/change', { plan, billing, confirm: false });
  return d.preview as CardChangePreview;
}

export async function confirmCardChange(plan: PaidTier, billing: 'monthly' | 'annual'): Promise<void> {
  await post('/payments/paddle/change', { plan, billing, confirm: true });
}

/** Stop the card plan renewing; it stays on to the end of what is paid. */
export async function cancelCardPlan(): Promise<string | null> {
  return ((await post('/payments/paddle/cancel')).ends_on as string | null) ?? null;
}

/** Undo a cancelled renewal before it takes effect. */
export async function keepCardPlan(): Promise<void> {
  await post('/payments/paddle/keep');
}

/** A short-lived link to Paddle's own page: change the card, every invoice. */
export async function getCardPortalUrl(): Promise<string> {
  return (await post('/payments/paddle/portal')).url as string;
}

export async function getCardInvoiceUrl(paymentId: string): Promise<string> {
  return (await spineFetch(`/me/billing/invoices/${encodeURIComponent(paymentId)}`)).url as string;
}

export const exportEventsCsv = () => downloadFile('/export/events.csv', 'aibos_events.csv');
export const exportPnlCsv = () => downloadFile('/export/pnl.csv', 'aibos_pnl.csv');

// ── Payroll documents (audit #26 payslip PDF, #66 statutory summary PDF) ──────
// These endpoints shipped with no caller at all: the server rendered the PDFs,
// test_payroll.py covered the TEXT helpers, and no screen in the product ever
// asked for one. Wiring them is the whole feature from the owner's side.
export const downloadPayslipPdf = (runId: string, employeeId: string, period: string, businessName?: string) =>
  downloadFile(
    `/payroll/runs/${runId}/payslip.pdf?employee_id=${encodeURIComponent(employeeId)}` +
      (businessName ? `&business_name=${encodeURIComponent(businessName)}` : ''),
    `payslip_${period}.pdf`,
  );
export const downloadCompliancePdf = (runId: string, period: string, businessName?: string) =>
  downloadFile(
    `/payroll/runs/${runId}/compliance.pdf` +
      (businessName ? `?business_name=${encodeURIComponent(businessName)}` : ''),
    `statutory_${period}.pdf`,
  );

export interface Party {
  id: string;
  name: string;
  normalized_key: string;
  kind: 'customer' | 'supplier' | 'both';
  last_seen_at: string | null;
  stats: { revenue: number; spend: number; txn_count: number } | null;
}
export async function listParties(kind?: 'customer' | 'supplier'): Promise<Party[]> {
  const q = kind ? `?kind=${kind}` : '';
  const data = await spineFetch(`/parties${q}`);
  return (data.parties as Party[]) ?? [];
}

/** Take a contact off the list. Its entries stay in the books (UI/UX audit A24). */
export async function deleteParty(id: string): Promise<void> {
  await spineFetch(`/parties/${id}`, { method: 'DELETE' });
}

/** Merge two duplicate parties — keep one, fold the other in (audit #6). */
export async function mergeParties(keepId: string, removeId: string): Promise<void> {
  await spineFetch(`/parties/${keepId}/merge/${removeId}`, { method: 'POST' });
}

// ── Budgets & targets (audit #37) ─────────────────────────────────────────────
export type BudgetMetric = 'revenue' | 'costs' | 'profit';
export interface BudgetLine {
  metric: BudgetMetric;
  target: number;
  actual: number;
  delta: number;
  pct_of_target: number | null;
  on_track: boolean;
  /** The month still running (16 Oct 2026): what it is on pace for, the
   *  chance of meeting the plan, and a day's worth from here (still to make
   *  for sales and profit, room left for costs). */
  projected?: number;
  chance_pct?: number;
  on_pace?: boolean;
  per_day?: number;
  days_left?: number;
}
export interface BudgetReport {
  month: string;
  actuals: { revenue: number; costs: number; profit: number };
  lines: BudgetLine[];
  /** True when the lines carry the month-still-running pace. */
  pace?: boolean;
}

export async function getBudgets(month: string): Promise<BudgetReport> {
  const data = await spineFetch(`/budgets?month=${encodeURIComponent(month)}&tz=${tzMinutes()}`);
  return data as unknown as BudgetReport;
}

export async function setBudget(month: string, metric: BudgetMetric, target: number): Promise<void> {
  await spineFetch('/budgets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, metric, target }),
  });
}

export async function listBusinesses(): Promise<{ businesses: Business[]; active: string | null }> {
  const data = await spineFetch('/businesses');
  return { businesses: (data.businesses as Business[]) ?? [], active: (data.active as string | null) ?? null };
}

export async function createBusiness(input: { name: string; industry?: string; currency?: string }): Promise<Business> {
  const data = await spineFetch('/businesses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return data.business as Business;
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
  /** What the business held when it started recording (the books start from it). */
  opening_cash?: number;
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

/*
  One page load asked for the same list up to five times at once: the header's
  bell, the brief, the home cards and the store each fetch products, debtors and
  events for themselves. Every copy is a round trip through the proxy to the API
  on a free server. A GET already on its way for the same address and the same
  books is shared instead of sent again. Only while it is in flight: once it
  answers it is forgotten, so nothing can be served stale after a change.
*/
const inflightGets = new Map<string, Promise<Record<string, unknown>>>();

async function spineFetch(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method === 'GET' && !init.body) {
    const scope = await authHeaders();
    const key = `${path}|${scope['X-Business-Id'] ?? ''}|${scope['X-Acting-As'] ?? ''}|${scope.Authorization ?? ''}`;
    const pending = inflightGets.get(key);
    if (pending) return pending;
    const req = spineFetchOnce(path, init).finally(() => inflightGets.delete(key));
    inflightGets.set(key, req);
    return req;
  }
  return spineFetchOnce(path, init);
}

async function spineFetchOnce(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const headers = { ...(init.headers as Record<string, string>), ...(await authHeaders()) };
  const res = await fetch(`${PROXY}${path}`, { ...init, headers });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
  if (!res.ok) {
    // A reason the server sends as { code, message } keeps both: the words
    // for the owner, the code for the screen to act on (paid_wages and the like).
    const raw = data.detail;
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    const said = typeof raw === 'string' ? raw
      : obj && typeof obj.message === 'string' ? obj.message
      : `Request failed (${res.status})`;
    // The iPhone app sells nothing (lib/iosApp.ts): a refusal that tells the
    // owner to upgrade keeps its reason and loses the selling.
    const message = inIosApp() ? withoutSales(said) || `Request failed (${res.status})` : said;
    throw new ApiError(message, res.status, typeof obj?.code === 'string' ? obj.code : undefined, raw);
  }
  // Every page hears that the books changed (lib/booksSignal.ts).
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') booksChanged(path);
  return data;
}

/** An API refusal: the server's own words, its status and, when it sent one, its code. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public detail?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
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

/** The owner saw the money arrive: how the customer paid (cash, mobile money,
 *  bank or card) puts it in the right place on the Money page. */
export async function markInvoicePaid(id: string, paymentMethod?: SayHow): Promise<Invoice> {
  const data = await spineFetch(`/invoices/${id}/mark-paid`, {
    method: 'POST',
    ...(paymentMethod ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_method: paymentMethod }) } : {}),
  });
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

/** The business's own mobile money account (migration 0038). Payment links
 *  collect into it and only into it. The key itself never comes back: only
 *  the last four characters, so the owner can tell which key is saved. */
export interface PaymentAccount {
  connected: boolean;
  usable: boolean;                       // false: saved but must be pasted again
  provider: 'lenco' | null;
  environment: 'live' | 'sandbox' | null;
  account_name: string | null;
  account_ref: string | null;
  key_hint: string | null;
  connected_at: string | null;
  webhook_url: string | null;
}

export async function getPaymentAccount(): Promise<PaymentAccount> {
  return (await spineFetch('/payments/account')) as unknown as PaymentAccount;
}

export async function connectPaymentAccount(apiKey: string): Promise<PaymentAccount> {
  return (await spineFetch('/payments/account', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'lenco', api_key: apiKey }),
  })) as unknown as PaymentAccount;
}

export async function disconnectPaymentAccount(): Promise<PaymentAccount> {
  return (await spineFetch('/payments/account', { method: 'DELETE' })) as unknown as PaymentAccount;
}

/** Guided stock count → InventoryAdjustment events per discrepancy (audit #49). */
export async function stockTake(counts: { name: string; counted: number }[]): Promise<{ adjusted: number; skipped: number }> {
  const data = await spineFetch('/products/stock-take', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ counts }),
  });
  return data as unknown as { adjusted: number; skipped: number };
}

/** Loyverse items export → the product catalog in one upload (audit #29). */
export async function importLoyverseItems(file: File): Promise<{
  store: string | null; created_count: number; skipped_existing: number; warnings: string[];
}> {
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(`${PROXY}/products/import/loyverse`, {
    method: 'POST',
    headers: await authHeaders(),          // no Content-Type: FormData sets it
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
    headers: await authHeaders(),          // no Content-Type: FormData sets it
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

export async function invoiceShareText(
  id: string, businessName?: string | null, payNote?: string | null,
): Promise<{ text: string; payUrl: string | null }> {
  const q = new URLSearchParams();
  if (businessName) q.set('business_name', businessName);
  if (payNote) q.set('pay_note', payNote);
  const data = await spineFetch(`/invoices/${id}/share-text?${q.toString()}`);
  return { text: (data.text as string) ?? '', payUrl: (data.pay_url as string | null) ?? null };
}

/** Mint (or fetch) the public payment link for a SENT invoice. */
export async function invoicePayLink(id: string): Promise<string> {
  const data = await spineFetch(`/invoices/${id}/pay-link`, { method: 'POST' });
  return data.url as string;
}

// ── The public payment page (migration 0025) ─────────────────────────────────
// These are the ONLY calls in this file that must NOT carry auth: the caller is
// the owner's customer, who has no AIBOS account and never will. The token in
// the path is the whole credential. Using spineFetch here would be a bug — it
// awaits a Supabase session that doesn't exist.

export interface PublicInvoice {
  number: string;
  customer_name: string;
  business_name: string | null;
  /** The sender's mark. A stranger's payment link is easier to trust with a
   *  face on it — whitelisted server-side in invoices.public_view(). */
  business_logo_url: string | null;
  currency: string;
  lines: InvoiceLine[];
  total: number;
  issued_at: string | null;
  due_at: string | null;
  status: Invoice['status'];
  payable: boolean;
}

export type PayNetwork = 'mtn' | 'airtel' | 'zamtel';

/** An error from a public route, carrying the HTTP status so the page can tell
 *  "this link is wrong" (404 — the customer should ask for a new one) apart
 *  from "we're having trouble" (anything else — they should just retry). */
export class PublicApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PublicApiError';
    this.status = status;
  }
}

async function publicFetch(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${PROXY}${path}`, init);
  } catch {
    // The customer is on mobile data; a dropped request is routine. 0 = "never
    // reached the server", which the page reports as a retryable hiccup.
    throw new PublicApiError('Could not reach the server.', 0);
  }
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Request failed (${res.status})`;
    throw new PublicApiError(detail, res.status);
  }
  return data;
}

export async function getPublicInvoice(token: string): Promise<{
  invoice: PublicInvoice; networks: Record<PayNetwork, boolean>;
}> {
  const data = await publicFetch(`/pay/${encodeURIComponent(token)}`);
  return {
    invoice: data.invoice as unknown as PublicInvoice,
    networks: data.networks as Record<PayNetwork, boolean>,
  };
}

export async function initiatePublicPayment(
  token: string, network: PayNetwork, payerPhone: string,
): Promise<{ reference: string; status: string }> {
  const data = await publicFetch(`/pay/${encodeURIComponent(token)}/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ network, payer_phone: payerPhone }),
  });
  return { reference: data.reference as string, status: data.status as string };
}

export async function checkPublicPaymentStatus(
  token: string, reference: string,
): Promise<'pending' | 'successful' | 'failed'> {
  const data = await publicFetch(
    `/pay/${encodeURIComponent(token)}/status/${encodeURIComponent(reference)}`);
  return data.status as 'pending' | 'successful' | 'failed';
}

// ── Payment links for stays (upgrade 3) ──────────────────────────────────────
// The guest's half: the same public routes and error handling as invoices.
export interface PublicStay {
  business_name: string | null;
  business_logo_url: string | null;
  unit: string | null;
  reference: string | null;
  guest_first_name: string | null;
  check_in: string;
  check_out: string;
  nights: number | null;
  currency: string;
  total: number;
  paid: number;
  owed: number;
  amount_due: number;
  is_deposit: boolean;
  payable: boolean;
  paid_in_full: boolean;
}

export async function getPublicStay(token: string): Promise<{
  stay: PublicStay; networks: Record<PayNetwork, boolean>;
}> {
  const data = await publicFetch(`/pay/stay/${encodeURIComponent(token)}`);
  return { stay: data.stay as unknown as PublicStay, networks: data.networks as Record<PayNetwork, boolean> };
}

export async function initiateStayPayment(
  token: string, network: PayNetwork, payerPhone: string,
): Promise<{ reference: string; status: string; amount: number }> {
  const data = await publicFetch(`/pay/stay/${encodeURIComponent(token)}/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ network, payer_phone: payerPhone }),
  });
  return { reference: data.reference as string, status: data.status as string, amount: Number(data.amount) || 0 };
}

export async function checkStayPaymentStatus(
  token: string, reference: string,
): Promise<'pending' | 'successful' | 'failed'> {
  const data = await publicFetch(
    `/pay/stay/${encodeURIComponent(token)}/status/${encodeURIComponent(reference)}`);
  return data.status as 'pending' | 'successful' | 'failed';
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
  source?: EventSource;          // e.g. 'excel': flush only that producer's events
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
  const tooBig = uploadTooLarge(file);
  if (tooBig) throw new Error(tooBig);
  const form = new FormData();
  form.append('file', file);
  const q = sheet ? `?sheet=${encodeURIComponent(sheet)}` : '';
  const data = await spineFetch(`/events/excel/preview${q}`, { method: 'POST', body: form });
  return data as unknown as ExcelPreview;
}

/** The same file was already imported into these books (HTTP 409). */
export class AlreadyImportedError extends Error {
  importedAt: string | null;
  savedCount: number | null;
  constructor(message: string, importedAt: string | null, savedCount: number | null) {
    super(message);
    this.name = 'AlreadyImportedError';
    this.importedAt = importedAt;
    this.savedCount = savedCount;
  }
}

/** Import EVERY row of a spreadsheet, read on the server from the file itself.
 *  excelCommit below sends back the preview's rows, which stop at 2,000.
 *  `force` imports a file these books already have. */
export async function excelCommitFile(
  file: File,
  mapping: Record<string, string>,
  defaults: { event_type?: EventType; currency?: string },
  opts: { sheet?: string | null; force?: boolean } = {},
): Promise<BulkResult & { row_count: number }> {
  const form = new FormData();
  form.append('file', file);
  form.append('mapping', JSON.stringify(mapping));
  form.append('defaults', JSON.stringify(defaults));
  if (opts.sheet) form.append('sheet', opts.sheet);
  if (opts.force) form.append('force', 'true');
  const res = await fetch(`${PROXY}/events/excel/commit-file`, { method: 'POST', body: form, headers: await authHeaders() });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
  if (res.status === 409) {
    const d = (data.detail ?? {}) as { message?: string; imported_at?: string; saved_count?: number };
    throw new AlreadyImportedError(d.message ?? 'This file has already been imported.', d.imported_at ?? null, d.saved_count ?? null);
  }
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `Import failed (${res.status})`);
  }
  booksChanged();
  return data as unknown as BulkResult & { row_count: number };
}

// ── Documents: read every sheet of a file, then import it ─────────────────────
// The old import read ONE sheet and assumed row 1 was the header. These two
// calls replace that: scan the whole file, see what each table is, answer what
// only the owner can know, then import the lot.

export interface DocSheet {
  name: string;
  hidden: boolean;
  images: number;
  skipped: boolean;
  reason: string;
  tables: string[];
}

export interface DocTable {
  id: string;
  sheet: string;
  title: string;
  header_row: number;
  orientation: 'rows' | 'matrix';
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  nonzero_rows: number;
  total_rows: number;
  notes: string[];
  dropped_columns: string[];
  /** Lines whose running balance disagrees with the figures on them. Reported,
   *  never corrected: only the owner knows which figure is right. */
  balance_checks: Array<{ row: number; label: string; balance_says: number;
                          figures_say: number; difference: number }>;
  what_it_is: string;
  import: boolean;
  reason: string;
  event_type: EventType;
  mapping: Record<string, string>;
  confidence: number;
  counts?: Record<string, number>;
  /** A sheet of the AIBOS workbook, known by its headings and filed exactly. */
  workbook?: WorkbookSheet;
  /** Products or Workers sheet: who or what is new, and how many are already on file. */
  records?: { new: string[]; new_count: number; known_count: number };
  /** Workbook lines already in the books from an earlier upload. */
  already?: number;
}

export type WorkbookSheet = 'sales' | 'expenses' | 'stock' | 'wages' | 'products' | 'workers' | 'guide' | 'lists';

/** One line of the owner's own book, as evidence for a question about it. */
export interface DocQuestionLine {
  row: number;
  date: string;
  amount: number | null;
  description: string;
  direction?: 'in' | 'out' | null;
  sheet?: string;
}

/** Something only the owner can settle: who a worker is, which product, how many.
 *  It carries the LINES it is about, because "2 lines, sheet Sheet1" is not a
 *  question anybody can answer. */
export interface DocQuestion {
  key: string;
  type: 'unknown_worker' | 'unknown_product' | 'missing_quantity'
      | 'uncategorised' | 'money_in_kind';
  name: string;
  /** A short heading: "Who is faith kasisi?" */
  title?: string;
  /** The question itself, in plain words. */
  ask: string;
  /** Why it matters to their books, so the choice is an informed one. */
  why?: string;
  /** Only ever set when it is genuinely close — a bad guess costs trust. */
  closest?: string | null;
  closest_score?: number | null;
  options: string[];
  count: number;
  total?: number;
  lines?: DocQuestionLine[];
  tables: string[];
  sheet: string;
  sheets?: string[];
}

export interface DocScan {
  filename: string;
  fingerprint: string;
  sheets: DocSheet[];
  sheet_count: number;
  table_count: number;
  row_total: number;
  nonzero_total: number;
  tables: DocTable[];
  questions: DocQuestion[];
  ai: boolean;
  ai_note: string;
  known: { employees: number; products: number; parties: number };
  event_types: EventType[];
  /** The file is, or holds sheets from, the AIBOS workbook. */
  workbook?: boolean;
}

export interface DocAnswer {
  action: 'add_worker' | 'use_worker' | 'add_product' | 'use_product'
        | 'set_quantity' | 'set_category' | 'expense' | 'skip'
        // What money coming in actually was. A float counted as income would
        // make a bad month look like a good one.
        | 'sale' | 'funding' | 'transfer';
  employee_id?: string;
  employee_name?: string;
  product_id?: string;
  product_name?: string;
  quantity?: number;
  category?: string;
}

export interface DocImportResult extends BulkResult {
  event_count: number;
  tables: Array<{ table: string; sheet: string; title: string; events: number;
                  event_type: string; counts: Record<string, number> }>;
  skipped: Array<{ table: string; row?: number; why: string }>;
  workers_not_on_register: string[];
  products_not_on_list: string[];
  /** What the owner's answers (and the workbook's lists) put on file for good. */
  recorded: { employees: string[]; products: string[] };
  /** Workbook lines left out because an earlier upload already brought them in. */
  already?: number;
}

/** Read every sheet of a file and say what each table on it is. */
export async function documentScan(file: File, useAi = true): Promise<DocScan> {
  const tooBig = uploadTooLarge(file);
  if (tooBig) throw new Error(tooBig);
  const form = new FormData();
  form.append('file', file);
  const data = await spineFetch(`/documents/scan?use_ai=${useAi ? 'true' : 'false'}`,
    { method: 'POST', body: form });
  return data as unknown as DocScan;
}

/** Import the tables the owner kept, each row filed against what it concerns. */
export async function documentImport(
  file: File,
  tables: Array<{ id: string; event_type?: EventType; mapping?: Record<string, string> }>,
  answers: Record<string, DocAnswer>,
  opts: { currency?: string; useAi?: boolean; force?: boolean } = {},
): Promise<DocImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('tables', JSON.stringify(tables));
  form.append('answers', JSON.stringify(answers));
  form.append('currency', opts.currency ?? 'ZMW');
  form.append('use_ai', opts.useAi === false ? 'false' : 'true');
  if (opts.force) form.append('force', 'true');
  const res = await fetch(`${PROXY}/documents/import`, {
    method: 'POST', body: form, headers: await authHeaders(),
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
  if (res.status === 409) {
    const d = (data.detail ?? {}) as { message?: string; imported_at?: string; saved_count?: number };
    throw new AlreadyImportedError(d.message ?? 'This file has already been imported.',
      d.imported_at ?? null, d.saved_count ?? null);
  }
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `Import failed (${res.status})`);
  }
  booksChanged();
  return data as unknown as DocImportResult;
}

/** Receipt photo/upload → vision-OCR → a proposed Purchase (reviewed before saving). */
export async function ingestReceipt(file: File, currency = 'ZMW'): Promise<EventProposal> {
  const photo = await shrinkPhoto(file);
  const tooBig = uploadTooLarge(photo);
  if (tooBig) throw new Error(tooBig);
  const form = new FormData();
  form.append('file', photo);
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
/** How a ticked-off PAYE, NAPSA, NHIMA or levy reminder went into the books. */
export interface ScheduleSettled {
  outcome: 'already_paid' | 'confirmed' | 'waiting_for_owner' | 'recorded' | 'nothing_to_record';
  message: string;
}

/** A ticked-off statutory reminder, into the books once: it confirms the
 *  payment payroll drafted, or says it is already paid, never a second one. */
export async function settleScheduleItem(id: string): Promise<ScheduleSettled> {
  const data = await spineFetch(`/schedule/${encodeURIComponent(id)}/settle`, { method: 'POST' });
  return data as unknown as ScheduleSettled;
}

/** Is this reminder a statutory payment (the server decides the same way)? */
export function statutoryTax(title: string | null | undefined): 'PAYE' | 'NAPSA' | 'NHIMA' | 'SDL' | null {
  const t = String(title ?? '').toLowerCase();
  if (t.includes('paye')) return 'PAYE';
  if (t.includes('napsa')) return 'NAPSA';
  if (t.includes('nhima')) return 'NHIMA';
  if (t.includes('skills development levy') || /\bsdl\b/.test(t)) return 'SDL';
  return null;
}

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
  /** Basic salary. NHIMA is 1% of this. */
  basic_pay: number;
  /** Regular cash allowances on top (housing, transport...). PAYE and NAPSA
   *  count them; NHIMA does not. Absent before migration 0039. */
  allowances?: number;
  /** Aged 60 or over: no NAPSA either side. */
  napsa_exempt?: boolean;
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
  /** Where their payslip goes (migration 0042): a WhatsApp number in full
   *  international form, and an email AIBOS sends it to with the PDF. */
  phone?: string | null;
  email?: string | null;
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
  basic?: number;
  allowances?: number;
  gross: number;
  napsa_employee: number;
  napsa_employer: number;
  nhima_employee: number;
  nhima_employer?: number;
  /** Skills Development Levy: the employer's own 0.5%, never from the pay. */
  sdl?: number;
  /** Gross plus the employer's NAPSA, NHIMA and levy: what this person costs. */
  employer_cost?: number;
  napsa_exempt?: boolean;
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
  basic?: number;
  allowances?: number;
  gross: number;
  napsa_employee: number;
  napsa_employer: number;
  /** Both halves: what NAPSA is actually owed. */
  napsa_total?: number;
  nhima_employee: number;
  nhima_employer?: number;
  nhima_total?: number;
  sdl?: number;
  employer_cost?: number;
  paye: number;
  loan_deduction: number;
  net: number;
  gratuity_accrued: number;
  headcount: number;
}

/** A statutory remittance (PAYE→ZRA, NAPSA, NHIMA) drafted as a pending TaxPayment. */
export interface RemittanceDraft {
  tax_type: 'PAYE' | 'SDL' | 'NAPSA' | 'NHIMA';
  authority: string;
  amount: number;
  /** How much of `amount` came out of staff pay, and how much the employer adds. */
  employee_share?: number;
  employer_share?: number;
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
  sdl?: SdlStatus;
  rates_note?: string | null;
  /** The statutory reminders the account's first run set by itself. */
  reminders_set?: string[];
}

export interface PayrollPreview {
  period: string;
  payslips: Payslip[];
  totals: PayrollTotals;
  remittances: RemittanceDraft[];
  rates: PayrollRates | null;
  sdl?: SdlStatus;
  /** Set when the pay date is in a year whose rates AIBOS has not checked. */
  rates_note?: string | null;
}

/** Whether the business pays the Skills Development Levy, and why. */
export interface SdlStatus {
  setting: 'auto' | 'pays' | 'exempt';
  due: boolean;
  why: string;
  rate: number;
  threshold: number;
  turnover_12m: number | null;
}

/** A past run worked out again with today's rules (changes nothing). */
export interface PayrollRecheck {
  run_id: string;
  period: string;
  pay_date: string;
  changed: boolean;
  summary: string;
  owed_to_staff: number;
  under_deducted_from_staff: number;
  difference: Record<'paye' | 'napsa_employee' | 'napsa_employer' | 'nhima_employee' | 'nhima_employer' | 'sdl' | 'net', number>;
  /** What each authority is still owed or was paid too much, and whether it is drafted. */
  to_settle?: PayrollCorrectionRow[];
  people: Array<{
    employee_id?: string | null;
    employee_name?: string | null;
    gross: number;
    changed: boolean;
    was: Record<string, number>;
    now: Record<string, number>;
    difference: Record<string, number>;
  }>;
}

export interface PayrollRates {
  effective_from: string;
  currency: string;
  paye_bands: Array<{ up_to: number | null; rate: number }>;
  napsa_rate: number;
  napsa_ceiling: number;
  nhima_rate: number;
  napsa_on?: string;
  nhima_on?: string;
  paye_on?: string;
  sdl_rate?: number;
  sdl_turnover_threshold?: number;
  napsa_retirement_age?: number;
  verified_through?: number;
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

/** Whether this business pays the Skills Development Levy (owner). */
export async function getPayrollSettings(period?: string): Promise<SdlStatus> {
  const q = period ? `?period=${encodeURIComponent(period)}` : '';
  const data = await spineFetch(`/payroll/settings${q}`);
  return data.sdl as SdlStatus;
}

export async function setPayrollSdl(sdl: SdlStatus['setting']): Promise<SdlStatus> {
  const data = await spineFetch('/payroll/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sdl }),
  });
  return data.sdl as SdlStatus;
}

/** A past run against today's rules: what was deducted too much or too little. */
export async function recheckPayrollRun(runId: string): Promise<PayrollRecheck> {
  const data = await spineFetch(`/payroll/runs/${encodeURIComponent(runId)}/recheck`);
  return data.recheck as PayrollRecheck;
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

export interface PayrollRunDeleted {
  period: string;
  wages_voided: number;
  tax_drafts_voided: number;
  tax_payments_kept: number;
  loans_restored: number;
}

/** Undo a run made by mistake: wages voided in the books, unpaid tax drafts
 *  voided, loan instalments given back, the month free to run again. */
export async function deletePayrollRun(id: string, wagesNeverPaid = false): Promise<PayrollRunDeleted> {
  // A run whose wages are in the books as paid is refused (ApiError code
  // 'paid_wages') unless the owner says they were never paid.
  const q = wagesNeverPaid ? '?wages_never_paid=true' : '';
  const data = await spineFetch(`/payroll/runs/${encodeURIComponent(id)}${q}`, { method: 'DELETE' });
  return data as unknown as PayrollRunDeleted;
}

/** Wages that wait for payday, paid now: into the books as paid on that day. */
export async function payPayrollWages(id: string, paidOn?: string): Promise<{ paid: number; amount: number; paid_on: string }> {
  const data = await spineFetch(`/payroll/runs/${encodeURIComponent(id)}/pay`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paid_on: paidOn ?? null }),
  });
  return data as unknown as { paid: number; amount: number; paid_on: string };
}

/** One authority's part of a past run's corrections. */
export interface PayrollCorrectionRow {
  tax_type: 'PAYE' | 'SDL' | 'NAPSA' | 'NHIMA';
  authority: string;
  owed: boolean;
  amount: number;
  employee_share: number;
  employer_share: number;
  was: number;
  now: number;
  drafted?: boolean;
  draft_status?: string | null;
}

export interface PayrollCorrections {
  run_id: string;
  period: string;
  drafted: PayrollCorrectionRow[];
  already: PayrollCorrectionRow[];
  overpaid: PayrollCorrectionRow[];
  summary: string;
}

/** What a past run still owes ZRA, NAPSA and NHIMA, drafted for the owner to confirm. */
export async function draftPayrollCorrections(id: string): Promise<PayrollCorrections> {
  const data = await spineFetch(`/payroll/runs/${encodeURIComponent(id)}/corrections`, { method: 'POST' });
  return data.corrections as PayrollCorrections;
}

/** Commit a pay period — posts a Salary event per employee (Pro). */
export async function runPayroll(period: string, payDate?: string): Promise<PayrollRun> {
  const data = await spineFetch('/payroll/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, pay_date: payDate ?? null, preview: false }),
  });
  return { ...(data.run as PayrollRun), reminders_set: (data.reminders_set as string[] | undefined) ?? [] };
}

// ── Payslips to the staff themselves (aibos-api payslip_delivery.py) ─────────

/** One person on a run: where their payslip can go and whether it has. */
export interface PayslipRecipient {
  employee_id?: string | null;
  employee_name?: string | null;
  net?: number;
  email?: string | null;
  phone?: string | null;
  /** Opens WhatsApp on the owner's phone with the payslip already written. */
  whatsapp_url?: string | null;
  sent_at?: string | null;
  sent_via?: 'email' | 'whatsapp' | null;
}

export interface PayslipDelivery {
  period: string;
  people: PayslipRecipient[];
  total: number;
  sent: number;
  waiting: number;
  /** People with neither a phone nor an email: nowhere to send theirs. */
  unreachable: number;
  email_channel: 'live' | 'not configured';
}

export interface PayslipEmailResult {
  sent: string[];
  failed: string[];
  no_email: string[];
  already: string[];
  email_channel: 'live' | 'not configured';
  /** Set when the email went but its record waits for migration 0042. */
  note?: string | null;
}

export async function getPayslipDelivery(runId: string): Promise<PayslipDelivery> {
  const data = await spineFetch(`/payroll/runs/${encodeURIComponent(runId)}/delivery`);
  return data as unknown as PayslipDelivery;
}

/** Email each person on the run their payslip, the PDF attached (owner). */
export async function emailPayslips(runId: string, again = false): Promise<PayslipEmailResult> {
  const data = await spineFetch(`/payroll/runs/${encodeURIComponent(runId)}/send-payslips`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ again }),
  });
  return data as unknown as PayslipEmailResult;
}

/** The owner opened this person's payslip in WhatsApp from AIBOS. */
export async function markPayslipShared(runId: string, employeeId: string): Promise<{ sent_at: string }> {
  const data = await spineFetch(
    `/payroll/runs/${encodeURIComponent(runId)}/payslips/${encodeURIComponent(employeeId)}/shared`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ via: 'whatsapp' }),
    });
  return data as unknown as { sent_at: string };
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

// ── The forecast engine and the 13-week cash plan (16 Oct 2026) ──────────────
// aibos-api forecast_engine.py tests several methods on the owner's own months
// and blends the best; outlook.py is the Forecast page; cash_plan.py is
// Growth's day-by-day plan of the next 91 days.

/** The cautious (P10), likely (P50) and hopeful (P90) ends of a range. */
export interface Band { p10: number; p50: number; p90: number }

export interface ForecastMethod { name: string; label: string; weight: number; score: number }

export interface ForecastAccuracy {
  tested: number;
  avg_miss: number;
  naive_miss: number;
  avg_miss_pct?: number;
  naive_miss_pct?: number;
  better_than_naive_pct?: number;
}

export interface Outlook {
  ok: boolean;
  reason?: string;
  points?: number;
  history?: { month: string; revenue: number; costs: number; profit: number }[];
  this_month?: {
    month: string;
    costs_so_far: number;
    shape_learned: boolean;
    revenue: { so_far: number; expected_by_now: number; pace_pct: number | null; estimate: number; p10: number; p90: number; share_in: number };
  } | null;
  ahead?: { month: string; revenue: Band; costs: Band; profit: Band; season?: 'busy' | 'quiet' | null }[];
  methods?: ForecastMethod[];
  accuracy?: ForecastAccuracy;
  accuracy_words?: string;
  softened?: string[];
  seasonal?: boolean;
  trend?: { revenue_per_month: number; direction: 'growing' | 'slowing' | 'steady' };
  /** Where the busy and quiet months the owner told AIBOS change the reading. */
  season_notes?: string[];
  /** Softened months the owner named as busy or quiet: their season, not one-offs. */
  softened_named?: string[];
}

// ── The owner's busy and quiet months in the reports (28 Oct 2026) ───────────
// aibos-api seasons.py: Unusual spending and Month by month read with the
// months the owner told AIBOS in Teach AIBOS, so a December they said runs
// busy is not called unusual for being high.

/** One month that broke the pattern, in the shape Unusual spending draws. */
export interface MonthFlag {
  id: string;
  month: string;
  field: 'Revenue' | 'Costs';
  value: number;
  expected: number;
  zScore: number;
  severity: 'critical' | 'warning';
  direction: 'up' | 'down';
  /** What the owner told AIBOS about this month, when they named it. */
  told?: string;
}

export interface MonthsReading {
  ok: boolean;
  busy: number[];
  quiet: number[];
  unusual: {
    flags: MonthFlag[];
    /** High in a busy month or low in a quiet one: not counted as unusual. */
    held: MonthFlag[];
    months: { month: string; season: 'busy' | 'quiet' | null; told: string | null; status: string; revenue_z: number; costs_z: number }[];
  };
  changes: { month: string; season: 'busy' | 'quiet' | null; first: boolean; sales_pct: number; costs_pct: number; sales_wrong: boolean; costs_wrong: boolean; told: string | null }[];
}

/** The months a report shows, read with the owner's busy and quiet months. */
export async function readMonths(rows: { month: string; revenue: number; costs: number }[]): Promise<MonthsReading> {
  const data = await spineFetch('/reports/months', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  return data as unknown as MonthsReading;
}

/** Sales, costs and profit ahead from the recorded books. */
export async function getOutlook(): Promise<Outlook> {
  const data = await spineFetch(`/forecast/outlook?tz=${tzMinutes()}`);
  return data.outlook as Outlook;
}

/** One forecast AIBOS kept before its month (or day) happened, and how it did. */
export interface TrackRow {
  target: string;            // 'YYYY-MM' for sales, 'YYYY-MM-DD' for the cash plan's week 4
  kept_on: string | null;
  p10: number;
  p50: number;
  p90: number;
  status: 'judged' | 'waiting' | 'unrecorded';
  actual?: number;
  side?: 'inside' | 'above' | 'below';
  inside?: boolean;
  miss_pct?: number;
  hit_rate_pct?: number;     // the running hit rate up to this one
  judged_from?: string;
  reason?: string;
}

export interface TrackSummary {
  rows: TrackRow[];          // oldest first
  judged: number;
  inside: number;
  hit_rate_pct: number | null;
  recent: { count: number; inside: number };
  expected_pct: number;
  words: string;
  next: TrackRow | null;
}

export interface TrackRecord {
  available: boolean;
  reason?: string;
  sym?: string;
  sales: TrackSummary | null;
  cash: TrackSummary | null; // Growth, owner and accountant
}

/** What the forecast said before each month, against the confirmed books. */
export async function getTrackRecord(): Promise<TrackRecord> {
  const data = await spineFetch('/forecast/track-record');
  return data.record as TrackRecord;
}

/** The same outlook for an uploaded file's periods (every one finished). */
export async function getSeriesOutlook(rows: { month: string; revenue: number; costs: number }[]): Promise<Outlook> {
  const data = await spineFetch('/forecast/series', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  return data.outlook as Outlook;
}

export interface PlanItem {
  id: string;
  day: string;
  label: string;
  amount: number;
  dir: 'in' | 'out';
  source: 'waiting' | 'schedule' | 'regular';
  key?: string;
  /** For a regular payment: how sure AIBOS is that it comes round, in percent. */
  chance?: number;
}

export interface PlanWeek {
  week: number;
  start: string;
  end: string;
  in: number;
  out: number;
  close_p10: number;
  close_p50: number;
  close_p90: number;
  low_p10: number;
  chance_short_pct: number;
  items: PlanItem[];
}

export interface PlanLever {
  key: 'collect' | 'spend' | 'faster' | 'move';
  title: string;
  detail: string;
  chance_short_pct: number;
  better_by_pct: number;
  lowest_p10: number;
}

export interface PlanDebt {
  ref: string;
  customer: string;
  label: string;
  amount: number;
  owed: string;
  age: number;
  kind: 'invoice' | 'credit' | 'stay';
  chance_in_plan_pct: number;
  likely_by: string | null;
}

/** Who to ask for money first, with why and the reminder ready to send. */
export interface PlanChase extends PlanDebt {
  why: string;
  /** How much collecting it this week lowers the chance of running short (points), when at risk. */
  cuts_risk_pct?: number;
  chance_short_after_pct?: number;
  /** For wa.me: digits with the country code, or null when no number is known. */
  phone?: string | null;
  pay_url?: string | null;
  pay_urls?: string[];
  message?: string;
  /** How many amounts this customer owes (one row, one reminder, per customer). */
  count?: number;
  numbers?: string[];
}

/** The plan in a sentence, for Home (GET /forecast/cash-watch). */
export interface CashWatch {
  ok: boolean;
  reason?: string;
  preview?: boolean;
  at_risk?: boolean;
  headline?: string;
  chance_short_pct?: number;
  chance_words?: string;
  first_risk_date?: string | null;
  safe_to_spend?: number;
  cash_needed?: number;
  lowest?: { p50: number; day: string; p10: number };
  cash_now?: number;
  sym?: string;
  /** The line the plan keeps above; 'cushion' when it is the cash the owner told AIBOS to keep. */
  floor?: number;
  floor_from?: 'cushion' | null;
  coming?: { day: string; label: string; amount: number; source: string }[];
  chase_first?: { customer: string; amount: number; why: string; phone?: string | null; message?: string } | null;
}

export async function getCashWatch(): Promise<CashWatch> {
  const data = await spineFetch(`/forecast/cash-watch?tz=${tzMinutes()}`);
  return data.watch as CashWatch;
}

/** A WhatsApp link with the message ready; the owner sends it from their own phone. */
export function whatsAppLink(message: string, phone?: string | null): string {
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(message)}`;
}

export interface PlanCore {
  ok: boolean;
  today: string;
  until: string;
  cash_now: number;
  floor: number;
  /** 'cushion' when the floor is the cash the owner told AIBOS to keep (Teach AIBOS). */
  floor_from?: 'cushion' | null;
  chance_short_pct: number;
  chance_words: string;
  lowest: { p50: number; day: string; p10: number };
  close: Band;
  first_risk_week: number | null;
  first_risk_date: string | null;
  weeks: PlanWeek[];
  daily: ({ day: string } & Band)[];
  drivers: Record<'sales' | 'debts_collected' | 'new_credit_collected' | 'known_in' | 'spending' | 'regular_bills' | 'known_out', number>;
  safe_to_spend?: number;
  cash_needed?: number;
  headline: string;
}

export interface CashPlan extends Partial<PlanCore> {
  ok: boolean;
  reason?: string;
  /** Below Growth: the headline risk only. */
  preview?: boolean;
  at_risk?: boolean;
  sym?: string;
  /** The cash cushion the owner gave AIBOS, said even when they typed another floor. */
  cushion?: number;
  /** A monthly loan repayment the owner told AIBOS about, counted while the books show none. */
  told_loan?: number;
  levers?: PlanLever[];
  debts?: PlanDebt[];
  chase?: PlanChase[];
  regular?: { key: string; label: string; cadence: string; amount: number; prob: number; count: number; last: string; next: string[] }[];
  known?: PlanItem[];
  accuracy?: Record<string, ForecastAccuracy>;
  assumptions?: string[];
  scenario?: {
    words: string[];
    plan: PlanCore;
    change: { chance_short_pct: number; close_p50: number; lowest_p10: number };
  };
}

export type PlanDecision =
  | { type: 'one_off'; direction: 'in' | 'out'; amount: number; date?: string; label?: string }
  | { type: 'recurring'; direction: 'in' | 'out'; amount: number; every: 'month' | 'week'; start?: string; label?: string }
  | { type: 'hire'; count: number; monthly_salary: number; allowances?: number; start?: string }
  | { type: 'sales_change'; pct: number; start?: string }
  | { type: 'cost_change'; pct: number; start?: string }
  | { type: 'collect_faster'; days: number }
  | { type: 'move'; id: string; days: number };

/** `floor` null: the server keeps the cash cushion the owner gave AIBOS (zero without one). */
function floorParam(floor: number | null): string {
  return floor === null ? '' : `floor=${Math.max(0, floor)}&`;
}

export async function getCashPlan(floor: number | null = null): Promise<CashPlan> {
  const data = await spineFetch(`/forecast/cash-plan?${floorParam(floor)}tz=${tzMinutes()}`);
  return data.plan as CashPlan;
}

/** The plan with decisions tried on it, on the same futures as the plan. */
export async function decideCashPlan(scenarios: PlanDecision[], floor: number | null = null): Promise<CashPlan> {
  const data = await spineFetch('/forecast/cash-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarios, floor: floor === null ? null : Math.max(0, floor), tz: tzMinutes() }),
  });
  return data.plan as CashPlan;
}

/** The cash flow projection a bank asks for with a loan application
 *  (Growth): the money now, 12 months ahead, the 13 weeks, money owed, the
 *  regular payments and the assumptions. Built on the server from the same
 *  read of the books as the plan, so every figure is the books' own. */
export async function downloadBankProjection(floor: number | null = null): Promise<void> {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await downloadFile(`/forecast/cash-plan/bank.pdf?${floorParam(floor)}tz=${tzMinutes()}`,
    `cash_flow_projection_${day}.pdf`);
}

export interface CashGroup {
  ok: boolean;
  reason?: string;
  businesses?: { business_id: string; name: string; cash_now: number; close_p50: number; chance_short_pct: number; first_risk_week: number | null; lowest_p10: number; spare_p10: number }[];
  cash_now?: number;
  chance_short_pct?: number;
  any_short_pct?: number;
  weeks?: { week: number; close_p10: number; close_p50: number; close_p90: number }[];
  moves?: { from: string; to: string; amount: number; by_week: number | null; words: string }[];
  without_plan?: { business_id: string; name: string; cash_now: number; reason: string }[];
}

export async function getCashGroup(floor = 0): Promise<CashGroup> {
  const data = await spineFetch(`/forecast/group?floor=${Math.max(0, floor)}&tz=${tzMinutes()}`);
  return data.group as CashGroup;
}

/** Seed the twin's opening cash + currency (Setup Wizard). */
/** opening_cash null leaves the recorded starting cash as it is. */
export async function seedTwin(opening_cash: number | null, currency = 'ZMW'): Promise<Twin> {
  const data = await spineFetch('/twin/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opening_cash, currency }),
  });
  return data.twin as Twin;
}

// ── Business identity: "it already knew me" (Setup Wizard) ───────────────────

/** One public listing that might be the owner's business. Field names match the
 *  profile columns they fill, so applying a match is a plain spread — no second
 *  mapping here to drift out of step with aibos-api/identity.py. */
export interface BusinessMatch {
  place_id:       string;
  business_name:  string;
  industry:       string;       // '' when Google's types didn't map cleanly
  location:       string;
  operating_hours: string;
  phone:          string;
  website:        string;
  logo_url:       string;
  /** Context for the "Is this you?" card — shown to help them decide, not saved. */
  address:        string;
  rating:         number | null;
  reviews:        number | null;
  closed:         boolean;
  confidence:     number;       // 0-1
  source:         string;       // 'google_places'
}

export interface IdentityLookup {
  /** False when this deployment has no PLACES_API_KEY. The wizard then shows
   *  nothing at all — an absent feature must not look like a failed one. */
  configured: boolean;
  candidates: BusinessMatch[];
}

/** Find the owner's existing online presence. Never throws: a lookup that fails
 *  must not stop someone from finishing setup by typing. */
export async function lookupBusinessIdentity(
  q: string, opts: { phone?: string; country?: string; signal?: AbortSignal } = {},
): Promise<IdentityLookup> {
  const params = new URLSearchParams({ q, country: opts.country || 'ZM' });
  if (opts.phone) params.set('phone', opts.phone);
  try {
    const headers = await authHeaders();
    const res = await fetch(`${PROXY}/identity/lookup?${params}`, { headers, signal: opts.signal });
    if (!res.ok) return { configured: false, candidates: [] };
    const data = (await res.json()) as Partial<IdentityLookup>;
    return { configured: !!data.configured, candidates: data.candidates ?? [] };
  } catch {
    // Includes the AbortError from a superseded keystroke — the caller has
    // already moved on, so there is nothing to report.
    return { configured: false, candidates: [] };
  }
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

/** One business's latest analysis of a kind of file (GET /analysis/latest). */
export interface SavedAnalysis {
  at?: string; cabinet_id?: string | null; filename?: string; payload?: Record<string, unknown>;
  /** Start fresh wiped these books: nothing comes back, not even a device's own copy. */
  cleared?: boolean;
}

/** The latest till (engine3) and customer (engine2) analysis for the business
 *  on screen, so those reports open with the owner's figures on every visit
 *  and every device, not only in the tab that uploaded the file. */
export async function getLatestAnalysis(): Promise<{ engine3: SavedAnalysis | null; engine2: SavedAnalysis | null }> {
  const data = await spineFetch('/analysis/latest');
  return {
    engine3: (data.engine3 as SavedAnalysis | null) ?? null,
    engine2: (data.engine2 as SavedAnalysis | null) ?? null,
  };
}

/** Hand the server an analysis only this device still has, so every device
 *  gets it. The server keeps it only when it has nothing newer. */
export async function saveLatestAnalysis(engine: 'engine3' | 'engine2', filename: string, payload: Record<string, unknown>): Promise<void> {
  await spineFetch('/analysis/latest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine, filename, payload }),
  });
}

