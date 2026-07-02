'use client';
/**
 * AI-BOS — Import history from Excel/CSV (Evolution Initiative 2).
 * Adapt to the user's spreadsheet, never the reverse: upload → AI suggests a
 * column mapping → preview & validate → import (partial import supported; bad
 * rows are reported, not dropped silently). Mapping is remembered locally as a
 * template (server-side Business Memory is Phase 5).
 */
import { useCallback, useRef, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { useStore } from '@/lib/store';
import {
  excelPreview, excelCommit,
  type ExcelPreview, type BulkResult, type EventType,
} from '@/lib/api';

const FIELDS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'date',         label: 'Date',          hint: 'When it happened' },
  { key: 'amount',       label: 'Amount',        hint: 'The money value' },
  { key: 'type',         label: 'Type',          hint: 'Sale / Purchase / Expense…' },
  { key: 'description',  label: 'Description',   hint: 'Notes / item' },
  { key: 'counterparty', label: 'Customer/Supplier', hint: 'Who' },
  { key: 'category',     label: 'Category',      hint: 'Expense category' },
];
const TYPES: EventType[] = [
  'Sale', 'Purchase', 'Expense', 'InventoryReceipt', 'InventoryAdjustment',
  'Salary', 'SupplierPayment', 'CustomerPayment', 'AssetPurchase',
  'TaxPayment', 'Loan', 'Refund', 'Transfer',
];
const TEMPLATE_KEY = 'aibos-excel-mapping-v1';

// Mirrors the backend (ingestion.py) so the default type stays consistent with
// the chosen Amount column: a "Revenue" column logs Sales, "Expenses" logs costs.
const INCOME_WORDS = ['revenue', 'sales', 'income', 'turnover', 'takings', 'receipt'];
const EXPENSE_WORDS = ['expense', 'cost', 'spend', 'outflow', 'purchase', 'payment'];
function inferTypeFromColumn(col?: string): EventType | null {
  if (!col) return null;
  const c = col.toLowerCase();
  if (INCOME_WORDS.some(w => c.includes(w))) return 'Sale';
  if (EXPENSE_WORDS.some(w => c.includes(w))) return 'Expense';
  return null;
}

const sel: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', outline: 'none',
};

