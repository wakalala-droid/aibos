'use client';

// Try a decision on the 13-week plan before making it (Growth, 16 Oct 2026).
// The decision runs on the SAME simulated futures as the plan (aibos-api
// cash_plan.py, common random numbers), so what changes is the decision and
// not chance: a K18,000 freezer moves the money at the end by exactly K18,000,
// and the chance of running short by what the freezer really does to it.

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import Panel from '@/components/home/Panel';
import { Note } from '@/components/hospitality/kit';
import { decideCashPlan, type CashPlan, type PlanDecision } from '@/lib/api';
import { fmt } from '@/lib/utils';
import { trendTone } from '@/lib/tone';

type Kind = 'buy' | 'income' | 'hire' | 'regular' | 'sales' | 'spend' | 'faster';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'buy', label: 'A purchase' },
  { value: 'hire', label: 'A hire' },
  { value: 'regular', label: 'A new monthly bill' },
  { value: 'income', label: 'Money coming in' },
  { value: 'sales', label: 'Sales change' },
  { value: 'spend', label: 'Spending change' },
  { value: 'faster', label: 'Get paid sooner' },
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function DecisionPanel({ floor, sym, onResult }: {
  floor: number;
  sym: string;
  /** The plan with the decision tried, or null when it is cleared. */
  onResult: (plan: CashPlan | null) => void;
}) {
  const [kind, setKind] = useState<Kind>('buy');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [count, setCount] = useState('1');
  const [pct, setPct] = useState('10');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CashPlan | null>(null);

  const decision = (): PlanDecision | null => {
    const n = Number(amount);
    switch (kind) {
      case 'buy': return n > 0 ? { type: 'one_off', direction: 'out', amount: n, date, label: label || undefined } : null;
      case 'income': return n > 0 ? { type: 'one_off', direction: 'in', amount: n, date, label: label || undefined } : null;
      case 'regular': return n > 0 ? { type: 'recurring', direction: 'out', amount: n, every: 'month', start: date, label: label || undefined } : null;
      case 'hire': return n > 0 ? { type: 'hire', count: Math.max(1, Math.round(Number(count) || 1)), monthly_salary: n, start: date } : null;
      case 'sales': return { type: 'sales_change', pct: Number(pct) || 0, start: date };
      case 'spend': return { type: 'cost_change', pct: Number(pct) || 0, start: date };
      case 'faster': return { type: 'collect_faster', days: Math.max(1, Math.round(Number(days) || 7)) };
    }
  };

  const tryIt = async () => {
    const d = decision();
    if (!d) { setError('Say how much, above zero.'); return; }
    setBusy(true);
    setError(null);
    try {
      const plan = await decideCashPlan([d], floor);
      setResult(plan);
      onResult(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That could not be worked out just now.');
    } finally {
      setBusy(false);
    }
  };

  const clear = () => { setResult(null); onResult(null); setError(null); };

  const s = result?.scenario;
  const needsAmount = kind === 'buy' || kind === 'income' || kind === 'regular' || kind === 'hire';
  const needsPct = kind === 'sales' || kind === 'spend';

  return (
    <Panel title="Try a decision on the plan" action={<span className="bento-icon" aria-hidden="true" style={{ width: 44, height: 44 }}><FlaskConical /></span>}>
      <p className="rs-text is-quiet" style={{ marginBottom: 16 }}>
        Before you buy, hire or change prices: see what it does to the next 13 weeks. Nothing is recorded.
      </p>
      <div className="chips" role="group" aria-label="What to try">
        {KINDS.map((k) => (
          <button key={k.value} type="button" className="chip" aria-pressed={kind === k.value}
            onClick={() => { setKind(k.value); clear(); }}>
            {k.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16, marginTop: 20 }}>
        {(kind === 'buy' || kind === 'income' || kind === 'regular') && (
          <Field id="dp-label" label={kind === 'income' ? 'From' : 'What for'}>
            <input id="dp-label" className="field" value={label} maxLength={60}
              placeholder={kind === 'buy' ? 'A new freezer' : kind === 'income' ? 'A loan, a big order' : 'A second shop’s rent'}
              onChange={(e) => setLabel(e.target.value)} />
          </Field>
        )}
        {kind === 'hire' && (
          <Field id="dp-count" label="How many people">
            <input id="dp-count" className="field" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
        )}
        {needsAmount && (
          <Field id="dp-amount" label={kind === 'hire' ? `Monthly salary each (${sym})` : `How much (${sym})`}>
            <input id="dp-amount" className="field" inputMode="decimal" value={amount} placeholder="0"
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </Field>
        )}
        {needsPct && (
          <Field id="dp-pct" label="By how much (%)">
            <input id="dp-pct" className="field" inputMode="decimal" value={pct}
              onChange={(e) => setPct(e.target.value.replace(/[^0-9.-]/g, ''))} />
          </Field>
        )}
        {kind === 'faster' ? (
          <Field id="dp-days" label="How many days sooner">
            <input id="dp-days" className="field" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        ) : (
          <Field id="dp-date" label={kind === 'buy' || kind === 'income' ? 'On' : 'From'}>
            <input id="dp-date" type="date" className="field" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
      </div>
      {kind === 'hire' && (
        <p className="rs-text is-quiet" style={{ marginTop: 12 }}>
          Take-home pay on the 28th, and PAYE, NAPSA and NHIMA by the 10th after, worked out the way payroll works them out.
        </p>
      )}

      <div className="rs-btns" style={{ marginTop: 20 }}>
        <button type="button" className="pill pill-primary" onClick={tryIt} disabled={busy}>
          {busy ? 'Working it out…' : 'Try it on the plan'}
        </button>
        {result && <button type="button" className="pill pill-quiet" onClick={clear}>Clear</button>}
      </div>

      {error && <Note tone="bad">{error}</Note>}
      {s && result && (
        <div style={{ marginTop: 20 }}>
          <p className="rs-text is-strong">{s.words.join('. ')}.</p>
          <div className="mini-stats" style={{ marginTop: 12 }}>
            <div className="mini-stat">
              <span className="quiet-label">Chance of running short</span>
              <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: trendTone(s.change.chance_short_pct, false) }}>
                {result.chance_short_pct}% to {s.plan.chance_short_pct}%
              </span>
            </div>
            <div className="mini-stat">
              <span className="quiet-label">Money at the end, likely</span>
              <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: trendTone(s.change.close_p50) }}>
                {s.change.close_p50 >= 0 ? '+' : ''}{fmt(s.change.close_p50, true, sym)}
              </span>
            </div>
            <div className="mini-stat">
              <span className="quiet-label">Lowest point, cautious</span>
              <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: trendTone(s.change.lowest_p10) }}>
                {fmt(s.plan.lowest.p10, true, sym)}
              </span>
            </div>
          </div>
          <Note tone={s.plan.chance_short_pct >= 20 ? 'warn' : 'good'}>{s.plan.headline}</Note>
        </div>
      )}
    </Panel>
  );
}
