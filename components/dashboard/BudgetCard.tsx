'use client';

// BudgetCard — actuals vs the owner's plan (audit #37). Set a monthly target
// for revenue, costs and profit; AIBOS shows where you are against intent, not
// just last month. Actuals are derived from recorded data (never invented).
// Silent gracefully before migration 0024 exists (fetch just fails quietly).

import { useCallback, useEffect, useState } from 'react';
import { getBudgets, setBudget, type BudgetReport, type BudgetMetric } from '@/lib/api';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import SectionCard from '@/components/ui/SectionCard';

const METRICS: { key: BudgetMetric; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'costs', label: 'Costs' },
  { key: 'profit', label: 'Profit' },
];

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function BudgetCard() {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const [month] = useState(thisMonth());
  const [report, setReport] = useState<BudgetReport | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<BudgetMetric, string>>({ revenue: '', costs: '', profit: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getBudgets(month);
      setReport(r);
      const d = { revenue: '', costs: '', profit: '' } as Record<BudgetMetric, string>;
      for (const l of r.lines) d[l.metric] = String(l.target);
      setDraft(d);
    } catch { /* pre-migration / offline — stay silent */ }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true); setErr(null);
    try {
      for (const m of METRICS) {
        const v = Number(draft[m.key]);
        if (draft[m.key] !== '' && !isNaN(v) && v >= 0) await setBudget(month, m.key, v);
      }
      setEditing(false);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const monthLabel = new Date(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const hasBudget = (report?.lines.length ?? 0) > 0;

  const input: React.CSSProperties = { width: '100%', minHeight: 38, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 'var(--fs-body)' };
  const btn: React.CSSProperties = { minHeight: 36, padding: '7px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-data)' };

  return (
    <SectionCard
      title="Budget vs actual"
      subtitle={`Your plan for ${monthLabel}, measured against what you've recorded`}
      style={{ marginBottom: 20 }}
      action={
        !editing ? (
          <button type="button" onClick={() => setEditing(true)} style={{ ...btn, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)' }}>
            {hasBudget ? 'Edit targets' : 'Set targets'}
          </button>
        ) : undefined
      }
    >
      {err && <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-label)', margin: '0 0 12px' }}>{err}</p>}

      {editing ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {METRICS.map((m) => (
            <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 10 }}>
              <label htmlFor={`b-${m.key}`} style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', fontWeight: 600 }}>{m.label} target</label>
              <input id={`b-${m.key}`} type="number" min={0} inputMode="decimal" style={input}
                value={draft[m.key]} onChange={(e) => setDraft((d) => ({ ...d, [m.key]: e.target.value }))} placeholder="0" />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => void save()} disabled={busy} style={{ ...btn, border: 'none', background: 'var(--cyan)', color: '#04121a' }}>{busy ? 'Saving…' : 'Save plan'}</button>
            <button type="button" onClick={() => { setEditing(false); void load(); }} style={{ ...btn, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)' }}>Cancel</button>
          </div>
        </div>
      ) : !hasBudget ? (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
          Set a target for this month and AIBOS will track you against it — not just against last month.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {report!.lines.map((l) => {
            const pct = l.pct_of_target ?? 0;
            const barPct = Math.max(0, Math.min(pct, 100));
            const colour = l.on_track ? 'var(--good)' : 'var(--crit)';
            return (
              <div key={l.metric}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', textTransform: 'capitalize' }}>{l.metric}</span>
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(l.actual, false, sym)} <span style={{ color: 'var(--text-4)' }}>/ {fmt(l.target, false, sym)}</span>
                    {l.pct_of_target !== null && <span style={{ color: colour, fontWeight: 600, marginLeft: 8 }}>{l.pct_of_target.toFixed(0)}%</span>}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-badge)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 4, background: colour, transition: 'width .4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
