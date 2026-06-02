/**
 * AI-BOS — API Client
 * All requests go through /api/proxy (Next.js server) → Railway FastAPI.
 * This avoids CORS entirely — server-to-server calls have no restrictions.
 */

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
    endpoint:       '/upload',
    current_cash:   String(options.current_cash   ?? 50000),
    months_ahead:   String(options.months_ahead   ?? 3),
    z_threshold:    String(options.z_threshold    ?? 2.0),
    fixed_cost_pct: String(options.fixed_cost_pct ?? 0.40),
  });

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${PROXY}?${params}`, {
    method: 'POST',
    body:   form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? err.detail ?? `Upload failed ${res.status}`);
  }

  return res.json();
}

// ─── Re-analyse ───────────────────────────────────────────────────────────────

export async function reanalyse(
  records: Record<string, unknown>[],
  options: { current_cash?: number; months_ahead?: number; z_threshold?: number; fixed_cost_pct?: number } = {}
): Promise<Omit<UploadResult, 'records' | 'rows' | 'columns'>> {
  const res = await fetch(`${PROXY}?endpoint=/analyse`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ records, ...options }),
  });
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
  const res = await fetch(`${PROXY}?endpoint=/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  return res.json();
}

// ─── Excel export ─────────────────────────────────────────────────────────────

export async function downloadExcel(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${PROXY}?endpoint=/export/excel`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${PROXY}?endpoint=/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export async function subscribeEmail(payload: { user_id: string; email: string; frequency?: string }): Promise<{ ok: boolean }> {
  const res = await fetch(`${PROXY}?endpoint=/email/subscribe`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  return res.json();
}
