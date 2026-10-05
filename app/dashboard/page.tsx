'use client';
import { useStore } from '@/lib/store';
import { fmt, scoreColor, formatAxis, n } from '@/lib/utils';
import { monthChange, monthName, monthTick, moneyChangeText, MIN_MONTHS } from '@/lib/change';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import InsightCard from '@/components/ui/InsightCard';
import AICFOChat from '@/components/chat/AICFOChat';
import SimpleHome from '@/components/dashboard/SimpleHome';
import DecisionsQueue from '@/components/dashboard/DecisionsQueue';
import HomeTop from '@/components/home/HomeTop';
import { useLiveCustomerIntel } from '@/hooks/useLiveCustomerIntel';
import MilestoneBanner from '@/components/dashboard/MilestoneBanner';
import ActivationProgress from '@/components/dashboard/ActivationProgress';
import { RecommendationList } from '@/components/dashboard/AdvisorPanel';
import ChartTooltip from '@/components/ui/ChartTooltip';
import FeatureGate from '@/components/ui/FeatureGate';
import UpgradeTrigger from '@/components/ui/UpgradeTrigger';
import BriefSubscribe from '@/components/ui/BriefSubscribe';
import DataManifestCard from '@/components/ui/DataManifestCard';
import CustomMetricsCard from '@/components/ui/CustomMetricsCard';
import BorderGlow from '@/components/ui/BorderGlow';
import EngineScoreCard from '@/components/ui/EngineScoreCard';
import { bloomProps } from '@/lib/cometStyle';
import Link from 'next/link';
import { Aperture, BarChart3, LayoutGrid, Activity, Layers, ListChecks, Upload, Users } from 'lucide-react';
import BentoCard, { bentoSpans } from '@/components/ui/BentoCard';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// Cursor edge-glow tuning for KPI/score cards (hsl "h s l", React Bits).
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

// Simple mode gets its own front door; the full Overview stays the Pro surface.
// Two components (not an early return) so each keeps a stable hook order when
// the user flips the toggle at runtime.
export default function DashboardHome() {
  const uiMode = useStore((s) => s.uiMode);
  return uiMode === 'simple' ? <SimpleHome /> : <OverviewPage />;
}

