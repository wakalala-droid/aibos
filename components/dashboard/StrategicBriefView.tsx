'use client';

// StrategicBriefView — the genuine Strategic Brief page body, extracted so BOTH
// the in-app /dashboard/brief route and the marketing site render the exact same
// component. Takes raw data as props (no store), derives recommendations the
// same way the product does — so nothing is fabricated.
import { fmt, scoreColor } from '@/lib/utils';
import { monthChange, monthName, enoughHistory, MIN_MONTHS } from '@/lib/change';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import BentoCard from '@/components/ui/BentoCard';
import { AlertTriangle, Lightbulb, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { KpiShape, HealthShape, MonthlyRow, AlertRow, IntelligenceScoresShape } from '@/lib/store';

function BriefPoint({ text, index, colour }: { text: string; index: number; colour?: string }) {
  const content = text.replace(/^\d+\.\s*/, '').trim();
  void colour;
  return (
    <motion.div
      initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + index * 0.08 }}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 0', borderTop: index > 0 ? '1px solid var(--border)' : 'none' }}
    >
      <span className="avatar" aria-hidden="true" style={{ width: 32, height: 32 }}>
        {index + 1}
      </span>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{content}</p>
    </motion.div>
  );
}

function RecommendationCard({ title, recommendation, priority, className }: { title: string; recommendation: string; priority: string; index: number; className?: string }) {
  const urgent = priority === 'high' || priority === 'critical';
  return (
    <BentoCard className={className} icon={urgent ? <AlertTriangle /> : priority === 'medium' ? <Lightbulb /> : <Sparkles />}
      title={urgent ? 'Act now' : priority === 'medium' ? 'Worth a look' : 'Good to know'} tag="Money" motion={urgent ? 'pulse' : 'float'}>
      <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-body)', fontWeight: 600, lineHeight: 1.5, color: 'var(--text-1)' }}>{title}</p>
      <p className="bento-text" style={{ marginTop: 4 }}>{recommendation}</p>
    </BentoCard>
  );
}

export interface StrategicBriefViewProps {
  kpi: KpiShape;
  health: HealthShape;
  monthly: MonthlyRow[];
  alerts: AlertRow[];
  scores: IntelligenceScoresShape | null;
  unifiedBrief?: string;
  sym?: string;
  /** Marketing render: hide the page header (the section supplies its own). */
  hideHeader?: boolean;
  /** 2 when embedded in a page that already has its own h1 (one h1 per page). */
  headingLevel?: 1 | 2;
}

