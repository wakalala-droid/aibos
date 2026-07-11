'use client';

// LiveDashboard — the GENUINE dashboard components (KPICard, RevenueChart,
// EngineScoreCard) rendered on the marketing site with seeded demo data, inside
// a browser-window frame. `data-theme="dark"` scopes the product's real dark
// tokens to this subtree, so it renders identically to the in-app dashboard —
// real cursor edge-glow, real recharts, real sparklines. Not a mockup.
import KPICard from '@/components/ui/KPICard';
import RevenueChart from '@/components/ui/RevenueChart';
import EngineScoreCard from '@/components/ui/EngineScoreCard';
import { DEMO_MONTHLY, DEMO_CASH, DEMO_SCORES, DEMO_BUSINESS } from '@/lib/demoData';

const kz = (v: number) => `K${v.toLocaleString()}`;
const mom = (cur: number, prev: number) => ((cur - prev) / Math.abs(prev)) * 100;

const RevIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--blue)" strokeWidth="1.8" /><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h4.5a1.5 1.5 0 010 3H9" stroke="var(--blue)" strokeWidth="1.4" strokeLinecap="round" /></svg>
);
const ProfitIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 7 22 7 22 13" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const CashIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="var(--cyan)" strokeWidth="1.6" /><circle cx="12" cy="12.5" r="2.6" stroke="var(--cyan)" strokeWidth="1.5" /></svg>
);
const MarginIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--purple)" strokeWidth="1.6" /><path d="M12 8v4l3 3" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

export default function LiveDashboard() {
  const m = DEMO_MONTHLY;
  const last = m[m.length - 1];
  const prev = m[m.length - 2];

  const revSpark = m.map((x) => x.Revenue);
  const profSpark = m.map((x) => x.Revenue - x.Costs);
  const marginSpark = m.map((x) => Math.round(((x.Revenue - x.Costs) / x.Revenue) * 100));

  const lastProfit = last.Revenue - last.Costs;
  const prevProfit = prev.Revenue - prev.Costs;
  const lastMargin = (lastProfit / last.Revenue) * 100;
  const prevMargin = (prevProfit / prev.Revenue) * 100;
  const cashLast = DEMO_CASH[DEMO_CASH.length - 1];
  const cashPrev = DEMO_CASH[DEMO_CASH.length - 2];

  const chartData = m.map((x) => ({ month: x.Month, Revenue: x.Revenue, Profit: x.Revenue - x.Costs }));

  return (
    <div className="mkt-livedash" data-theme="dark">
      <div className="aibos-window-body">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{DEMO_BUSINESS}</p>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>Updated today · ZMW</span>
        </div>

        {/* Real KPI cards — cursor glow + recharts sparklines */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          <KPICard label="REVENUE" value={kz(last.Revenue)} growth={mom(last.Revenue, prev.Revenue)} sub="vs last month" sparkData={revSpark} sparkColor="var(--spark-revenue)" icon={RevIcon} iconBg="rgba(96,165,250,0.15)" delay={0} />
          <KPICard label="NET PROFIT" value={kz(lastProfit)} growth={mom(lastProfit, prevProfit)} sub="vs last month" sparkData={profSpark} sparkColor="var(--spark-profit)" icon={ProfitIcon} iconBg="rgba(52,211,153,0.15)" delay={0.06} />
          <KPICard label="CASH ON HAND" value={kz(cashLast)} growth={mom(cashLast, cashPrev)} sub="vs last month" sparkData={DEMO_CASH} sparkColor="var(--cyan)" icon={CashIcon} iconBg="rgba(0,212,255,0.15)" delay={0.12} />
          <KPICard label="AVG NET MARGIN" value={`${lastMargin.toFixed(1)}%`} growth={lastMargin - prevMargin} sub="vs last month" sparkData={marginSpark} sparkColor="var(--spark-margin)" icon={MarginIcon} iconBg="rgba(167,139,250,0.15)" delay={0.18} />
        </div>

        {/* Real revenue/profit chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 12, padding: '14px 14px 10px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 6px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Revenue Intelligence · monthly</p>
          <RevenueChart data={chartData} sym="K" height={170} />
        </div>

        {/* Real engine score cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <EngineScoreCard label="FINANCIAL" sub="Cash · P&L" score={DEMO_SCORES.e1_score} colour="var(--e1)" href="/dashboard/cash" />
          <EngineScoreCard label="CUSTOMER" sub="RFM · Churn" score={DEMO_SCORES.e2_score} colour="var(--e2)" href="/dashboard/customers" />
          <EngineScoreCard label="OPERATIONS" sub="POS · Velocity" score={DEMO_SCORES.e3_score} colour="var(--e3)" href="/dashboard/pos" />
        </div>
      </div>
    </div>
  );
}
