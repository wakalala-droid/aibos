'use client';
import { useStore } from '@/lib/store';
import { monthName, monthTick } from '@/lib/change';
import { fmt, formatAxis } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import ChartKey from '@/components/ui/ChartKey';
import BentoCard from '@/components/ui/BentoCard';
import FeatureGate from '@/components/ui/FeatureGate';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import PageHeader from '@/components/ui/PageHeader';
import { Scale } from 'lucide-react';
import { BAD, INK } from '@/lib/tone';
import {
  ComposedChart, BarChart, Area, Line, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';

// The breakeven page (second bento pass, 5 Oct 2026). The owner asked for
// better graphs of where the business breaks even, in the one palette:
//  1. Where you stand: one card that says above or below the line, with a
//     meter from nothing to your sales and a tick where breakeven sits.
//  2. The breakeven chart: what you take and what you spend at every level
//     of monthly sales. Where the two lines cross is breakeven; the gap to the
//     right of it is profit, to the left a loss. Your own sales are marked.
//  3. Each month against the line: a bar per month, red when it fell short.

/** A round number a little above `v`, so the chart's edge lands on a tidy figure. */
function niceCeil(v: number): number {
  if (!(v > 0)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

type CvpRow = { x: number; take: number; spend: number; profit: [number, number] | null; loss: [number, number] | null };

function CvpTooltip({ active, payload, sym }: { active?: boolean; payload?: { payload: CvpRow }[]; sym: string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const left = r.take - r.spend;
  return (
    <div style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 220 }}>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 6px' }}>If you sold {fmt(r.x, true, sym)} a month</p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '2px 0', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span>You would spend</span><span style={{ color: INK, fontWeight: 600 }}>{fmt(r.spend, true, sym)}</span>
      </p>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '2px 0', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span>{left >= 0 ? 'You would keep' : 'You would lose'}</span>
        <span style={{ color: left >= 0 ? INK : BAD, fontWeight: 600 }}>{fmt(Math.abs(left), true, sym)}</span>
      </p>
    </div>
  );
}

export default function BreakevenPage() {
  const { breakeven, monthly, currencySymbol, dataShape, twinLoading, twinChecked, uploadedFile } = useStore();
  // Wait for the recorded books before calling the page empty (see forecast).
  const figuresLoading = twinLoading || (!twinChecked && !uploadedFile);
  const sym = currencySymbol || 'K';

  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Breakeven" feature="Breakeven analysis" />;
  }

  // ── Null-safe: compute from monthly if breakeven is null ──────────────────
  const totalRevenue = monthly.reduce((s, m) => s + (Number(m.Revenue) || 0), 0);
  const totalCosts   = monthly.reduce((s, m) => s + (Number(m.Costs)   || 0), 0);
  const months       = Math.max(monthly.length, 1);

  const avgMonthlyRevenue = totalRevenue / months;
  const avgMonthlyCosts   = totalCosts   / months;

  // ── No data uploaded: don't fabricate a 28% margin or K0 KPIs ─────────────
  const hasData = monthly.length > 0 && (totalRevenue > 0 || totalCosts > 0);

  // Use breakeven data if available, otherwise derive from monthly
  const fixedCostPct     = 0.40;
  const fixedCosts       = breakeven?.fixedCosts       ?? (avgMonthlyCosts * fixedCostPct);
  const variableCosts    = breakeven?.variableCosts    ?? (avgMonthlyCosts * (1 - fixedCostPct));
  const contribMargin    = breakeven?.contributionMargin ?? (avgMonthlyRevenue > 0 ? ((avgMonthlyRevenue - variableCosts) / avgMonthlyRevenue) : 0.28);
  const bepRevenue       = breakeven?.breakevenRevenue ?? (contribMargin > 0 ? fixedCosts / contribMargin : 0);
  const currentRevenue   = breakeven?.currentRevenue   ?? avgMonthlyRevenue;
  const gap              = currentRevenue - bepRevenue;
  const status: 'safe' | 'tight' | 'short' = gap >= 0 ? (bepRevenue > 0 && gap / bepRevenue > 0.2 ? 'safe' : 'tight') : 'short';
  const roomPct = currentRevenue > 0 ? (gap / currentRevenue) * 100 : 0;

  // ── The breakeven chart: spend = fixed costs + the share of each sale that
  // goes on costs that grow with sales. Take = sales. They cross at breakeven.
  const varShare = Math.min(Math.max(1 - contribMargin, 0), 0.99);
  const xMax = niceCeil(Math.max(currentRevenue, bepRevenue, 1) * 1.5);
  const xs = new Set<number>();
  for (let i = 0; i <= 24; i++) xs.add((xMax * i) / 24);
  if (bepRevenue > 0 && bepRevenue < xMax) xs.add(bepRevenue);
  if (currentRevenue > 0 && currentRevenue < xMax) xs.add(currentRevenue);
  const cvp: CvpRow[] = Array.from(xs).sort((a, b) => a - b).map((x) => {
    const spend = fixedCosts + varShare * x;
    return {
      x, take: x, spend,
      profit: x >= bepRevenue ? [spend, x] : null,
      loss: x <= bepRevenue ? [x, spend] : null,
    };
  });

  // ── Each month against the line.
  const monthBars = monthly.map((m) => ({ month: String(m.Month), Sales: Math.round(Number(m.Revenue) || 0) }));
  const shortMonths = monthBars.filter((m) => m.Sales < bepRevenue).length;

  // ── Where you stand: a meter from nothing to a little past the larger figure.
  const meterMax = Math.max(currentRevenue, bepRevenue, 1) * 1.15;
  const youPct = Math.min((Math.max(currentRevenue, 0) / meterMax) * 100, 100);
  const bepPct = Math.min((bepRevenue / meterMax) * 100, 100);

  const standTitle = status === 'safe' ? 'Above the line' : status === 'tight' ? 'Just above the line' : 'Below the line';
  const standTag = status === 'safe' ? 'Safe' : status === 'tight' ? 'Tight' : 'Short';
  const standText = status === 'short'
    ? <>Your sales average <strong>{fmt(currentRevenue, false, sym)}</strong> a month. You need <strong>{fmt(bepRevenue, false, sym)}</strong> to cover your costs, so each month runs <strong style={{ color: BAD }}>{fmt(Math.abs(gap), false, sym)}</strong> short.</>
    : <>Your sales average <strong>{fmt(currentRevenue, false, sym)}</strong> a month. You need <strong>{fmt(bepRevenue, false, sym)}</strong> to cover your costs, so <strong>{fmt(gap, false, sym)}</strong> a month is room to spare.</>;

  return (
    <FeatureGate
      feature="breakeven"
      title="Breakeven"
      colour="var(--cyan)"
      headline={currentRevenue > 0
        ? `You're ${fmt(Math.abs(gap), true, sym)} ${gap >= 0 ? 'above' : 'below'} a breakeven of ${fmt(bepRevenue, true, sym)}/month.`
        : 'Upload revenue and cost data to find your breakeven point.'}
      detail="See which costs stay fixed and which grow with sales, what each sale leaves you, how far above the line you are and the exact sales you need each month to cover your costs."
    >
    <>
      <PageHeader
        eyebrow="Reports"
        title="Breakeven"
        subtitle="The sales you need each month to cover your costs."
      />

      {!hasData ? (
        <SectionCard title="Breakeven" subtitle="What you must cover each month and how close you are" delay={0.1}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: '40px 16px' }}>
            <span className="bento-icon" aria-hidden="true"><Scale /></span>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {figuresLoading ? 'Loading your figures…' : 'No sales or costs yet'}
            </p>
            {!figuresLoading && (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0, lineHeight: 1.6, maxWidth: 480 }}>
                Record your sales and costs as they happen, or upload a file with a month, your sales and your costs. AIBOS then works out which costs are fixed, what each sale leaves you and the sales you need each month to break even.
              </p>
            )}
          </div>
        </SectionCard>
      ) : (
      <>
      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="Sales to cover costs" value={fmt(bepRevenue, false, sym)} sub="each month" />
        <KPICard label="Your sales" value={fmt(currentRevenue, false, sym)} sub="monthly average"
          sparkData={monthly.slice(-6).map(m => Number(m.Revenue) || 0)} />
        <KPICard label="Fixed costs" value={fmt(fixedCosts, false, sym)} sub="rent, wages and the like, each month" />
        <KPICard label="Left from each sale" value={`${(contribMargin * 100).toFixed(1)}%`} sub="after the cost of making it" />
      </div>

      {/* 1. Where you stand */}
      <div className="bento-grid" style={{ marginBottom: 20 }}>
        <BentoCard className="span-6" icon={<Scale />} title={standTitle} motion="tilt"
          tag={<span style={status === 'short' ? { color: BAD } : undefined}>{standTag}</span>}
          text={<span className="bento-note">{standText}</span>}
        >
          <div style={{ marginTop: 24 }}>
            <div className="meter" role="img"
              aria-label={`Your sales ${fmt(currentRevenue, false, sym)} against breakeven ${fmt(bepRevenue, false, sym)}`}>
              <div className={`meter-fill${status === 'short' ? ' bad' : ''}`} style={{ width: `${youPct}%` }} />
              <div className="meter-mark" style={{ left: `${bepPct}%` }} />
            </div>
            <div style={{ position: 'relative', height: 56, marginTop: 10 }}>
              <span style={{ position: 'absolute', left: `${bepPct}%`, transform: `translateX(${bepPct > 70 ? '-100%' : bepPct < 15 ? '0' : '-50%'})`, fontSize: 'var(--fs-label)', color: 'var(--text-3)', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                Breakeven<br /><strong style={{ color: INK }}>{fmt(bepRevenue, false, sym)}</strong>
              </span>
              {Math.abs(youPct - bepPct) > 24 && (
                <span style={{ position: 'absolute', left: `${youPct}%`, transform: `translateX(${youPct > 70 ? '-100%' : '-50%'})`, fontSize: 'var(--fs-label)', color: 'var(--text-3)', whiteSpace: 'nowrap', lineHeight: 1.4, textAlign: 'right' }}>
                  Your sales<br /><strong style={{ color: INK }}>{fmt(currentRevenue, false, sym)}</strong>
                </span>
              )}
            </div>
            <div className="mini-stats" style={{ marginTop: 12 }}>
              <div className="mini-stat">
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{gap >= 0 ? 'Room above the line' : 'Short of the line'}</span>
                <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: gap >= 0 ? INK : BAD }}>{fmt(Math.abs(gap), false, sym)}</span>
              </div>
              <div className="mini-stat">
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{gap >= 0 ? 'Sales could fall by' : 'Sales must grow by'}</span>
                <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: gap >= 0 ? INK : BAD }}>
                  {gap >= 0 ? `${roomPct.toFixed(0)}%` : `${(bepRevenue > 0 && currentRevenue > 0 ? (Math.abs(gap) / currentRevenue) * 100 : 0).toFixed(0)}%`}
                </span>
              </div>
              <div className="mini-stat">
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Months short of the line</span>
                <span className="tnum" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, color: shortMonths > 0 ? BAD : INK }}>{shortMonths} of {monthBars.length}</span>
              </div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* 2. The breakeven chart */}
      {bepRevenue > 0 && (
        <SectionCard title="Where sales cover costs" subtitle="What you take and what you spend at every level of monthly sales. The lines cross at breakeven." delay={0.14} style={{ marginBottom: 20 }}
          action={<ChartKey items={[
            ['var(--chart-line)', 'What you take'],
            ['var(--text-2)', 'What you spend'],
            ['var(--chart-muted)', 'Fixed costs', true],
          ]} />}
        >
          <div role="img" aria-label={`Breakeven chart: costs and sales cross at ${fmt(bepRevenue, false, sym)} a month; your sales are ${fmt(currentRevenue, false, sym)}`}>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={cvp} margin={{ top: 36, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis type="number" dataKey="x" domain={[0, xMax]} tickCount={5} tickFormatter={(v) => formatAxis(Number(v))}
                  tick={{ fontSize: 18, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis width={84} domain={[0, 'auto']} tick={{ fontSize: 18, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(Number(v))} />
                <Tooltip content={<CvpTooltip sym={sym} />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <Area dataKey="loss" stroke="none" fill="var(--red)" fillOpacity={0.14} isAnimationActive={false} connectNulls={false} name="Loss" />
                <Area dataKey="profit" stroke="none" fill="var(--chart-line)" fillOpacity={0.18} isAnimationActive={false} connectNulls={false} name="Profit" />
                <ReferenceLine y={fixedCosts} stroke="var(--chart-muted)" strokeDasharray="5 4" strokeWidth={1.5} />
                <Line dataKey="spend" stroke="var(--text-2)" strokeWidth={2} dot={false} isAnimationActive={false} name="What you spend" />
                <Line dataKey="take" stroke="var(--chart-line)" strokeWidth={2.5} dot={false} isAnimationActive={false} name="What you take" />
                {currentRevenue > 0 && currentRevenue < xMax && (
                  <ReferenceLine x={currentRevenue} stroke="var(--border-strong)" strokeDasharray="4 4"
                    label={{ value: 'You', position: 'top', fill: 'var(--text-1)', fontSize: 18, fontWeight: 600 }} />
                )}
                <ReferenceDot x={bepRevenue} y={bepRevenue} r={7} fill="var(--bg-card)" stroke="var(--text-1)" strokeWidth={2.5}
                  label={{ value: 'Breakeven', position: bepRevenue / xMax > 0.6 ? 'left' : 'right', fill: 'var(--text-1)', fontSize: 18, fontWeight: 600, offset: 12 }} />
                {currentRevenue > 0 && currentRevenue < xMax && (
                  <ReferenceDot x={currentRevenue} y={currentRevenue} r={6} fill="var(--chart-line)" stroke="var(--bg-card)" strokeWidth={2} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="bento-note" style={{ marginTop: 12 }}>
            Left of breakeven the shaded gap is money lost each month. Right of it, the gap is what you keep.
            {currentRevenue > 0 && <> At your sales you {gap >= 0 ? 'keep' : 'lose'} about <strong style={{ color: gap >= 0 ? INK : BAD }}>{fmt(Math.abs(currentRevenue * contribMargin - fixedCosts), false, sym)}</strong> a month.</>}
          </p>
        </SectionCard>
      )}

      {/* 3. Each month against the line */}
      {monthBars.length > 0 && (
        <SectionCard title="Each month against the line" subtitle={`The dashed line is breakeven, ${fmt(bepRevenue, false, sym)} a month. Red months fell short.`} delay={0.18} style={{ marginBottom: 20 }}
          action={<ChartKey items={[['var(--chart-line)', 'Covered costs'], ['var(--red)', 'Fell short'], ['var(--text-1)', 'Breakeven', true]]} />}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthBars} barCategoryGap="30%">
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis minTickGap={16} dataKey="month" tickFormatter={monthTick} tick={{ fontSize: 18, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={84} domain={[0, (max: number) => Math.max(max, bepRevenue * 1.2)]} tick={{ fontSize: 18, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(Number(v))} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <Bar dataKey="Sales" name="Sales" radius={[6, 6, 0, 0]} maxBarSize={72}>
                {monthBars.map((m) => <Cell key={m.month} fill={m.Sales < bepRevenue ? 'var(--red)' : 'var(--chart-line)'} />)}
              </Bar>
              <ReferenceLine y={bepRevenue} stroke="var(--text-1)" strokeDasharray="6 4" strokeWidth={1.5} />
            </BarChart>
          </ResponsiveContainer>
          {shortMonths > 0 && (
            <p className="bento-note" style={{ marginTop: 12 }}>
              {monthBars.filter((m) => m.Sales < bepRevenue).map((m) => monthName(m.month)).join(', ')} {shortMonths === 1 ? 'was' : 'were'} below the line.
            </p>
          )}
        </SectionCard>
      )}

      {/* Cost split */}
      <SectionCard title="Where your costs sit" subtitle="Costs that stay the same each month, and costs that grow with sales" delay={0.2}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
          {[
            { label: 'Fixed costs', value: fixedCosts, pct: fixedCostPct * 100, fill: 'var(--chart-line)', desc: 'Rent, wages and insurance: the same whatever you sell.' },
            { label: 'Costs that grow with sales', value: variableCosts, pct: (1 - fixedCostPct) * 100, fill: 'var(--chart-muted)', desc: 'Stock you sell, commission and packaging: they rise with every sale.' },
          ].map(item => (
            <div key={item.label} className="mini-stat" style={{ padding: '16px 20px', gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{item.label}</span>
              <span className="tnum" style={{ fontSize: 'var(--fs-h2)', fontWeight: 600, color: INK, letterSpacing: '-0.02em' }}>{fmt(item.value, false, sym)}</span>
              <div className="meter" style={{ height: 8 }}>
                <div className="meter-fill" style={{ width: `${item.pct}%`, background: item.fill }} />
              </div>
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{item.pct.toFixed(0)}% of your costs. {item.desc}</span>
            </div>
          ))}
        </div>
      </SectionCard>
      </>
      )}
    </>
    </FeatureGate>
  );
}
