'use client';

// AdvisorPanel — the Advisor's content as reusable pieces (audit #9):
//   • RecommendationList — self-fetching engine recommendations. The Today
//     homepage mounts it with limit=3; the Briefs page mounts it in full.
//   • WhatIfPanel — the simulator (runs against a twin copy, never live data).
// Extracted verbatim from app/dashboard/advisor/page.tsx so the explainability
// rendering (what/why/evidence/expected/downside/confidence) stays identical.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Lightbulb, Sparkles, RefreshCw } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import BentoCard from '@/components/ui/BentoCard';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import {
  getRecommendations, simulate, setRecommendationStatus, getAdviceTrackRecord,
  type Recommendation, type SimResult, type AdviceTrackRecord,
} from '@/lib/api';

// The same words and marks as AIBOS's findings (InsightCard), no colour.
const PRIORITY = {
  high:   { label: 'Act now',      icon: <AlertTriangle />, motion: 'pulse' as const },
  medium: { label: 'Worth a look', icon: <Lightbulb />,     motion: 'float' as const },
  low:    { label: 'Good to know', icon: <Sparkles />,      motion: 'tilt' as const },
};

const SCENARIOS = [
  { type: 'price_change', label: 'Change prices', unit: '%', value: 10 },
  { type: 'volume_change', label: 'Change sales volume', unit: '%', value: 10 },
  { type: 'cost_change', label: 'Change total costs', unit: '%', value: -10 },
  { type: 'hire', label: 'Hire staff', unit: '', value: 1 },
];


