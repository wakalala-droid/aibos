'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { authHeaders, getCashByMethod, type CashByMethod } from '@/lib/api';
import CashForecastFan from '@/components/dashboard/CashForecastFan';
import { fmt, formatAxis } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SimpleSummary from '@/components/dashboard/SimpleSummary';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

/** "2026-07" as an owner reads it: "Jul 2026". Anything else is shown as given. */
function monthName(m: unknown): string {
  const s = String(m ?? '');
  const hit = s.match(/^(\d{4})-(\d{2})$/);
  if (!hit) return s;
  return new Date(Number(hit[1]), Number(hit[2]) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

interface Outlook { ok: boolean; reason?: string; bands?: { month_ahead: number; p50: number }[] }

export default function CashPage() {
  const { cashflow, monthly, kpi, currencySymbol, dataShape, twin, uploadedFile } = useStore();
  const sym = currencySymbol || 'K';

  // The honest forecast from the recorded books (the same one the AI uses). It
  // declines until there are four completed months, and says so.
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  // Where the cash sits: the drawer, the mobile money wallet, the bank.
  const [split, setSplit] = useState<CashByMethod | null>(null);
  useEffect(() => {
    let alive = true;
    getCashByMethod().then((d) => { if (alive) setSplit(d); }).catch(() => { /* optional */ });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/proxy/forecast/cash', { headers: await authHeaders() });
        const data = await res.json();
        if (alive && res.ok) setOutlook(data.forecast as Outlook);
      } catch { /* the page stands without it */ }
    })();
    return () => { alive = false; };
  }, []);

  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Cash Position" feature="Cash flow projection" />;
  }

  // ── Null-safe: derive values from real data ──────────────────────────────
  const months      = Math.max(monthly.length, 1);
  const monthlyBurn = kpi.totalCosts / months;
  // Runway is how long cash lasts at the rate it SHRINKS: spending beyond
  // income over the last three months. Cash over gross spend ignored sales.
  const recentMonths = monthly.slice(-3);
  const netBurn = recentMonths.length
    ? recentMonths.reduce((t, m) => t + (Number(m.Costs) || 0) - (Number(m.Revenue) || 0), 0) / recentMonths.length
    : 0;
  // Cash position = cumulative operating cash (sum of monthly profit). Engine 1
  // returns this as cashflow.ending_cash; fall back to total profit. No hardcode.
  //
  // When the figures come from recorded books, the books already know the cash
  // balance: opening cash plus every movement. Profit to date is not cash (it
  // ignores the opening balance, stock bought, loans and money still owed), and
  // this card showed it anyway, so a live account read K30,871 here while the
  // summary above it said the business was holding K17.9K.
  const fromBooks = !uploadedFile && !!twin && Number(twin.event_count) > 0;
  const currentCash = fromBooks
    ? Number(twin?.cash) || 0
    : cashflow?.currentCash ??
      cashflow?.ending_cash ??
      (typeof kpi.totalProfit === 'number' ? kpi.totalProfit : 0);
  // With cash not shrinking there is no runway to run out, so no number is
  // invented for it: the card says so and the bar reads full.
  const notShrinking = cashflow?.runway == null && netBurn <= 0;
  const runway      = cashflow?.runway      ?? (netBurn > 0 ? Math.round(Math.max(currentCash, 0) / netBurn) : 18);
  const projections = cashflow?.projections ?? [];
  // Real cumulative-cash trajectory for the sparkline, when available.
  const cashSpark = (cashflow?.monthly ?? [])
    .map((m) => Number(m?.cumulative_cash) || 0)
    .filter((v) => v !== 0);

  // Forward projections, only when something actually projected them (the
  // analysis of an uploaded file). There used to be a fallback here that took
  // today's cash and added each PAST month's profit times its place in the
  // list, then showed the result as that month's "cash position": a live
  // account read K77,373 for September while it held K11,630.50.
  const chartData = projections.map((p: any, i: number) => ({
    label: `Month +${p.month_ahead ?? i + 1}`,
    cash:  Math.round(Number(p.projected_cash) || 0),
    inflow:  Math.round(Number(p.inflow)  || 0),
    outflow: Math.round(Number(p.outflow) || 0),
  }));
  // What was recorded, month by month: nothing projected, nothing invented.
  const history = monthly.slice(-12).map((m) => {
    const income = Number(m.Revenue) || 0;
    const costs = Number(m.Costs) || 0;
    return { label: monthName(m.Month), income, costs, profit: income - costs };
  });
  const lastBand = outlook?.ok ? outlook.bands?.[outlook.bands.length - 1] : undefined;

  // Runway bar config
  const runwayTarget = 18;
  const runwayPct    = Math.min((runway / runwayTarget) * 100, 100);
  const runwayColor  = runway >= 12 ? 'var(--good)' : runway >= 6 ? 'var(--warn)' : 'var(--crit)';

  // The outlook card: a real projection or an honest "not yet".
  const outlookCard = chartData.length > 0
    ? { label: '6M PROJECTION', value: fmt(chartData[chartData.length - 1].cash, false, sym), sub: 'projected cash position' }
    : lastBand
      ? { label: `${lastBand.month_ahead}-MONTH OUTLOOK`, value: fmt(lastBand.p50, false, sym), sub: 'middle path, from your own history' }
      : { label: 'CASH OUTLOOK', value: 'Not yet', sub: 'needs 4 full months of records' };

  return (
    <>
      <PageHeader
        eyebrow="Financial Intelligence"
        eyebrowColour="var(--cyan)"
        title="Cash Intelligence"
        subtitle="Runway · burn rate · cash position · forward projections"
      />

      <SimpleSummary page="cash" />

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard
          label="CASH POSITION" value={fmt(currentCash, false, sym)} sub="current balance"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="var(--cyan)" strokeWidth="1.5" fill="none"/><path d="M2 10h20" stroke="var(--cyan)" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="15" r="1.5" fill="var(--cyan)"/></svg>}
          iconBg="rgba(0,212,255,0.12)"
          sparkData={cashSpark.length > 1 ? cashSpark.slice(-6) : undefined}
          sparkColor="var(--cyan)" delay={0}
          drillHref="/dashboard/timeline?type=CustomerPayment" drillLabel="Money in"
        />
        <KPICard
          label="MONTHLY BURN" value={fmt(monthlyBurn, false, sym)} sub="avg monthly spend"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2c0 0-6 5-6 10a6 6 0 0012 0c0-5-6-10-6-10z" stroke="var(--e2)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 12c0 0-2 1.5-2 3a2 2 0 004 0c0-1.5-2-3-2-3z" stroke="var(--e2)" strokeWidth="1.3" fill="none"/></svg>}
          iconBg="rgba(249,115,22,0.15)"
          sparkData={monthly.slice(-6).map(m => Number(m.Costs) || 0)}
          sparkColor="var(--e2)" delay={0.06}
          drillHref="/dashboard/timeline?type=Expense" drillLabel="See expenses"
        />
        <KPICard
          label="CASH RUNWAY" value={notShrinking ? 'Not shrinking' : `${runway}mo`} sub={notShrinking ? 'income covers spending' : `vs ${runwayTarget}mo target`}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6l6 6-6 6" stroke={runwayColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg={`color-mix(in srgb, ${runwayColor} 15%, transparent)`}
          sparkColor={runwayColor} delay={0.12}
        />
        <KPICard
          label={outlookCard.label} value={outlookCard.value} sub={outlookCard.sub}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 12l4-4 4 4 4-6 4 4" stroke="var(--purple)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          iconBg="rgba(167,139,250,0.15)"
          sparkData={chartData.length ? chartData.slice(-6).map(d => d.cash) : undefined}
          sparkColor="var(--purple)" delay={0.18}
        />
      </div>

      {/* Where the money is (upgrade 9): the one cash figure, split by how each
          payment was made. Shown for recorded books only. */}
      {fromBooks && split && (
        <SectionCard title="Where your money is" subtitle="Your cash, split by how each payment was made" delay={0.08} style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {([
              ['Cash', split.cash],
              ['Mobile money', split.mobile_money],
              ['Bank and card', split.bank],
              ...(Math.abs(split.unsaid) > 0.005 ? [['Not said how', split.unsaid] as [string, number]] : []),
              ...(Math.abs(split.opening) > 0.005 ? [['Starting balance', split.opening] as [string, number]] : []),
            ] as [string, number][]).map(([label, value]) => (
              <div key={label} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-badge)' }}>
                <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: value < 0 ? 'var(--crit)' : 'var(--text-1)', marginTop: 2 }}>
                  {fmt(value, false, sym)}
                </div>
              </div>
            ))}
          </div>
          {(split.cash < 0 || split.mobile_money < 0 || split.bank < 0 || Math.abs(split.unsaid) > 0.005) && (
            <p style={{ fontSize: 'var(--fs-label)', lineHeight: 1.6, color: 'var(--text-4)', margin: '12px 0 0' }}>
              A figure below zero means more was recorded going out that way than coming in. Record money you move
              between them (for example, cash taken to the bank) and say how each payment was made, and these even out.
              Together they always add up to your {fmt(split.total, false, sym)}.
            </p>
          )}
        </SectionCard>
      )}

      {/* Runway status bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderRadius: 12, padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 2px' }}>Cash Runway Status</p>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
              {/* The card above says "not shrinking"; this line used to say
                  "18mo remaining" at the same time. */}
              {notShrinking
                ? 'Your income covers your spending, so your cash is not running down.'
                : `${runway}mo remaining · ${runway < runwayTarget ? `⚠ Below ${runwayTarget}mo target` : `✓ Above ${runwayTarget}mo target`}`}
            </p>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: runwayColor }}>
            {notShrinking ? 'Safe' : <>{runway}mo <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', fontWeight: 400 }}>/ {runwayTarget}mo</span></>}
          </span>
        </div>
        {/* Runway bar */}
        <div style={{ position: 'relative', height: 8, borderRadius: 8, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
          <motion.div style={{ height: '100%', background: runwayColor, borderRadius: 8 }}
            initial={{ width: 0 }} animate={{ width: `${runwayPct}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }} />
          {/* Target marker */}
          <div style={{ position: 'absolute', left: `${Math.min((12 / runwayTarget) * 100, 98)}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-4)', opacity: 0.5 }} />
        </div>
        {/* Scale labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[0, 6, 12, 18, 24].map(mo => (
            <span key={mo} style={{ fontSize: 'var(--fs-label)', color: mo === 12 ? 'var(--warn)' : 'var(--text-4)' }}>
              {mo}mo{mo === 12 ? ' ⚑' : ''}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Projected cash chart */}
      {chartData.length > 0 && (
        <SectionCard title="Projected Cash Position" subtitle="Forward projection based on current trajectory" delay={0.16} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(v)} />
              <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="cash" stroke="var(--cyan)" strokeWidth={2} fill="url(#cashGrad)" dot={false} name="Cash Position" />
              <ReferenceLine y={0} stroke="var(--crit)" strokeDasharray="4 4" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* The honest forecast from the recorded books (4+ full months). */}
      {chartData.length === 0 && <CashForecastFan />}

      {/* Month by month, as recorded */}
      {chartData.length === 0 && history.length > 0 && (
        <SectionCard title="Month by month" subtitle="Income, costs and profit as recorded in your books" delay={0.22}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Month</th><th>Income</th><th>Costs</th><th>Profit</th></tr></thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.label}>
                    <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ color: 'var(--good)' }}>{fmt(row.income, false, sym)}</td>
                    <td style={{ color: 'var(--e2)' }}>{fmt(row.costs, false, sym)}</td>
                    <td style={{ color: row.profit >= 0 ? 'var(--good)' : 'var(--crit)', fontWeight: 700 }}>
                      {row.profit >= 0 ? '+' : ''}{fmt(row.profit, false, sym)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '10px 0 0', lineHeight: 1.5 }}>
            Months with nothing recorded are left out. A booking or invoice counts as income in the month it was made, and as cash when it is paid.
          </p>
        </SectionCard>
      )}

      {/* Projected inflow/outflow table */}
      {chartData.length > 0 && (
        <SectionCard title="Cash Flow Details" subtitle="Monthly inflow, outflow and net position" delay={0.22}>
          <table className="data-table">
            <thead><tr><th>Period</th><th>Inflow</th><th>Outflow</th><th>Net</th><th>Cash Position</th></tr></thead>
            <tbody>
              {chartData.map((row, i) => {
                const net = row.inflow - row.outflow;
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ color: 'var(--good)' }}>{fmt(row.inflow, false, sym)}</td>
                    <td style={{ color: 'var(--e2)' }}>{fmt(row.outflow, false, sym)}</td>
                    <td style={{ color: net >= 0 ? 'var(--good)' : 'var(--crit)', fontWeight: 700 }}>
                      {net >= 0 ? '+' : ''}{fmt(net, false, sym)}
                    </td>
                    <td style={{ color: 'var(--cyan)', fontWeight: 600 }}>{fmt(row.cash, false, sym)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      )}
    </>
  );
}
