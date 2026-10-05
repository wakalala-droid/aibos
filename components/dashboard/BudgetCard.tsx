'use client';

// BudgetCard — actuals vs the owner's plan (audit #37). Set a monthly target
// for revenue, costs and profit; AIBOS shows where you are against intent, not
// just last month. Actuals are derived from recorded data (never invented).
// Silent gracefully before migration 0024 exists (fetch just fails quietly).

import { useCallback, useEffect, useState } from 'react';
import { getBudgets, setBudget, type BudgetReport, type BudgetMetric } from '@/lib/api';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/utils';
import { Target } from 'lucide-react';
import BentoCard from '@/components/ui/BentoCard';
import { BAD, INK } from '@/lib/tone';

const METRICS: { key: BudgetMetric; label: string }[] = [
  { key: 'revenue', label: 'Sales' },
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

  // A bento card (second bento pass, 5 Oct 2026): figures in ink, the bar in
  // the brand line, and red only for a line that is off its plan.
  return (
    <div className="bento-grid" style={{ marginBottom: 20 }}>
    <BentoCard
      className="span-6"
      icon={<Target />}
      title="Plan against actual"
      tag={monthLabel}
      motion="pulse"
      text={`Your plan for ${monthLabel}, measured against what you have recorded.`}
      foot={!editing ? (
        <button type="button" className="pill pill-quiet" onClick={() => setEditing(true)}>
          {hasBudget ? 'Change the plan' : 'Set a plan'}
        </button>
      ) : undefined}
    >
      {err && <p role="alert" className="bento-note" style={{ color: 'var(--red)', marginTop: 12 }}>{err}</p>}

      {editing ? (
        <div style={{ display: 'grid', gap: 16, marginTop: 16, maxWidth: 520 }}>
          {METRICS.map((m) => (
            <div key={m.key}>
              <label htmlFor={`b-${m.key}`} className="field-label">{m.label} this month</label>
              <input id={`b-${m.key}`} className="field" type="number" min={0} inputMode="decimal"
                value={draft[m.key]} onChange={(e) => setDraft((d) => ({ ...d, [m.key]: e.target.value }))} placeholder="0" />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="pill pill-primary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save plan'}</button>
            <button type="button" className="pill pill-quiet" onClick={() => { setEditing(false); void load(); }}>Cancel</button>
          </div>
        </div>
      ) : !hasBudget ? (
        <p className="bento-note" style={{ marginTop: 12 }}>
          Set what you plan to sell, spend and keep this month, and AIBOS tracks you against it, not just against last month.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 20, marginTop: 20 }}>
          {report!.lines.map((l) => {
            const pct = l.pct_of_target ?? 0;
            const barPct = Math.max(0, Math.min(pct, 100));
            const off = !l.on_track;
            const word = METRICS.find((m) => m.key === l.metric)?.label ?? l.metric;
            return (
              <div key={l.metric}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>{word}</span>
                  <span className="tnum" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>
                    {fmt(l.actual, false, sym)} <span style={{ color: 'var(--text-3)' }}>of {fmt(l.target, false, sym)}</span>
                    {l.pct_of_target !== null && <strong style={{ color: off ? BAD : INK, fontWeight: 600, marginLeft: 10 }}>{l.pct_of_target.toFixed(0)}%</strong>}
                  </span>
                </div>
                <div className="meter" style={{ height: 8 }}>
                  <div className={`meter-fill${off ? ' bad' : ''}`} style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BentoCard>
    </div>
  );
}
