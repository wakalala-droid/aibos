'use client';
import { useStore, type BenchmarkRow } from '@/lib/store';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import BentoCard, { bentoSpans } from '@/components/ui/BentoCard';
import PageHeader from '@/components/ui/PageHeader';
import { ArrowRight, CircleSlash, CupSoda, Gauge, Layers, Lightbulb, Megaphone, Percent, Sandwich, Star, TrendingUp } from 'lucide-react';
import { benchLine, benchStatus, benchWords, menuGapWords, type GapKind } from '@/lib/opsWords';
import { BAD, INK } from '@/lib/tone';

// How you compare (second bento pass, 5 Oct 2026): every measure is a bento
// card with its plain name, the figure in ink (red only when it is off
// target), a meter with a tick at the mark similar businesses reach, and one
// sentence on where it sits. Menu advice is in plain words, one card each.

const BENCH_ICON: Record<string, JSX.Element> = {
  drink_attach_pct: <CupSoda />,
  side_attach_pct: <Sandwich />,
  top3_sku_concentration: <Star />,
  discount_rate_pct: <Percent />,
  category_mix_primary: <Layers />,
  avg_order_value: <Gauge />,
};

const GAP_LOOK: Record<GapKind, { icon: JSX.Element; tag: string }> = {
  promote: { icon: <Megaphone />, tag: 'Promote' },
  price: { icon: <TrendingUp />, tag: 'Price' },
  remove: { icon: <CircleSlash />, tag: 'Rethink' },
  other: { icon: <Lightbulb />, tag: 'Idea' },
};

function BenchmarkCard({ b, className }: { b: BenchmarkRow; className: string }) {
  const w = benchWords(b.metric, b.label);
  const st = benchStatus(b.status);
  const unit = b.unit === 'K' ? '' : b.unit;
  // The meter runs to a little past whichever is larger, the figure or the mark.
  const top = Math.max(b.actual, b.benchmark, 1) * 1.2;
  const fill = Math.min((Math.max(b.actual, 0) / top) * 100, 100);
  const mark = Math.min((b.benchmark / top) * 100, 100);
  return (
    <BentoCard className={className} icon={BENCH_ICON[b.metric] ?? <Gauge />} title={w.name} motion="pulse"
      tag={<span style={st.bad ? { color: BAD } : undefined}>{st.word}</span>}
    >
      <p className="bento-figure" style={{ color: st.bad ? BAD : INK }}>{b.actual}{unit}</p>
      <div className="meter" style={{ marginTop: 16 }} role="img"
        aria-label={`${b.actual}${unit} against a mark of ${b.benchmark}${unit}`}>
        <div className={`meter-fill${st.bad ? ' bad' : ''}`} style={{ width: `${fill}%` }} />
        <div className="meter-mark" style={{ left: `${mark}%` }} />
      </div>
      <p className="bento-note" style={{ marginTop: 12 }}>{benchLine(b.actual, b.benchmark, b.unit, w.higherBetter)}</p>
      {w.why && <p className="bento-note" style={{ marginTop: 4 }}>{w.why}</p>}
    </BentoCard>
  );
}

function AttachMeter({ label, value, benchmark }: { label: string; value: number; benchmark: number }) {
  const short = value < benchmark;
  const top = Math.max(value, benchmark, 1) * 1.15;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>{label}</span>
        <span className="tnum" style={{ fontSize: 'var(--fs-body)' }}>
          <strong style={{ color: short ? BAD : INK, fontWeight: 600 }}>{value.toFixed(1)}%</strong>
          <span style={{ color: 'var(--text-3)' }}> of meals, against {benchmark}%</span>
        </span>
      </div>
      <div className="meter" role="img" aria-label={`${value.toFixed(1)}% against ${benchmark}%`}>
        <div className={`meter-fill${short ? ' bad' : ''}`} style={{ width: `${Math.min((value / top) * 100, 100)}%` }} />
        <div className="meter-mark" style={{ left: `${(benchmark / top) * 100}%` }} />
      </div>
      <p className="bento-note" style={{ marginTop: 8 }}>
        {short ? `${(benchmark - value).toFixed(1)} points short of similar food businesses.` : `${(value - benchmark).toFixed(1)} points ahead of similar food businesses.`}
      </p>
    </div>
  );
}

