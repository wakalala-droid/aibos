'use client';
/**
 * AI-BOS — Advisor (Evolution Initiatives 9, 10, 12).
 * Surfaces engine recommendations — each one self-explaining (what / why / evidence
 * / expected / downside / confidence / alternatives, Bible 9th Law) — and a what-if
 * simulator that runs against a copy of the Digital Twin (never production).
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { getRecommendations, simulate, type Recommendation, type SimResult } from '@/lib/api';

const PRIORITY = {
  high: { fg: 'var(--red)', bg: 'var(--red-dim)', label: 'High' },
  medium: { fg: 'var(--amber)', bg: 'rgba(251,191,36,0.12)', label: 'Medium' },
  low: { fg: 'var(--text-3)', bg: 'var(--bg-badge)', label: 'Low' },
};

const SCENARIOS = [
  { type: 'price_change', label: 'Change prices', unit: '%', value: 10 },
  { type: 'volume_change', label: 'Change sales volume', unit: '%', value: 10 },
  { type: 'cost_change', label: 'Change total costs', unit: '%', value: -10 },
  { type: 'hire', label: 'Hire staff', unit: '', value: 1 },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', outline: 'none',
};

function RecCard({ r }: { r: Recommendation }) {
  const p = PRIORITY[r.priority] ?? PRIORITY.medium;
  return (
    <div style={{ padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-1)' }}>{r.title}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <span className="badge" style={{ background: p.bg, color: p.fg }}>{p.label}</span>
          <span className="badge" style={{ background: 'var(--bg-badge)', color: 'var(--text-3)' }}>{Math.round(r.confidence * 100)}%</span>
        </span>
      </div>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 10px' }}>{r.rationale}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {r.evidence.map((e, i) => (
          <span key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--text-3)', background: 'var(--bg-badge)', padding: '4px 8px', borderRadius: 6 }}>
            {e.label}: <span style={{ color: 'var(--text-1)' }}>{e.value}</span>
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: r.alternatives.length ? 10 : 0 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Expected</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--green)' }}>{r.expected_outcome}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Downside</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--text-3)' }}>{r.downside}</div>
        </div>
      </div>

      {r.alternatives.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alternatives: </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--text-3)' }}>{r.alternatives.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}

export default function AdvisorPage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // What-if state
  const [scenario, setScenario] = useState('price_change');
  const [value, setValue] = useState(10);
  const [salary, setSalary] = useState(3000);
  const [count, setCount] = useState(1);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try { setRecs(await getRecommendations()); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runSim() {
    setSimBusy(true); setSim(null);
    try {
      const payload = scenario === 'hire'
        ? { type: 'hire', count, monthly_salary: salary, months: 12 }
        : { type: scenario, value };
      setSim(await simulate(payload));
    } catch (e) { setErr((e as Error).message); }
    finally { setSimBusy(false); }
  }

  const isHire = scenario === 'hire';
  const deltaColor = (n: number) => (n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--text-2)');

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>Advisor</h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>
          Recommendations from your live data — and a sandbox to test decisions.
        </p>
      </div>

      <div className="grid-main">
        {/* Recommendations */}
        <SectionCard title="Recommendations" subtitle={loading ? 'Analysing…' : `${recs.length} from your Digital Twin`}
          action={<button type="button" onClick={load} className="touch-target" style={{ padding: '6px 12px', minHeight: 32, borderRadius: 6, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Refresh</button>}>
          {err && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.8rem' }}>{err}</div>}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div>
          ) : recs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
              No recommendations right now — your numbers look healthy, or there isn&apos;t enough activity yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{recs.map((r, i) => <RecCard key={i} r={r} />)}</div>
          )}
        </SectionCard>

        {/* What-if */}
        <SectionCard title="What if…" subtitle="Runs against a copy — your data is untouched">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <select value={scenario} onChange={e => { setScenario(e.target.value); setSim(null); }} style={inputStyle}>
              {SCENARIOS.map(s => <option key={s.type} value={s.type}>{s.label}</option>)}
            </select>

            {isHire ? (
              <>
                <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>How many</label>
                <input type="number" value={count} min={1} onChange={e => setCount(Number(e.target.value))} style={inputStyle} />
                <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>Monthly salary ({sym})</label>
                <input type="number" value={salary} min={0} onChange={e => setSalary(Number(e.target.value))} style={inputStyle} />
              </>
            ) : (
              <>
                <label style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>Change (%)</label>
                <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} style={inputStyle} />
              </>
            )}

            <button type="button" onClick={runSim} disabled={simBusy} className="touch-target"
              style={{ padding: '10px 18px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#04121a', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: simBusy ? 0.7 : 1 }}>
              {simBusy ? 'Running…' : 'Simulate'}
            </button>

            {sim && sim.ok && (
              <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-2)', margin: '0 0 12px' }}>{sim.explanation}</p>
                {(['profit', 'revenue', 'costs', 'margin'] as const).map(k => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>{k}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                        {k === 'margin' ? `${sim.projected[k]}%` : `${sym}${fmt(sim.projected[k])}`}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', fontWeight: 600, color: deltaColor(sim.deltas[k]) }}>
                        {sim.deltas[k] > 0 ? '+' : ''}{k === 'margin' ? `${sim.deltas[k]}pp` : `${sym}${fmt(sim.deltas[k])}`}
                      </span>
                    </span>
                  </div>
                ))}
                {sim.assumptions.length > 0 && (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--text-4)', fontStyle: 'italic', margin: '10px 0 0' }}>
                    {sim.assumptions.join(' ')}
                  </p>
                )}
              </div>
            )}
            {sim && !sim.ok && (
              <div style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{sim.error}</div>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