function RecCard({ r, onFeedback, busy, className }: {
  r: Recommendation;
  onFeedback?: (r: Recommendation, status: 'accepted' | 'dismissed') => void;
  busy?: boolean;
  className?: string;
}) {
  const p = PRIORITY[r.priority] ?? PRIORITY.medium;
  return (
    <BentoCard className={className} icon={p.icon} title={p.label} tag={`${Math.round(r.confidence * 100)}% sure`} motion={p.motion}
      foot={r.rec_id ? (
        r.status === 'accepted' ? <span className="badge" style={{ border: '1px solid var(--border-md)', color: 'var(--text-2)' }}>You did this</span>
        : r.status === 'dismissed' ? <span className="badge" style={{ border: '1px solid var(--border-md)', color: 'var(--text-3)' }}>Not relevant</span>
        : (
          <>
            <button type="button" className="pill pill-primary" disabled={busy} onClick={() => onFeedback?.(r, 'accepted')}>Did this</button>
            <button type="button" className="pill pill-quiet" disabled={busy} onClick={() => onFeedback?.(r, 'dismissed')}>Not relevant</button>
            {(r.times_shown ?? 0) > 1 && r.status === 'open' && (
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Shown {r.times_shown} times</span>
            )}
          </>
        )
      ) : undefined}>
      <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-body)', fontWeight: 600, lineHeight: 1.5, color: 'var(--text-1)' }}>{r.title}</p>
      <p className="bento-text" style={{ marginTop: 4 }}>{r.rationale}</p>

      {r.evidence.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {r.evidence.map((e, i) => (
            <span key={i} style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', border: '1px solid var(--border-md)', padding: '4px 12px', borderRadius: 999 }}>
              {e.label}: <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{e.value}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mini-stats" style={{ marginTop: 12 }}>
        <div className="mini-stat">
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>If it works</span>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>{r.expected_outcome}</span>
        </div>
        <div className="mini-stat">
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>The risk</span>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>{r.downside}</span>
        </div>
      </div>

      {r.alternatives.length > 0 && (
        <p style={{ margin: '12px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
          Or instead: <span style={{ color: 'var(--text-2)' }}>{r.alternatives.join(', ')}</span>
        </p>
      )}
    </BentoCard>
  );
}

export function RecommendationList({ limit, seeAllHref, title = 'What to try', subtitle }: {
  limit?: number;
  seeAllHref?: string;
  title?: string;
  subtitle?: string;
}) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [track, setTrack] = useState<AdviceTrackRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try { setRecs(await getRecommendations()); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
    if (!limit) getAdviceTrackRecord().then(setTrack).catch(() => {});
  }, [limit]);
  useEffect(() => { load(); }, [load]);

  const onFeedback = useCallback(async (r: Recommendation, status: 'accepted' | 'dismissed') => {
    if (!r.rec_id) return;
    setBusyId(r.rec_id);
    try {
      await setRecommendationStatus(r.rec_id, status);
      setRecs(prev => prev.map(x => x.rec_id === r.rec_id ? { ...x, status } : x));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusyId(null); }
  }, []);

  // Homepage placement stays silent while empty — DecisionsQueue rule.
  // Dismissed advice also leaves the homepage; the full list keeps it visible.
  const visible = limit ? recs.filter(r => r.status !== 'dismissed') : recs;
  if (limit && !loading && visible.length === 0 && !err) return null;

  const shown = limit ? visible.slice(0, limit) : visible;

  const spanFor = (i: number, n: number) =>
    n === 1 ? 'span-6' : n === 2 ? 'span-3' : n === 3 ? 'span-2' : i % 3 === 0 ? 'span-6' : 'span-3';

  return (
    <section className="bento-section" aria-labelledby="recs-title" style={limit ? { marginTop: 0, marginBottom: 24 } : { marginTop: 0 }}>
      <header className="bento-section-head">
        <div>
          <p className="eyebrow">AIBOS suggests</p>
          <h2 id="recs-title" className="bento-section-title">{title}</h2>
        </div>
        <div className="bento-section-sub" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span>{subtitle ?? (loading ? 'Reading your numbers…' : `${recs.length} suggestion${recs.length === 1 ? '' : 's'} from your records, each with its evidence.`)}</span>
          {seeAllHref && recs.length > (limit ?? 0)
            ? <Link className="pill pill-quiet" href={seeAllHref}>See all</Link>
            : <button type="button" onClick={load} className="pill pill-quiet"><RefreshCw aria-hidden="true" />Refresh</button>}
        </div>
      </header>
      {err && <div role="alert" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>{err}</div>}
      {loading ? (
        <div className="bento-grid">{[0, 1].map(i => <div key={i} className="skeleton span-3" style={{ height: 220, borderRadius: 'var(--radius-card)' }} />)}</div>
      ) : recs.length === 0 ? (
        <BentoCard icon={<Lightbulb />} title="Nothing to suggest" tag="All good"
          text="Your numbers look healthy, or there is not enough activity yet for AIBOS to suggest anything." />
      ) : (
        <div className="bento-grid">
          {shown.map((r, i) => (
            <RecCard key={r.rec_id ?? i} r={r} onFeedback={onFeedback} busy={busyId === r.rec_id} className={spanFor(i, shown.length)} />
          ))}
        </div>
      )}
      {!limit && track?.available && track.total && track.total.shown > 0 && (
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '16px 0 0' }}>
          AIBOS&apos;s advice record: {track.total.shown} suggestion{track.total.shown === 1 ? '' : 's'} made,
          {' '}{track.total.accepted} taken and {track.total.dismissed} not relevant
          {typeof track.acceptance_rate === 'number' && <>. <strong style={{ color: 'var(--text-1)' }}>{track.acceptance_rate}% taken</strong> of those you decided on</>}
        </p>
      )}
    </section>
  );
}

export function WhatIfPanel() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const [scenario, setScenario] = useState('price_change');
  const [value, setValue] = useState(10);
  const [salary, setSalary] = useState(3000);
  const [count, setCount] = useState(1);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runSim() {
    setSimBusy(true); setSim(null); setErr(null);
    try {
      const payload = scenario === 'hire'
        ? { type: 'hire', count, monthly_salary: salary, months: 12 }
        : { type: scenario, value };
      setSim(await simulate(payload));
    } catch (e) { setErr((e as Error).message); }
    finally { setSimBusy(false); }
  }

  const isHire = scenario === 'hire';
  // Every figure is ink (5 Oct 2026); the sign says which way it moves.
  const METRIC_WORD: Record<string, string> = { profit: 'Profit', revenue: 'Sales', costs: 'Costs', margin: 'Margin' };

  return (
    <SectionCard title="What if" subtitle="Tried on a copy of your books, so nothing real changes.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <select value={scenario} onChange={e => { setScenario(e.target.value); setSim(null); }} className="field">
          {SCENARIOS.map(s => <option key={s.type} value={s.type}>{s.label}</option>)}
        </select>

        {isHire ? (
          <>
            <label style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>How many</label>
            <input type="number" value={count} min={1} onChange={e => setCount(Number(e.target.value))} className="field" />
            <label style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Monthly salary ({sym})</label>
            <input type="number" value={salary} min={0} onChange={e => setSalary(Number(e.target.value))} className="field" />
          </>
        ) : (
          <>
            <label style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Change (%)</label>
            <input type="number" value={value} min={-100} max={500} onChange={e => setValue(Number(e.target.value))} className="field" />
          </>
        )}

        <button type="button" onClick={runSim} disabled={simBusy} className="pill pill-primary" style={{ alignSelf: 'flex-start' }}>
          {simBusy ? 'Working it out…' : 'Show me'}
        </button>

        {err && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{err}</div>}

        {sim && sim.ok && (
          <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', margin: '0 0 12px' }}>{sim.explanation}</p>
            {(['profit', 'revenue', 'costs', 'margin'] as const).map(k => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{METRIC_WORD[k]}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)' }}>
                    {k === 'margin' ? `${sim.projected[k]}%` : `${sym}${fmt(sim.projected[k])}`}
                  </span>
                  <span style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-1)' }}>
                    {sim.deltas[k] > 0 ? '+' : ''}{k === 'margin' ? `${sim.deltas[k]} points` : `${sym}${fmt(sim.deltas[k])}`}
                  </span>
                </span>
              </div>
            ))}
            {sim.assumptions.length > 0 && (
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', fontStyle: 'italic', margin: '10px 0 0' }}>
                {sim.assumptions.join(' ')}
              </p>
            )}
          </div>
        )}
        {sim && !sim.ok && (
          <div style={{ color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{sim.error}</div>
        )}
      </div>
    </SectionCard>
  );
}

/** The full Advisor experience — recommendations beside the simulator. */
export default function AdvisorPanel() {
  return (
    <div className="grid-main">
      <RecommendationList />
      <WhatIfPanel />
    </div>
  );
}