export default function StrategicBriefView({
  kpi, health, monthly, alerts, scores, unifiedBrief = '', sym = 'K', hideHeader = false, headingLevel = 1,
}: StrategicBriefViewProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h1';
  // ── Derived recommendations (identical logic to the product) ──────────────
  const recs: Array<{ title: string; recommendation: string; priority: string }> = [];
  if (kpi.avgMargin < 20) {
    recs.push({ title: 'Your margin is low', recommendation: `You keep ${kpi.avgMargin.toFixed(1)}% of each sale, under the 20% a healthy business keeps. Look at your prices and your biggest costs.`, priority: 'high' });
  }
  if (alerts.filter((a) => a.severity === 'warning' || a.severity === 'critical').length > 0) {
    recs.push({ title: 'Some costs jumped', recommendation: `${alerts.length} cost${alerts.length > 1 ? 's' : ''} moved more than usual from one month to the next. Check what changed.`, priority: 'medium' });
  }
  if (kpi.totalProfit > 0) {
    recs.push({ title: 'Put your profit to work', recommendation: `You made ${fmt(kpi.totalProfit, true, sym)} profit. That is room to win new customers or stock up on what sells.`, priority: 'low' });
  }
  // Only judge an engine that was actually measured. Firing "Customer Retention
  // at Risk — score is 0/100" at an owner who has never uploaded customer data
  // is a finding about nothing, and it is the kind of thing that costs trust in
  // every other number on the page.
  if (scores && (scores.measured?.e2 ?? true) && scores.e2_score < 70) {
    recs.push({ title: 'Customers are drifting away', recommendation: `Your customers score ${scores.e2_score} out of 100. Win back the ones who have gone quiet.`, priority: 'medium' });
  }
  if (scores && (scores.measured?.e3 ?? true) && scores.e3_score < 70) {
    recs.push({ title: 'Your till is below target', recommendation: `Your till scores ${scores.e3_score} out of 100. Sell more drinks with meals and push your main lines.`, priority: 'medium' });
  }
  if (recs.length === 0) {
    recs.push(
      { title: 'Keep costs in check', recommendation: 'Look at costs against sales once a month so you keep more than a quarter of every sale.', priority: 'low' },
      { title: 'Get to know your customers', recommendation: "Add customers' names to your sales and AIBOS shows who buys most, what each is worth and who has gone quiet.", priority: 'medium' },
      { title: 'Read your till', recommendation: "Upload your till's sales report and AIBOS compares you with businesses like yours and shows where sales are slipping.", priority: 'medium' },
    );
  }

  const briefLines = (unifiedBrief || '').split('\n').filter((l) => l.trim() && /^\d+\./.test(l.trim()));
  // A score from one or two months is noise (it read 100 "Excellent" on two
  // months), so it waits until there are enough months to mean something.
  const scoreReady = enoughHistory(health.monthsCounted ?? monthly.length);
  const healthColour = scoreReady ? 'var(--chart-line)' : 'var(--text-4)';
  void scoreColor;

  // Real month-on-month change, or nothing. These two cards carried the fixed
  // numbers +8.4% and +12.1% from a demo, so every customer was shown growth,
  // including one with a single month of records and nothing to compare.
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  // Below a sensible base the change is given in money, not a percentage
  // (lib/change: "1423.5%" from a tiny first month read as broken).
  const revenueChange = last && prev ? monthChange(Number(last.Revenue) || 0, Number(prev.Revenue) || 0, monthly.length) : undefined;
  const profitChange = last && prev
    ? monthChange((Number(last.Revenue) || 0) - (Number(last.Costs) || 0), (Number(prev.Revenue) || 0) - (Number(prev.Costs) || 0), monthly.length)
    : undefined;
  const periodLabel = monthly.length === 1 ? '1 month recorded' : `${monthly.length} months`;
  const months = Math.max(monthly.length, 1);

  // ── Best and worst month, as facts rather than decoration ────────────────
  // monthsCounted / bestProfit / worstProfit come from the store, which works
  // them out from the same rows the rest of the page uses. Falling back to the
  // rows here keeps this honest for any caller that passes a bare health object
  // (the marketing render does).
  const monthCount = health.monthsCounted ?? monthly.length;
  const profitOf = (m: MonthlyRow) => (Number(m.Revenue) || 0) - (Number(m.Costs) || 0);
  const profits = monthly.map(profitOf);
  const bestProfit = health.bestProfit ?? (profits.length ? Math.max(...profits) : 0);
  const worstProfit = health.worstProfit ?? (profits.length ? Math.min(...profits) : 0);

  // Colour carries meaning in this system, so a loss is never green — not even
  // when it is the least bad month of the ones recorded.
  // One ink for every figure (5 Oct 2026): "loss" and "profit" are said in words.
  const profitColour = (_v: number) => 'var(--text-1)';
  // Bars in proportion to the figures they represent, against whichever month
  // is largest either way. A hardcoded width is a picture of nothing.
  const barScale = Math.max(Math.abs(bestProfit), Math.abs(worstProfit), 1);
  const barWidth = (v: number) => `${Math.round((Math.abs(v) / barScale) * 100)}%`;

  return (
    <>
      {!hideHeader && (
        <div style={{ marginBottom: 24 }}>
          <p className="eyebrow">Money</p>
          <Heading className="bento-section-title">Money brief</Heading>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '8px 0 0' }}>How the money is doing, what it means and what to do next.</p>
        </div>
      )}

      {/* KPI summary cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="Health score" value={scoreReady ? String(health.score) : 'Not yet'} sub={scoreReady ? health.label : `Needs ${MIN_MONTHS} months of records`}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={healthColour} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          iconBg={`color-mix(in srgb, ${healthColour} 15%, transparent)`} sparkColor={healthColour} delay={0} />
        <KPICard label="Sales" value={fmt(kpi.totalRevenue, true, sym)} sub={monthly.length > 1 && prev ? `${periodLabel}, change vs ${monthName(prev.Month)}` : monthly.length ? periodLabel : 'no months yet'} change={revenueChange}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 7 22 7 22 13" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkData={monthly.slice(-6).map((m) => Number(m.Revenue) || 0)} sparkColor="var(--good)" delay={0.06} />
        <KPICard label="Profit" value={fmt(kpi.totalProfit, true, sym)} sub={`${kpi.avgMargin.toFixed(1)}% average margin`} change={profitChange}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--cyan)" strokeWidth="1.5" fill="none" /><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9" stroke="var(--cyan)" strokeWidth="1.4" strokeLinecap="round" /></svg>}
          iconBg="rgba(0,212,255,0.12)" sparkData={monthly.slice(-6).map((m) => (Number(m.Revenue) || 0) - (Number(m.Costs) || 0))} sparkColor="var(--cyan)" delay={0.12} />
        <KPICard label="Things to do" value={String(recs.length)} sub="from what AIBOS read"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="var(--purple)" strokeWidth="1.5" fill="none" strokeLinejoin="round" /><path d="M8 9h8M8 13h5M8 17h6" stroke="var(--purple)" strokeWidth="1.3" strokeLinecap="round" /></svg>}
          iconBg="rgba(167,139,250,0.15)" sparkColor="var(--purple)" delay={0.18} />
      </div>

      {/* Financial Health */}
      <SectionCard title="How healthy the money is" subtitle="The score, and your best and worst month" style={{ marginBottom: 16 }}>
        <div className="brief-health" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 28, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 130, height: 130 }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
              <motion.circle cx="65" cy="65" r="52" fill="none" stroke={healthColour} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={2 * Math.PI * 52} initial={false}
                animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - (scoreReady ? health.score : 0) / 100) }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }} style={{ transform: 'rotate(-90deg)', transformOrigin: '65px 65px' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: scoreReady ? 'var(--fs-h1)' : 'var(--fs-h3)', fontWeight: 600, color: healthColour, lineHeight: 1 }}>{scoreReady ? health.score : 'Not yet'}</span>
              {scoreReady && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', marginTop: 3 }}>{health.label}</span>}
              {scoreReady && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', marginTop: 1 }}>/100</span>}
            </div>
          </div>
          <div>
            {/* Best and worst month.
                These two rows used to draw a full-width GREEN bar for the best
                month and a 65%-wide amber bar for the worst, both hardcoded.
                They were decoration wearing the clothes of measurement: a month
                that LOST K8,041 was drawn as a full green bar labelled "best",
                because the code assumed the best month made money. With a
                single month of data it also printed the same figure twice, once
                as the best and once as the worst, which reads as a broken card.
                Colour carries meaning here, so a loss is never green, the bars
                are proportional to the actual figures and one month says it is
                one month. */}
            {monthCount === 0 ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
                No monthly figures yet. Record a few sales and expenses and your best
                and worst months appear here.
              </p>
            ) : monthCount === 1 ? (
              <div>
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '0 0 5px' }}>
                  Only month so far
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{monthName(health.bestMonth)}</span>
                  <span style={{ fontSize: 'var(--fs-label)', color: profitColour(bestProfit) }}>
                    {fmt(bestProfit, false, sym)} {bestProfit < 0 ? 'loss' : 'profit'}
                  </span>
                </div>
                <div className="progress-track">
                  <motion.div className="progress-fill" style={{ background: profitColour(bestProfit) }}
                    initial={false} animate={{ width: '100%' }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }} />
                </div>
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '6px 0 0' }}>
                  A second month of figures turns this into a best and worst comparison.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '0 0 5px' }}>Best month</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{monthName(health.bestMonth)}</span>
                    <span style={{ fontSize: 'var(--fs-label)', color: profitColour(bestProfit) }}>
                      {fmt(bestProfit, false, sym)} {bestProfit < 0 ? 'loss' : 'profit'}
                    </span>
                  </div>
                  <div className="progress-track">
                    <motion.div className="progress-fill" style={{ background: profitColour(bestProfit) }}
                      initial={false} animate={{ width: barWidth(bestProfit) }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '0 0 5px' }}>Worst month</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{monthName(health.worstMonth)}</span>
                    <span style={{ fontSize: 'var(--fs-label)', color: profitColour(worstProfit) }}>
                      {fmt(worstProfit, false, sym)} {worstProfit < 0 ? 'loss' : 'profit'}
                    </span>
                  </div>
                  <div className="progress-track">
                    <motion.div className="progress-fill" style={{ background: profitColour(worstProfit) }}
                      initial={false} animate={{ width: barWidth(worstProfit) }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }} />
                  </div>
                </div>
              </>
            )}
            {scores && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                {/* An engine nobody has given data to scored 0 and was drawn as a
                    measured zero, so a business with no POS export read as
                    "Operations: 0" rather than "nothing uploaded yet". */}
                {[
                  { label: 'Money', score: scores.e1_score, colour: 'var(--e1)', measured: scores.measured?.e1 ?? true },
                  { label: 'Customers', score: scores.e2_score, colour: 'var(--e2)', measured: scores.measured?.e2 ?? true },
                  { label: 'Operations', score: scores.e3_score, colour: 'var(--e3)', measured: scores.measured?.e3 ?? true },
                ].map((item) => (
                  <div key={item.label} style={{ flex: 1 }}>
                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '0 0 4px' }}>{item.label}</p>
                    <div className="progress-track" style={{ marginBottom: 3 }}><motion.div className="progress-fill" style={{ background: item.measured ? item.colour : 'var(--border-md)' }} initial={false} animate={{ width: item.measured ? `${item.score}%` : '0%' }} transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }} /></div>
                    <span style={{ fontSize: 'var(--fs-label)', color: item.measured ? 'var(--text-1)' : 'var(--text-4)', fontWeight: 600 }}>
                      {item.measured ? item.score : 'No data yet'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Strategic Recommendations */}
      <section className="bento-section" style={{ marginTop: 24, marginBottom: 24 }} aria-label="What to do about it">
        <header className="bento-section-head">
          <div>
            <p className="eyebrow">AIBOS suggests</p>
            <h2 className="bento-section-title">What to do about it</h2>
          </div>
          <p className="bento-section-sub">The most pressing first, worked out from your own records.</p>
        </header>
        <div className="bento-grid">
          {recs.map((rec, i) => (
            <RecommendationCard key={i} {...rec} index={i}
              className={recs.length === 1 ? 'span-6' : recs.length === 2 ? 'span-3' : ['span-4 rows-2', 'span-2', 'span-2', 'span-3', 'span-3'][i] ?? 'span-3'} />
          ))}
        </div>
      </section>

      {briefLines.length > 0 && (
        <SectionCard title="What to do next" subtitle="From everything AIBOS has read: money, customers and the till." style={{ marginBottom: 16 }}>
          {briefLines.map((line, i) => (<BriefPoint key={i} text={line} index={i} colour="var(--cyan)" />))}
        </SectionCard>
      )}

      {/* Period Summary */}
      <SectionCard title="This period" subtitle={months === 1 ? 'The month recorded so far' : `The last ${months} months`}>
        <div className="grid-3">
          {[
            { label: 'Sales', value: fmt(kpi.totalRevenue, true, sym) },
            { label: 'Costs', value: fmt(kpi.totalCosts, true, sym) },
            { label: 'Profit', value: fmt(kpi.totalProfit, true, sym) },
            { label: 'Average margin', value: `${kpi.avgMargin.toFixed(1)}%` },
            { label: 'Best month', value: monthName(health.bestMonth) },
            { label: 'Worst month', value: monthName(health.worstMonth) },
          ].map((item) => (
            <div key={item.label} className="mini-stat">
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{item.label}</span>
              <span className="money money-md">{item.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