function OverviewPage() {
  const {
    kpi, health, monthly, alerts,
    intelligenceScores, crossInsights, unifiedBrief,
    engineFlags, hasEngine2Data, hasEngine3Data,
    currencySymbol, rfm, retention,
    posGrandTotals, attachRates, benchmarks,
    dataShape, breakdown,
  } = useStore();
  const sym    = currencySymbol || 'K';
  const scores = intelligenceScores;
  // The customer section reads recorded sales too, not only uploaded files
  // (UI/UX audit A12): it said "coming soon" beside 15 paying customers.
  useLiveCustomerIntel();

  // Chart data
  const safeMonthly = Array.isArray(monthly) ? monthly : [];
  const chartData = safeMonthly.slice(-6).map(m => ({
    month:  String(m?.Month ?? ''),
    Revenue: Math.round(Number(m?.Revenue) || 0),
    Profit: Math.round((Number(m?.Revenue) || 0) - (Number(m?.Costs) || 0)),
  }));

  // Spark arrays
  const revSpark  = safeMonthly.slice(-6).map(m => Number(m?.Revenue) || 0);
  const profSpark = safeMonthly.slice(-6).map(m =>
    (Number(m?.Revenue) || 0) - (Number(m?.Costs) || 0)
  );
  // A month with no revenue has no margin. Dividing by a stand-in of 1 drew a
  // month of K500 costs as a -49,900% plunge that flattened the whole line.
  const marginSpark = safeMonthly.slice(-6).map(m => {
    const r = Number(m?.Revenue) || 0;
    const c = Number(m?.Costs)   || 0;
    return r > 0 ? Math.round(((r - c) / r) * 100) : 0;
  });
  const costSpark = safeMonthly.slice(-6).map(m => Number(m?.Costs) || 0);

  // Real month-over-month growth (no hardcoded numbers — trust is design).
  // Returns undefined when there's no prior month, so KPICard hides the badge
  // rather than showing a fabricated trend.
  // Month-over-month only makes sense with a real time axis. For item-level
  // (cross-sectional) files, suppress growth badges — comparing product rows as
  // "last month vs this month" would be fabricated.
  const isTimeSeries = dataShape !== 'cross_sectional';
  const lastM = safeMonthly[safeMonthly.length - 1];
  const prevM = isTimeSeries ? safeMonthly[safeMonthly.length - 2] : undefined;

  const lastRev = n(lastM?.Revenue), prevRev = n(prevM?.Revenue);
  const lastCost = n(lastM?.Costs), prevCost = n(prevM?.Costs);
  const lastProfit = lastRev - lastCost, prevProfit = prevRev - prevCost;
  const lastMargin = lastRev ? (lastProfit / lastRev) * 100 : 0;
  const prevMargin = prevRev ? (prevProfit / prevRev) * 100 : 0;

  // Honest change (UI/UX audit 2026-10 A11): a percentage only once three
  // months are recorded and the month before is a sensible base, otherwise the
  // difference in money. Margin moves in points and waits for the same base.
  const monthsRecorded = isTimeSeries ? safeMonthly.length : 0;
  const revChange    = prevM ? monthChange(lastRev, prevRev, monthsRecorded) : undefined;
  const costChange   = prevM ? monthChange(lastCost, prevCost, monthsRecorded) : undefined;
  const profitChange = prevM ? monthChange(lastProfit, prevProfit, monthsRecorded) : undefined;
  const marginChange = prevM && revChange?.pct !== undefined ? { diff: lastMargin - prevMargin } : undefined;
  const prevName = prevM ? monthName(prevM.Month) : '';
  const growthSub = prevM ? `vs ${prevName}` : 'first month';

  // Customer + Operations quick stats
  const safeRfm     = Array.isArray(rfm) ? rfm : [];
  const safeAlerts  = Array.isArray(alerts) ? alerts : [];
  const champions   = safeRfm.filter(r => r.segment === 'Champion').length;
  const highChurn   = safeRfm.filter(r => r.churn_risk >= 70).length;
  const retRate     = retention?.retention_rate ?? 0;
  const gt          = posGrandTotals;
  const drinkAttach = attachRates?.drink_attach_pct ?? 0;
  const safeBench   = Array.isArray(benchmarks) ? benchmarks : [];
  const warnB       = safeBench.filter(b => b.status !== 'good').length;

  // Item-level operations (e.g. the flower model): real product data that should
  // light up the Operations engine even when it isn't a restaurant POS export.
  const safeBreakdown = Array.isArray(breakdown) ? breakdown : [];
  const hasItemOps  = safeBreakdown.length > 0;
  const topSeller   = hasItemOps
    ? safeBreakdown.reduce((a, b) => ((b.units ?? 0) > (a.units ?? 0) ? b : a))
    : null;
  const bestMargin  = hasItemOps
    ? safeBreakdown.reduce((a, b) => (b.margin > a.margin ? b : a))
    : null;
  const opsActive   = hasEngine3Data || hasItemOps;

  // Cross insights + brief
  const safeInsights = Array.isArray(crossInsights) ? crossInsights : [];
  const orderedInsights = [
    ...safeInsights.filter(i => i.priority === 'high'),
    ...safeInsights.filter(i => i.priority === 'medium'),
    ...safeInsights.filter(i => i.priority === 'low'),
  ].slice(0, 5);

  const briefLines = (unifiedBrief || '')
    .split('\n')
    .filter(l => /^\d+\./.test(l.trim()))
    .slice(0, 5);

  // ── Unified Engine Intelligence ───────────────────────────────────────────
  // Always synthesise from whatever engines have data — even a single one — so
  // this panel is never an empty/locked dead-zone. Real cross-engine insights
  // (2+ engines) take precedence; otherwise we derive signals from the engine(s)
  // that are loaded.
  const hasEngine1 = !!engineFlags?.e1 || safeMonthly.length > 0;
  type Signal = { insight: string; action: string; priority: 'high' | 'medium' | 'low'; source_engines: string[] };
  const synthSignals: Signal[] = [];

  if (hasEngine1) {
    const m = kpi?.avgMargin ?? 0;
    // Don't call item rows "months" — describe the real scope of the data.
    const scope = isTimeSeries
      ? `${safeMonthly.length} month${safeMonthly.length === 1 ? '' : 's'}`
      : hasItemOps
        ? `${safeBreakdown.length} product${safeBreakdown.length === 1 ? '' : 's'}`
        : 'the dataset';
    synthSignals.push({
      insight: `Average net margin is ${m.toFixed(1)}% across ${scope}.`,
      action: m < 10 ? 'Margins are thin: review pricing and your largest cost lines.'
            : m < 20 ? 'Workable, but improvable: target your top variable costs.'
            : 'Strong margins: protect them as you scale.',
      priority: m < 10 ? 'high' : m < 20 ? 'medium' : 'low',
      source_engines: ['E1'],
    });
    if (revChange !== undefined) {
      const up = revChange.diff >= 0;
      synthSignals.push({
        insight: revChange.pct !== undefined
          ? `Sales ${up ? 'rose' : 'fell'} ${Math.abs(revChange.pct).toFixed(1)}% compared with ${prevName}.`
          : `Sales were ${moneyChangeText(revChange.diff, sym, String(prevM?.Month ?? ''))}.`,
        action: up ? 'Put more behind what sold best.' : 'Look into the drop before it grows.',
        priority: !up && (revChange.pct ?? 0) < -10 ? 'high' : !up ? 'medium' : 'low',
        source_engines: ['E1'],
      });
    }
    if (marginChange !== undefined && Math.abs(marginChange.diff) >= 0.5) {
      const up = marginChange.diff >= 0;
      synthSignals.push({
        insight: `Your margin went ${up ? 'up' : 'down'} ${Math.abs(marginChange.diff).toFixed(1)} points compared with ${prevName}.`,
        action: up ? 'Keep doing what drove the gain.' : 'Costs are growing faster than sales: start with the largest cost.',
        priority: !up && Math.abs(marginChange.diff) > 3 ? 'high' : !up ? 'medium' : 'low',
        source_engines: ['E1'],
      });
    }
  }
  if (hasEngine2Data) {
    synthSignals.push({
      insight: `${champions} champion customer${champions === 1 ? '' : 's'} · ${highChurn} at high churn risk.`,
      action: highChurn > 0 ? 'Prioritise retention outreach to the high-risk segment.' : 'Grow your champions with a loyalty offer.',
      priority: highChurn > champions ? 'high' : 'medium',
      source_engines: ['E2'],
    });
  }
  if (hasEngine3Data) {
    synthSignals.push({
      insight: `Drink attach at ${drinkAttach.toFixed(0)}%${warnB > 0 ? ` · ${warnB} benchmark${warnB === 1 ? '' : 's'} below target` : ''}.`,
      action: drinkAttach < 80 ? 'Push combo prompts at the point of sale to lift attach.' : 'Attach is strong: replicate it across locations.',
      priority: warnB > 0 || drinkAttach < 70 ? 'high' : 'low',
      source_engines: ['E3'],
    });
  }

  const unifiedInsights = (orderedInsights.length > 0 ? orderedInsights : synthSignals).slice(0, 6);
  // The at-a-glance cards in order; the grid layout follows how many there are.
  const glanceKeys = [briefLines.length > 0 ? 'brief' : '', 'customers', 'till', 'upload', safeAlerts.length > 0 ? 'alerts' : ''].filter(Boolean);
  // The big tall slot is only for the brief's next steps; without them the
  // three cards share the row evenly and the alerts take a row of their own.
  const gSpan = (k: string) => glanceKeys.includes('brief')
    ? bentoSpans(glanceKeys.length)[glanceKeys.indexOf(k)] ?? 'span-3'
    : k === 'alerts' ? 'span-6' : 'span-2';
  const activeEngineCount = [hasEngine1, hasEngine2Data, opsActive].filter(Boolean).length;

  return (
    <>
      {/* ── The day, answered: the redesigned home top (shared with Simple
             mode), then what to decide, then the numbers behind it. ─────── */}
      <ActivationProgress />
      <MilestoneBanner />
      <HomeTop />
      <DecisionsQueue />
      <div id="decide">
        <RecommendationList limit={3} title="Decide next" subtitle="From your own records, each with the evidence behind it." seeAllHref="/dashboard/brief?tab=advisor" />
      </div>

      {/* ── Contextual upgrade trigger (only at moments of demonstrated value) ── */}
      <UpgradeTrigger />

      {/* Your numbers: the analysis that backs the day above. */}
      <h2 style={{ margin: '8px 0 16px', fontSize: 'var(--fs-h2)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
        Your numbers
      </h2>

      {/* ── Engine score strip ──────────────────────────────────────────── */}
      <div className="grid-engines" style={{ marginBottom: 24 }}>
        {/* Overall hero */}
        <BorderGlow glowColor={CURSOR_GLOW} backgroundColor="var(--bg-card)" borderRadius={14} glowRadius={48} glowIntensity={1.2} coneSpread={12} colors={MESH} style={{ height: '100%' }}>
        <div className="kpi-card glow-inner"
          data-ai-explain="score.overall"
          data-ai-label="Health Score"
          data-ai-value={scores ? String(scores.overall_score) : undefined}
          style={{
          ...bloomProps(scores ? scores.overall_score : undefined, 'var(--cyan)').style,
          minWidth: 130, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <p className="kpi-label">Health score</p>
          <p className="money money-hero" style={{
            color: scores ? scoreColor(scores.overall_score) : 'var(--text-4)',
            margin: '12px 0 4px', display: 'block',
          }}>
            {scores?.overall_score ?? 'Not yet'}
          </p>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0 }}>
            {scores?.overall_label ?? (safeMonthly.length ? `${MIN_MONTHS} months needed` : 'No records yet')}
          </p>
        </div>
        </BorderGlow>

        <EngineScoreCard explainId="score.e1" label="MONEY"   sub="Cash, forecast and profit"
          score={scores?.e1_score ?? 0} colour="var(--e1)"
          href="/dashboard/cash"        locked={!engineFlags?.e1} notYet={safeMonthly.length < MIN_MONTHS} />
        <EngineScoreCard explainId="score.e2" label="CUSTOMERS"  sub="Who buys and who has gone quiet"
          score={scores?.e2_score ?? 0} colour="var(--e2)"
          href="/dashboard/customers"  locked={!hasEngine2Data} />
        <EngineScoreCard explainId="score.e3" label="OPERATIONS"             sub="Till sales and what sells"
          score={scores?.e3_score ?? 0} colour="var(--e3)"
          href="/dashboard/pos"         locked={!opsActive} />
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard
          explainId="kpi.revenue"
          label="TOTAL REVENUE" value={fmt(kpi?.totalRevenue ?? 0, true, sym)}
          change={revChange} sub={growthSub} sparkData={revSpark} sparkColor="var(--spark-revenue)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--blue)" strokeWidth="1.8" fill="none"/><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)" delay={0}
        />
        <KPICard
          explainId="kpi.costs"
          label="TOTAL COSTS" value={fmt(kpi?.totalCosts ?? 0, true, sym)}
          change={costChange} goodWhenUp={false} sub={growthSub} sparkData={costSpark} sparkColor="var(--spark-cost)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 8h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" stroke="var(--orange)" strokeWidth="1.6" fill="none"/><path d="M2 8l2-4h16l2 4" stroke="var(--orange)" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
          iconBg="rgba(249,115,22,0.15)" delay={0.06}
        />
        <KPICard
          explainId="kpi.profit"
          label="NET PROFIT" value={fmt(kpi?.totalProfit ?? 0, true, sym)}
          change={profitChange} sub={growthSub} sparkData={profSpark} sparkColor="var(--spark-profit)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" delay={0.12}
        />
        <KPICard
          explainId="kpi.margin"
          label="AVG NET MARGIN" value={`${(kpi?.avgMargin ?? 0).toFixed(1)}%`}
          change={marginChange} points sub={growthSub} sparkData={marginSpark} sparkColor="var(--spark-margin)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.6" fill="none"/><path d="M12 8v4l3 3" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(167,139,250,0.15)" delay={0.18}
        />
      </div>

      {/* How AIBOS read your file, and any figures the owner asked for. */}
      <DataManifestCard />
      <CustomMetricsCard />

      {/* Sales and profit by month. Hidden for files that are not a time line
          (SAFEGUARD: no fabrication). */}
      {chartData.length > 0 && dataShape !== 'cross_sectional' && (
        <SectionCard explainId="chart.revenue" title="Sales and profit by month" style={{ marginBottom: 24 }}>
          <div role="img" aria-label={`Area chart of monthly sales and profit for the last ${chartData.length} months`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--brand-fill)" stopOpacity={0.28}/>
                  <stop offset="100%" stopColor="var(--brand-fill)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false}/>
              <XAxis minTickGap={16} dataKey="month" tickFormatter={monthTick}
                tick={{ fontSize: 18, fill: 'var(--text-3)' }}
                axisLine={false} tickLine={false}/>
              <YAxis width={84}
                tick={{ fontSize: 18, fill: 'var(--text-3)' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => formatAxis(Number(v))}/>
              <Tooltip content={<ChartTooltip sym={sym}/>}
                cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }}/>
              <Area type="monotone" dataKey="Revenue"
                stroke="var(--chart-line)" strokeWidth={2}
                fill="url(#gR)" dot={false} name="Sales"/>
              <Area type="monotone" dataKey="Profit"
                stroke="var(--text-3)" strokeWidth={1.8} strokeDasharray="5 4"
                fill="none" dot={false} name="Profit"/>
            </AreaChart>
          </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {[['var(--chart-line)', 'Sales', false], ['var(--text-3)', 'Profit', true]].map(([c, l, dashed]) => (
              <div key={String(l)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="24" height="4" aria-hidden="true"><line x1="0" y1="2" x2="24" y2="2" stroke={String(c)} strokeWidth="2" strokeDasharray={dashed ? '5 3' : undefined} /></svg>
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{String(l)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── What AIBOS found: the owner's bento layout (5 Oct 2026) ─────── */}
      <div className="bento-section">
        <header className="bento-section-head">
          <div>
            <p className="eyebrow">Across your business</p>
            <h2 className="bento-section-title">What AIBOS found</h2>
          </div>
          <p className="bento-section-sub">
            Money, customers and the till read together, the most pressing first.
            {orderedInsights.length > 0 && <> <Link href="/dashboard/brief?tab=ops" className="pill pill-quiet" style={{ marginTop: 12 }}>See every finding</Link></>}
          </p>
        </header>
        {unifiedInsights.length > 0 ? (
          <div className="bento-grid" data-tour="findings">
            {unifiedInsights.slice(0, 5).map((ins, i, all) => (
              <InsightCard
                key={i} index={i}
                className={bentoSpans(all.length)[i]}
                insight={ins.insight}
                action={ins.action}
                priority={ins.priority as 'high' | 'medium' | 'low'}
                sourceEngines={ins.source_engines}
              />
            ))}
          </div>
        ) : (
          <BentoCard icon={<Aperture />} title="Nothing to read yet" tag="Start"
            text="Record your sales and costs, or upload a file, and AIBOS puts what it finds across money, customers and operations here."
            foot={<><Link href="/dashboard/record" className="pill pill-primary">Record a sale</Link><Link href="/dashboard/import" className="pill pill-quiet">Upload a file</Link></>} />
        )}
        {activeEngineCount < 3 && unifiedInsights.length > 0 && (
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '12px 0 0', lineHeight: 1.6 }}>
            {activeEngineCount === 1
              ? "Add customers' names or your till's sales report and AIBOS reads all three together."
              : 'Add the last one and AIBOS reads all three together.'}
          </p>
        )}
      </div>

      {/* ── At a glance: the rest of the business, as bento cards ────────── */}
      <div className="bento-section">
        <header className="bento-section-head">
          <div>
            <p className="eyebrow">At a glance</p>
            <h2 className="bento-section-title">Customers, till and next steps</h2>
          </div>
        </header>
        <div className="bento-grid">
          {/* Next steps from the brief: the big card when there is one. */}
          {briefLines.length > 0 && (
            <BentoCard className={gSpan('brief')} icon={<ListChecks />} title="What to do next" tag="Plan" motion="tilt"
              explainId="card.executiveBrief"
              foot={<Link href="/dashboard/brief?tab=ops" className="pill pill-quiet">Read the full brief</Link>}>
              <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
                {briefLines.map((line, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span className="avatar" aria-hidden="true" style={{ width: 32, height: 32 }}>{i + 1}</span>
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6 }}>{line.replace(/^\d+\.\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            </BentoCard>
          )}

          <BentoCard className={gSpan('customers')} icon={<Users />} title="Customers" tag="People" explainId="card.customer"
            href={hasEngine2Data ? '/dashboard/customers' : undefined}
            text={hasEngine2Data ? undefined : "Add the customer's name when you record a sale. After about 10, AIBOS shows who buys most and who has gone quiet."}
            foot={hasEngine2Data ? undefined : <Link href="/dashboard/record" className="pill">Record a sale</Link>}>
            {hasEngine2Data && (
              <div className="mini-stats" style={{ marginTop: 12 }}>
                {[
                  { l: 'Best', v: String(champions) },
                  { l: 'Gone quiet', v: String(highChurn) },
                  { l: 'Come back', v: `${retRate.toFixed(0)}%` },
                ].map((item) => (
                  <div key={item.l} className="mini-stat">
                    <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{item.l}</span>
                    <span className="money money-md">{item.v}</span>
                  </div>
                ))}
              </div>
            )}
          </BentoCard>

          <BentoCard className={gSpan('till')} icon={<BarChart3 />} title="Till" tag="Sales" motion="pulse" explainId="card.operations"
            href={hasEngine3Data ? '/dashboard/pos' : undefined}
            text={hasEngine3Data || hasItemOps ? undefined : "Upload your till's sales report to see what sells, how fast and at what time of day."}
            foot={hasEngine3Data || hasItemOps ? undefined : <Link href="/dashboard/import" className="pill">Upload a file</Link>}>
            {(hasEngine3Data || hasItemOps) && (
              <div className="mini-stats" style={{ marginTop: 12 }}>
                {(hasEngine3Data ? [
                  { l: 'Sales after discounts', v: fmt(gt?.net_revenue ?? 0, true, sym) },
                  { l: 'Sold with a drink', v: `${drinkAttach.toFixed(0)}%` },
                  { l: 'Below target', v: String(warnB) },
                ] : [
                  { l: 'Products', v: String(safeBreakdown.length) },
                  { l: 'Sells most', v: topSeller?.item ?? 'None' },
                  { l: 'Best margin', v: bestMargin ? `${bestMargin.margin.toFixed(0)}%` : 'None' },
                ]).map((item) => (
                  <div key={item.l} className="mini-stat">
                    <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{item.l}</span>
                    <span className="money money-md" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.v}>{item.v}</span>
                  </div>
                ))}
              </div>
            )}
          </BentoCard>

          {/* Upload: ONE place, so a file is never uploaded twice. */}
          <BentoCard className={gSpan('upload')} icon={<Upload />} title="Upload a file" tag="Import" motion="tilt" explainId="card.upload"
            text="Any Excel or CSV file. AIBOS reads every sheet together and files each row against the right worker, product or cost."
            foot={<Link href="/dashboard/import" className="pill pill-primary">Upload a file</Link>} />

          {safeAlerts.length > 0 && (
            <BentoCard className={gSpan('alerts')} icon={<Activity />} title="Worth checking" tag="Alerts" motion="pulse" explainId="card.alerts">
              <div style={{ marginTop: 8 }}>
                {safeAlerts.slice(0, 3).map((a: any, i: number) => (
                  <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{a.title ?? a.type}</p>
                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0 }}>{a.description ?? a.month}</p>
                  </div>
                ))}
              </div>
            </BentoCard>
          )}
        </div>
      </div>

      {/* ── More reports: link cards in the same grid ──────────────────────── */}
      <div className="bento-section">
        <header className="bento-section-head">
          <div>
            <p className="eyebrow">Reports</p>
            <h2 className="bento-section-title">Go deeper</h2>
          </div>
        </header>
        <div className="bento-grid">
          {[
            { href: '/dashboard/customers',     title: 'Best customers',  tag: 'People', text: 'Who buys most, how often and how much each is worth to you.', icon: <Users />,      span: 'span-2' },
            { href: '/dashboard/churn',         title: 'Quiet customers', tag: 'People', text: 'Who has stopped coming, and what to send them.',              icon: <Layers />,     span: 'span-2' },
            { href: '/dashboard/pos',           title: 'Till sales',      tag: 'Sales',  text: 'What sells, how fast and at what time of day.',              icon: <BarChart3 />,  span: 'span-2' },
            { href: '/dashboard/benchmarks',    title: 'How you compare', tag: 'Sales',  text: 'Your numbers against businesses like yours.',               icon: <LayoutGrid />, span: 'span-3' },
            { href: '/dashboard/brief?tab=ops', title: 'Briefs',          tag: 'Plan',   text: 'Everything above in one read, with what to do first.',      icon: <ListChecks />, span: 'span-3' },
          ].map((c) => (
            <BentoCard key={c.href} className={c.span} href={c.href} icon={c.icon} title={c.title} tag={c.tag} text={c.text} />
          ))}
        </div>
      </div>

      {/* AI brief delivery: gated to paid tiers (the retention engine). */}
      <div style={{ marginBottom: 24 }}>
        <FeatureGate
          feature="scheduled_brief"
          title="Morning brief"
          colour="var(--cyan)"
          headline="Get the one number that matters, every morning."
          detail="A brief lands in your inbox leading with what changed: “Your cash runway dropped to 12 days.” Every line links straight back into AIBOS."
        >
          <BriefSubscribe />
        </FeatureGate>
      </div>

      {/* ── AI CFO Chat ─────────────────────────────────────────────────── */}
      {/* Full-width section below the main grid. Unlimited on paid; Free gets the
          real chat with a daily taster (tiers.ts FREE_TASTER, counted server-side
          by entitlements.chat_taster) rather than a locked card. The chat renders
          its own labelled <section> + heading, so no duplicate heading here. */}
      <div style={{ marginBottom: 8 }}>
        <FeatureGate
          feature="ai_chat"
          title="Ask AIBOS"
          colour="var(--cyan)"
          headline="Ask your numbers anything: in plain language."
          detail="“What drove last month's cost spike?” “What's our cash runway?” AIBOS reasons across your money, customers and operations and answers instantly."
        >
          <div style={{ height: 600 }}>
            <AICFOChat />
          </div>
        </FeatureGate>
      </div>
    </>
  );
}