export default function BenchmarksPage() {
  const { benchmarks, attachRates, menuGaps, posBusinessName, posPeriod } = useStore();
  const goodCount  = benchmarks.filter(b => b.status === 'good').length;
  const warnCount  = benchmarks.filter(b => b.status === 'warn').length;
  const alertCount = benchmarks.filter(b => b.status === 'alert').length;
  const drinkAttach = attachRates?.drink_attach_pct ?? 0;
  const sideAttach  = attachRates?.side_attach_pct  ?? 0;
  const spans = bentoSpans(benchmarks.length);
  const gaps = menuGaps.map((g) => ({ ...g, words: menuGapWords(g.issue, g.opportunity) }));
  const gapSpans = gaps.map((_, i) => (gaps.length % 2 === 1 && i === gaps.length - 1 ? 'span-6' : 'span-3'));

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="How you compare"
        subtitle={<>{[posBusinessName, posPeriod].filter(Boolean).join(' · ') || 'Your till figures against similar businesses'}</>}
      />

      {/* KPI summary strip */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <KPICard label="On target" value={String(goodCount)} sub="measures where you are fine" />
        <KPICard label="Off target" value={String(warnCount)} sub="measures to look at" />
        <KPICard label="Far off" value={String(alertCount)} sub="measures to fix first" />
      </div>

      {/* The measures */}
      {benchmarks.length > 0 ? (
        <div className="bento-section" style={{ marginTop: 0 }}>
          <header className="bento-section-head">
            <div>
              <p className="eyebrow">Against similar businesses</p>
              <h2 className="bento-section-title">Your measures</h2>
            </div>
            <p className="bento-section-sub">The tick on each bar is the mark similar businesses reach.</p>
          </header>
          <div className="bento-grid">
            {benchmarks.map((b, i) => <BenchmarkCard key={b.metric} b={b} className={spans[i] ?? 'span-3'} />)}
          </div>
        </div>
      ) : (
        <SectionCard delay={0.1} style={{ position: 'relative', minHeight: 160, textAlign: 'center' }}>
          <LockOverlay colour="var(--e3)" title="Needs your till data" description="Upload the sales report from your till (POS) to compare yourself with similar businesses." />
        </SectionCard>
      )}

      {/* Sold together */}
      <div style={{ marginTop: 40 }}>
        <SectionCard title="Sold together" subtitle="How often a meal goes out with a drink or a side, against similar food businesses" delay={0.22} style={{ marginBottom: 20 }}>
          <AttachMeter label="Sold with a drink" value={drinkAttach} benchmark={80} />
          <AttachMeter label="Sold with a side" value={sideAttach} benchmark={30} />
          {drinkAttach < 80 && (
            <div className="row" style={{ alignItems: 'flex-start', background: 'var(--pill-bg)', margin: 0 }}>
              <span className="bento-icon" aria-hidden="true"><Lightbulb /></span>
              <p className="bento-note" style={{ flex: 1 }}>
                <strong>{drinkAttach.toFixed(0)} in every 100 meals</strong> go out with a drink. Similar food businesses manage 80. Ask &ldquo;Anything to drink?&rdquo; with every order.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Menu advice */}
      {gaps.length > 0 && (
        <div className="bento-section">
          <header className="bento-section-head">
            <div>
              <p className="eyebrow">Menu</p>
              <h2 className="bento-section-title">Ways to improve your menu</h2>
            </div>
            <p className="bento-section-sub">What to put in front of customers, and what to price differently.</p>
          </header>
          <div className="bento-grid">
            {gaps.map((g, i) => {
              const look = GAP_LOOK[g.words.kind];
              return (
                <BentoCard key={`${g.sku}-${i}`} className={gapSpans[i]} icon={look.icon} title={g.name} tag={look.tag}
                  motion={g.words.kind === 'price' ? 'pulse' : 'float'}
                  text={<>{g.words.issue}{g.category ? <span style={{ color: 'var(--text-4)' }}> {g.category}{g.sku ? `, code ${g.sku}` : ''}.</span> : null}</>}
                  foot={
                    <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--fs-body)', color: 'var(--text-1)', lineHeight: 1.6 }}>
                      <ArrowRight size={20} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 4 }} aria-hidden="true" />
                      {g.words.action}
                    </span>
                  }
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
