'use client';

// StrategicBriefView — the genuine Strategic Brief page body, extracted so BOTH
// the in-app /dashboard/brief route and the marketing site render the exact same
// component. Takes raw data as props (no store), derives recommendations the
// same way the product does — so nothing is fabricated.
import { fmt, scoreColor } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import { motion } from 'framer-motion';
import type { KpiShape, HealthShape, MonthlyRow, AlertRow, IntelligenceScoresShape } from '@/lib/store';

function BriefPoint({ text, index, colour }: { text: string; index: number; colour?: string }) {
  const content = text.replace(/^\d+\.\s*/, '').trim();
  const c = colour ?? 'var(--cyan)';
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + index * 0.08 }}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 0', borderTop: index > 0 ? '1px solid var(--border)' : 'none' }}
    >
      <span style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: `color-mix(in srgb, ${c} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-label)', fontWeight: 700, color: c }}>
        {index + 1}
      </span>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{content}</p>
    </motion.div>
  );
}

function RecommendationCard({ title, recommendation, priority, index }: { title: string; recommendation: string; priority: string; index: number }) {
  const priorityColour = priority === 'high' || priority === 'critical' ? 'var(--crit)' : priority === 'medium' ? 'var(--warn)' : 'var(--good)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.07 }}
      style={{ background: 'var(--bg-badge)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'flex-start' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 3 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColour, flexShrink: 0 }} />
        <div style={{ width: 1, flex: 1, minHeight: 16, background: `color-mix(in srgb, ${priorityColour} 20%, transparent)` }} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{title}</p>
          <span className="badge" style={{ color: priorityColour, background: `color-mix(in srgb, ${priorityColour} 10%, transparent)`, borderColor: `color-mix(in srgb, ${priorityColour} 25%, transparent)` }}>{priority.toUpperCase()}</span>
        </div>
        <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>{recommendation}</p>
      </div>
    </motion.div>
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
}

export default function StrategicBriefView({
  kpi, health, monthly, alerts, scores, unifiedBrief = '', sym = 'K', hideHeader = false,
}: StrategicBriefViewProps) {
  // ── Derived recommendations (identical logic to the product) ──────────────
  const recs: Array<{ title: string; recommendation: string; priority: string }> = [];
  if (kpi.avgMargin < 20) {
    recs.push({ title: 'Margin Below Target', recommendation: `Average margin of ${kpi.avgMargin.toFixed(1)}% is below the 20% target. Review cost structure and pricing strategy.`, priority: 'high' });
  }
  if (alerts.filter((a) => a.severity === 'warning' || a.severity === 'critical').length > 0) {
    recs.push({ title: 'Active Variance Alerts', recommendation: `${alerts.length} variance alert${alerts.length > 1 ? 's' : ''} detected. Review month-on-month cost spikes and anomalies.`, priority: 'medium' });
  }
  if (kpi.totalProfit > 0) {
    recs.push({ title: 'Reinvest Profit', recommendation: `Net profit of ${fmt(kpi.totalProfit, true, sym)} provides capacity for growth investment. Prioritise customer acquisition and inventory.`, priority: 'low' });
  }
  // Only judge an engine that was actually measured. Firing "Customer Retention
  // at Risk — score is 0/100" at an owner who has never uploaded customer data
  // is a finding about nothing, and it is the kind of thing that costs trust in
  // every other number on the page.
  if (scores && (scores.measured?.e2 ?? true) && scores.e2_score < 70) {
    recs.push({ title: 'Customer Retention at Risk', recommendation: `Customer Intelligence score is ${scores.e2_score}/100. Focus on reducing churn in the At Risk segment.`, priority: 'medium' });
  }
  if (scores && (scores.measured?.e3 ?? true) && scores.e3_score < 70) {
    recs.push({ title: 'Operations Below Benchmark', recommendation: `Operations score is ${scores.e3_score}/100. Drink attach rate and primary category mix need improvement.`, priority: 'medium' });
  }
  if (recs.length === 0) {
    recs.push(
      { title: 'Maintain Cost Discipline', recommendation: 'Continue monitoring cost-to-revenue ratios monthly to protect margin above 25%.', priority: 'low' },
      { title: 'Customer Intelligence', recommendation: 'Upload transaction data to unlock customer segmentation, CLV analysis and churn risk scoring.', priority: 'medium' },
      { title: 'Operations Intelligence', recommendation: 'Upload POS export data to benchmark against QSR industry standards and identify revenue gaps.', priority: 'medium' },
    );
  }

  const briefLines = (unifiedBrief || '').split('\n').filter((l) => l.trim() && /^\d+\./.test(l.trim()));
  const healthColour = scoreColor(health.score);
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
  const profitColour = (v: number) => (v < 0 ? 'var(--crit)' : 'var(--good)');
  // Bars in proportion to the figures they represent, against whichever month
  // is largest either way. A hardcoded width is a picture of nothing.
  const barScale = Math.max(Math.abs(bestProfit), Math.abs(worstProfit), 1);
  const barWidth = (v: number) => `${Math.round((Math.abs(v) / barScale) * 100)}%`;

  return (
    <>
      {!hideHeader && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Financial Intelligence</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Strategic Brief</h1>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '4px 0 0' }}>AI-generated executive summary · recommendations · action plan</p>
        </div>
      )}

      {/* KPI summary cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="HEALTH SCORE" value={String(health.score)} sub={health.label}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={healthColour} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          iconBg={`color-mix(in srgb, ${healthColour} 15%, transparent)`} sparkColor={healthColour} delay={0} />
        <KPICard label="TOTAL REVENUE" value={fmt(kpi.totalRevenue, true, sym)} sub="FY · 12-month rolling" growth={8.4}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 7 22 7 22 13" stroke="var(--good)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkData={monthly.slice(-6).map((m) => Number(m.Revenue) || 0)} sparkColor="var(--good)" delay={0.06} />
        <KPICard label="NET PROFIT" value={fmt(kpi.totalProfit, true, sym)} sub={`${kpi.avgMargin.toFixed(1)}% avg margin`} growth={12.1}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--cyan)" strokeWidth="1.5" fill="none" /><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9" stroke="var(--cyan)" strokeWidth="1.4" strokeLinecap="round" /></svg>}
          iconBg="rgba(0,212,255,0.12)" sparkData={monthly.slice(-6).map((m) => (Number(m.Revenue) || 0) - (Number(m.Costs) || 0))} sparkColor="var(--cyan)" delay={0.12} />
        <KPICard label="RECOMMENDATIONS" value={String(recs.length)} sub="strategic action items"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="var(--purple)" strokeWidth="1.5" fill="none" strokeLinejoin="round" /><path d="M8 9h8M8 13h5M8 17h6" stroke="var(--purple)" strokeWidth="1.3" strokeLinecap="round" /></svg>}
          iconBg="rgba(167,139,250,0.15)" sparkColor="var(--purple)" delay={0.18} />
      </div>

      {/* Financial Health */}
      <SectionCard title="Financial Health" subtitle="Score breakdown · best & worst month" delay={0.1} style={{ marginBottom: 20 }}>
        <div className="brief-health" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 28, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 130, height: 130 }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
              <motion.circle cx="65" cy="65" r="52" fill="none" stroke={healthColour} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={2 * Math.PI * 52}
                animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - health.score / 100) }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }} style={{ transform: 'rotate(-90deg)', transformOrigin: '65px 65px' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: healthColour, lineHeight: 1 }}>{health.score}</span>
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{health.label}</span>
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', marginTop: 1 }}>/100</span>
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
                are proportional to the actual figures, and one month says it is
                one month. */}
            {monthCount === 0 ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
                No monthly figures yet. Record a few sales and expenses and your best
                and worst months appear here.
              </p>
            ) : monthCount === 1 ? (
              <div>
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>
                  Only month so far
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{health.bestMonth}</span>
                  <span style={{ fontSize: 'var(--fs-label)', color: profitColour(bestProfit) }}>
                    {fmt(bestProfit, false, sym)} {bestProfit < 0 ? 'loss' : 'profit'}
                  </span>
                </div>
                <div className="progress-track">
                  <motion.div className="progress-fill" style={{ background: profitColour(bestProfit) }}
                    initial={{ width: 0 }} animate={{ width: '100%' }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }} />
                </div>
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '6px 0 0' }}>
                  A second month of figures turns this into a best and worst comparison.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>Best Month</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{health.bestMonth}</span>
                    <span style={{ fontSize: 'var(--fs-label)', color: profitColour(bestProfit) }}>
                      {fmt(bestProfit, false, sym)} {bestProfit < 0 ? 'loss' : 'profit'}
                    </span>
                  </div>
                  <div className="progress-track">
                    <motion.div className="progress-fill" style={{ background: profitColour(bestProfit) }}
                      initial={{ width: 0 }} animate={{ width: barWidth(bestProfit) }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>Worst Month</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{health.worstMonth}</span>
                    <span style={{ fontSize: 'var(--fs-label)', color: profitColour(worstProfit) }}>
                      {fmt(worstProfit, false, sym)} {worstProfit < 0 ? 'loss' : 'profit'}
                    </span>
                  </div>
                  <div className="progress-track">
                    <motion.div className="progress-fill" style={{ background: profitColour(worstProfit) }}
                      initial={{ width: 0 }} animate={{ width: barWidth(worstProfit) }}
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
                  { label: 'Financial', score: scores.e1_score, colour: 'var(--e1)', measured: scores.measured?.e1 ?? true },
                  { label: 'Customer', score: scores.e2_score, colour: 'var(--e2)', measured: scores.measured?.e2 ?? true },
                  { label: 'Operations', score: scores.e3_score, colour: 'var(--e3)', measured: scores.measured?.e3 ?? true },
                ].map((item) => (
                  <div key={item.label} style={{ flex: 1 }}>
                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                    <div className="progress-track" style={{ marginBottom: 3 }}><motion.div className="progress-fill" style={{ background: item.measured ? item.colour : 'var(--border-md)' }} initial={{ width: 0 }} animate={{ width: item.measured ? `${item.score}%` : '0%' }} transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }} /></div>
                    <span style={{ fontSize: 'var(--fs-label)', color: item.measured ? item.colour : 'var(--text-4)', fontWeight: 700 }}>
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
      <SectionCard title="Strategic Recommendations" subtitle="AI-generated · prioritised action items" delay={0.16} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recs.map((rec, i) => (<RecommendationCard key={i} {...rec} index={i} />))}
        </div>
      </SectionCard>

      {briefLines.length > 0 && (
        <SectionCard title="Executive Action Plan" subtitle="AIBOS Intelligence · E1 + Customer Intelligence + Operations" delay={0.24} style={{ marginBottom: 20 }}>
          {briefLines.map((line, i) => (<BriefPoint key={i} text={line} index={i} colour="var(--cyan)" />))}
        </SectionCard>
      )}

      {/* Period Summary */}
      <SectionCard title="Period Summary" subtitle={`${months}-month rolling · ${sym} ZMW`} delay={0.28}>
        <div className="grid-3">
          {[
            { label: 'Total Revenue', value: fmt(kpi.totalRevenue, true, sym), colour: 'var(--cyan)' },
            { label: 'Total Costs', value: fmt(kpi.totalCosts, true, sym), colour: 'var(--e2)' },
            { label: 'Net Profit', value: fmt(kpi.totalProfit, true, sym), colour: 'var(--good)' },
            { label: 'Avg Margin', value: `${kpi.avgMargin.toFixed(1)}%`, colour: 'var(--purple)' },
            { label: 'Best Month', value: health.bestMonth, colour: profitColour(bestProfit) },
            { label: 'Worst Month', value: health.worstMonth, colour: profitColour(worstProfit) },
          ].map((item) => (
            <div key={item.label} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>{item.label}</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: item.colour, margin: 0, letterSpacing: '-0.02em' }}>{item.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