export default function ImportPage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const refreshTwin = useStore(s => s.refreshTwin);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'idle' | 'parsing' | 'map' | 'committing' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultType, setDefaultType] = useState<EventType>('Expense');
  // Once the user picks a type by hand, stop auto-deriving it from the amount column.
  const [typeTouched, setTypeTouched] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const onPick = useCallback(async (file: File) => {
    setError(null); setResult(null); setPhase('parsing');
    try {
      const pv = await excelPreview(file);
      setPreview(pv);
      // Prefer a saved template if its columns still fit; else the AI suggestion.
      let map = pv.suggestion;
      try {
        const saved = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || 'null');
        if (saved && Object.values(saved).every(c => pv.columns.includes(c as string))) map = saved;
      } catch { /* ignore */ }
      setMapping(map);
      // Default the event type to match the amount column (backend also suggests
      // this): a Revenue amount defaults to Sale, an Expenses amount to Expense.
      setDefaultType(inferTypeFromColumn(map.amount) ?? pv.suggested_type ?? 'Expense');
      setTypeTouched(false);
      setPhase('map');
    } catch (e) {
      setError((e as Error).message || 'Could not read that file.');
      setPhase('idle');
    }
  }, []);

  const validCount = preview
    ? preview.rows.filter(r => {
        const a = mapping.amount ? r[mapping.amount] : null;
        const n = typeof a === 'number' ? a : parseFloat(String(a ?? ''));
        return !mapping.amount || (!isNaN(n) && n > 0);
      }).length
    : 0;

  async function commit() {
    if (!preview) return;
    setError(null); setPhase('committing');
    try {
      const res = await excelCommit(preview.rows, mapping, { event_type: defaultType, currency: 'ZMW' });
      setResult(res);
      try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(mapping)); } catch { /* ignore */ }
      refreshTwin();
      setPhase('done');
    } catch (e) {
      setError((e as Error).message || 'Import failed.');
      setPhase('map');
    }
  }

  function reset() {
    setPreview(null); setResult(null); setMapping({}); setPhase('idle'); setError(null);
    setTypeTouched(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
          Import history
        </h1>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>
          Bring an Excel or CSV of past activity — AIBOS adapts to your columns.
        </p>
      </div>

      {/* Upload */}
      {(phase === 'idle' || phase === 'parsing') && (
        <SectionCard title="Choose a file" subtitle="Excel (.xlsx/.xls) or CSV — any layout">
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); }}
            disabled={phase === 'parsing'}
            style={{ display: 'block', width: '100%', padding: '20px', minHeight: 56, border: '1px dashed var(--upload-border)', borderRadius: 10, background: 'var(--upload-bg)', color: 'var(--text-2)', fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', cursor: 'pointer' }}
          />
          {phase === 'parsing' && <p style={{ marginTop: 12, color: 'var(--text-3)', fontSize: '0.82rem' }}>Reading your file…</p>}
        </SectionCard>
      )}

      {error && (
        <div style={{ margin: '12px 0', padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.82rem' }}>{error}</div>
      )}

      {/* Map + preview */}
      {phase !== 'done' && preview && phase !== 'idle' && phase !== 'parsing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionCard title="Map your columns" subtitle={`${preview.row_count} rows · sheet "${preview.active_sheet}"`}>
            {preview.summary_like && (
              <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--amber-dim, rgba(251,191,36,0.12))', border: '1px solid var(--amber)', color: 'var(--text-2)', fontSize: '0.78rem', fontFamily: 'Geist, sans-serif', lineHeight: 1.5 }}>
                This looks like a monthly <strong>summary</strong> — it has both income and expense columns.
                Each import maps <strong>one</strong> Amount column: pick <strong>Revenue</strong> to log Sales, or
                <strong> Expenses</strong> to log costs, then import again for the other. The default type below follows your Amount choice.
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
                When a row has no type column, treat rows as
              </label>
              <select value={defaultType} onChange={e => { setDefaultType(e.target.value as EventType); setTypeTouched(true); }} style={{ ...sel, maxWidth: 240 }}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block' }}>
                    {f.label} <span style={{ color: 'var(--text-4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {f.hint}</span>
                  </label>
                  <select
                    value={mapping[f.key] ?? ''}
                    onChange={e => {
                      const val = e.target.value;
                      setMapping(m => ({ ...m, [f.key]: val }));
                      // Keep the default type aligned with the Amount column unless
                      // the user has already chosen a type by hand.
                      if (f.key === 'amount' && !typeTouched) {
                        const t = inferTypeFromColumn(val);
                        if (t) setDefaultType(t);
                      }
                    }}
                    style={sel}
                  >
                    <option value="">— none —</option>
                    {preview.columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Preview" subtitle={`${validCount} of ${preview.rows.length} sample rows look valid`}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>{FIELDS.filter(f => mapping[f.key]).map(f => <th key={f.key}>{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      {FIELDS.filter(f => mapping[f.key]).map(f => (
                        <td key={f.key}>{String(r[mapping[f.key]] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" onClick={commit} disabled={phase === 'committing'} className="touch-target"
                style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--green)', color: '#04140d', fontFamily: 'Geist, sans-serif', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', opacity: phase === 'committing' ? 0.7 : 1 }}>
                {phase === 'committing' ? 'Importing…' : `Import ${preview.row_count} rows`}
              </button>
              <button type="button" onClick={reset} className="touch-target"
                style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontFamily: 'Geist, sans-serif', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                Choose another file
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Result */}
      {phase === 'done' && result && (
        <SectionCard title="Import complete" subtitle="Your dashboards have been updated">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: result.error_count ? 16 : 0 }}>
            <div>
              <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: 'var(--green)' }}>{result.saved_count.toLocaleString()}</div>
              <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>imported</div>
            </div>
            {result.error_count > 0 && (
              <div>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: 'var(--amber)' }}>{result.error_count.toLocaleString()}</div>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>skipped</div>
              </div>
            )}
          </div>
          {result.error_count > 0 && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                Why were {result.error_count} rows skipped?
              </summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-3)', fontSize: '0.78rem', fontFamily: 'Geist, sans-serif' }}>
                {result.errors.slice(0, 12).map((e, i) => (
                  <li key={i}>Row {(e.row ?? e.index ?? 0) + 1}: {e.error}</li>
                ))}
              </ul>
            </details>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/dashboard/timeline" style={{ padding: '10px 20px', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: 10, background: 'var(--cyan)', color: '#04121a', fontFamily: 'Geist, sans-serif', fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none' }}>
              View timeline →
            </a>
            <button type="button" onClick={reset} className="touch-target"
              style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontFamily: 'Geist, sans-serif', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              Import another
            </button>
          </div>
        </SectionCard>
      )}
    </>
  );
}
