/**
 * AI-BOS — FastAPI Client
 * All calls to the Python backend go through here.
 * Replace MOCK data in store.ts with these once API is deployed.
 */

const API = 'https://aibos-api-production.up.railway.app';

// ─── Types mirror engine.py return shapes ─────────────────────────────────────

export interface UploadResult {
  ok:            boolean;
  rows:          number;
  columns:       string[];
  records:       Record<string, unknown>[];
  pnl:           PNL;
  health_score:  number;
  health_label:  string;
  alerts:        Alert[];
  cashflow:      CashflowMonth[];
  runway_months: number;
  forecast:      ForecastResult;
  anomalies:     Anomaly[];
  breakeven:     Breakeven;
}

export interface PNL {
  total_revenue: number;
  total_costs:   number;
  total_profit:  number;
  avg_margin:    number;
  best_month:    string;
  worst_month:   string;
}

export interface Alert {
  month:      string;
  change_pct: number;
  direction:  'drop' | 'spike';
  type?:      string;
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
  forecast:       ForecastPoint[];
  trend:          string;
  growth_rate:    number;
  confidence:     number;
  r_squared:      number;
  ai_explanation: string;
  std_err:        number;
  error?:         string;
}

export interface Anomaly {
  month:       string;
  metric:      string;
  type:        string;
  direction:   string;
  change_pct:  number;
  z_score:     number;
  severity:    'critical' | 'high' | 'medium' | 'low';
  root_cause:  string;
}

export interface Breakeven {
  breakeven_revenue:       number;
  current_avg_revenue:     number;
  breakeven_pct:           number;
  contribution_margin_ratio: number;
  fixed_costs:             number;
  variable_costs:          number;
  margin_of_safety:        number;
  margin_of_safety_pct:    number;
  months_to_profit:        number | null;
  scenarios:               BreakevenScenario[];
  ai_insight:              string;
}

export interface BreakevenScenario {
  cost_increase_pct: number;
  new_breakeven:     number;
  margin_of_safety:  number;
  status:            'safe' | 'at risk';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }
  return res.json();
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Upload a CSV or Excel file.
 * Returns all analysis results in one call.
 * Call this when the user drops a file onto the FileUpload component.
 */
export async function uploadFile(
  file: File,
  options: { current_cash?: number; months_ahead?: number; z_threshold?: number; fixed_cost_pct?: number } = {}
): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);

  const params = new URLSearchParams({
    current_cash:   String(options.current_cash   ?? 50000),
    months_ahead:   String(options.months_ahead   ?? 3),
    z_threshold:    String(options.z_threshold    ?? 2.0),
    fixed_cost_pct: String(options.fixed_cost_pct ?? 0.40),
  });

  const res = await fetch(`${API}/upload?${params}`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Upload failed ${res.status}`);
  }
  return res.json();
}

/**
 * Re-run all analysis with new parameters (no re-upload needed).
 * Call when user adjusts z-score slider or fixed cost % slider.
 */
export async function reanalyse(
  records: Record<string, unknown>[],
  options: { current_cash?: number; months_ahead?: number; z_threshold?: number; fixed_cost_pct?: number } = {}
): Promise<Omit<UploadResult, 'records' | 'rows' | 'columns'>> {
  return post('/analyse', { records, ...options });
}

/**
 * AI CFO Chat — sends question, loads Supabase history, streams response.
 * Saves both user question and AI answer to Supabase chat_history table.
 */
export async function sendChatMessage(payload: {
  question:      string;
  user_id:       string;
  session_label?: string;
  pnl?:          PNL;
  alerts?:       Alert[];
  persist?:      boolean;
}): Promise<{ ok: boolean; answer: string }> {
  return post('/chat', payload);
}

/**
 * Load full chat history for a user from Supabase.
 */
export async function getChatHistory(
  user_id: string,
  session_label = 'default',
  limit = 30
): Promise<{ ok: boolean; messages: { role: string; content: string }[] }> {
  const res = await fetch(
    `${API}/chat/history?user_id=${user_id}&session_label=${session_label}&limit=${limit}`
  );
  return res.json();
}

/**
 * Clear chat history for a user.
 */
export async function clearChatHistory(user_id: string, session_label = 'default'): Promise<void> {
  await fetch(`${API}/chat/history?user_id=${user_id}&session_label=${session_label}`, {
    method: 'DELETE',
  });
}

/**
 * Download Excel report — triggers browser file download.
 */
export async function downloadExcel(payload: {
  records:        Record<string, unknown>[];
  pnl:            PNL;
  health_score:   number;
  health_label:   string;
  alerts:         Alert[];
  runway_months:  number;
  forecast_data?: ForecastResult;
  anomaly_data?:  Anomaly[];
  breakeven_data?: Breakeven;
}): Promise<void> {
  const res = await fetch(`${API}/export/excel`, {
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

/**
 * Subscribe to weekly email reports.
 */
export async function subscribeEmail(payload: {
  user_id: string; email: string; frequency?: string;
}): Promise<{ ok: boolean }> {
  return post('/email/subscribe', payload);
}

/**
 * Health check — useful to verify API is reachable before showing UI.
 */
export async function pingAPI(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
