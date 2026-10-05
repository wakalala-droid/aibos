'use client';
import { useStore, type TopItemRow } from '@/lib/store';
import { fmt } from '@/lib/utils';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import SimpleSummary from '@/components/dashboard/SimpleSummary';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_RAMP } from '@/lib/tone';
import PageHeader from '@/components/ui/PageHeader';

// One palette (5 Oct 2026): the biggest category in the brand line, the rest
// in greys, so the donut reads in the same colours as the page.
const CAT_COLORS = CHART_RAMP;
// The API ranks speed with emoji; the owner reads words.
const VEL_WORD: Record<string, string> = { '\u{1F525}': 'Fast', '\u2705': 'Steady', '\u26A0': 'Slow' };

// Top-items columns. Rank (#) follows the current sort — it's the row's place
// in whatever ordering the user chose, not a frozen revenue rank.
const itemColumns = (sym: string): DataTableColumn<TopItemRow>[] => [
  { key: 'rank', label: '#', render: (_item, i) => <span style={{ color: 'var(--text-4)' }}>#{i + 1}</span> },
  { key: 'sku', label: 'Code', sortValue: r => r.sku,
    render: r => <span style={{ color: 'var(--text-3)' }}>{r.sku}</span> },
  { key: 'name', label: 'Name', sortValue: r => r.name,
    render: r => <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.name}</span> },
  { key: 'category', label: 'Category', sortValue: r => r.category,
    render: r => <span className="badge" style={{ color: 'var(--text-3)', background: 'var(--bg-badge)', borderColor: 'var(--border)' }}>{r.category}</span> },
  { key: 'units_sold', label: 'Units', sortValue: r => r.units_sold, render: r => r.units_sold.toLocaleString() },
  { key: 'revenue', label: 'Sales', sortValue: r => r.revenue,
    render: r => <span className="tnum" style={{ fontWeight: 600, color: 'var(--text-1)' }}>{fmt(r.revenue, false, sym)}</span> },
  { key: 'velocity_rank', label: 'How fast it sells', sortValue: r => r.velocity_rank,
    render: r => <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>{VEL_WORD[r.velocity_rank] ?? r.velocity_rank}</span> },
];

export default function POSPage() {
  const { posBusinessName, posPeriod, posGrandTotals, categories, topItems, hasEngine3Data, currencySymbol } = useStore();
  const sym = currencySymbol || 'K';
  const gt = posGrandTotals;
  const discRate = gt ? (gt.discount_value ?? 0) / Math.max(gt.gross_revenue ?? 0, 1) * 100 : 0;
  const pieData = categories.slice(0, 6).map((c, i) => ({ name: c.category, value: Math.round(c.revenue), colour: CAT_COLORS[i % CAT_COLORS.length] }));
  const unitRows = [...categories].sort((a, b) => (b.units ?? 0) - (a.units ?? 0)).slice(0, 8);
  const unitMax = Math.max(...unitRows.map((c) => c.units ?? 0), 1);

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Till sales"
        subtitle={<>{[posBusinessName, posPeriod].filter(Boolean).join(' · ')}</>}
      />

      <SimpleSummary page="ops" />

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard label="Sales before discounts" value={fmt(gt?.gross_revenue ?? 0, false, sym)} sub="what the till rang up" />
        <KPICard label="Sales after discounts" value={fmt(gt?.net_revenue ?? 0, false, sym)} sub="what you were paid" />
        <KPICard label="Items sold" value={(gt?.units_sold ?? 0).toLocaleString()} sub="across all categories" />
        <KPICard label="Discounts given" value={fmt(gt?.discount_value ?? 0, false, sym)} sub={`${discRate.toFixed(2)}% of sales before discounts`} />
      </div>

      {/* Charts: the donut in the one palette, and every category named on
          its own bar (the old chart skipped every other name). */}
      {categories.length > 0 && (
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <SectionCard title="Sales by category" subtitle="Share of the money each category brought in" delay={0.1}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div role="img" aria-label={`Donut chart of sales across ${pieData.length} categories`} style={{ flexShrink: 0 }}>
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} dataKey="value" stroke="var(--bg-card)" strokeWidth={2} paddingAngle={1}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.colour} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip sym={sym} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul style={{ flex: '1 1 200px', minWidth: 0, margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {categories.slice(0, 6).map((c, i) => (
                <li key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 'var(--radius-sm)', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0, boxShadow: 'inset 0 0 0 1px var(--border-md)' }} />
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</span>
                  </span>
                  <span className="tnum" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>{c.pct_of_total.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Items sold by category" subtitle="How many items went out of each category" delay={0.14}>
          <ul className="bar-list" aria-label={`Items sold across ${unitRows.length} categories`}>
            {unitRows.map((c) => (
              <li key={c.category}>
                <span className="bar-name">{c.category}</span>
                <span className="bar-figure">{(c.units ?? 0).toLocaleString()}</span>
                <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ display: 'block', width: `${((c.units ?? 0) / unitMax) * 100}%` }} /></span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      )}

      {/* Top Items Table */}
      <SectionCard title="Best sellers" subtitle="Highest sales first, with how fast each sells" delay={0.2} style={{ position: 'relative' }}>
        <DataTable
          ariaLabel="Top items by revenue"
          columns={itemColumns(sym)}
          rows={topItems}
          rowKey={(item, i) => item.sku || String(i)}
          defaultSort={{ key: 'revenue', dir: 'desc' }}
          emptyMessage="Upload your till's sales report to rank your items."
        />
        {!hasEngine3Data && <LockOverlay colour="var(--e3)" title="Needs your till data" description="Upload the sales report from your till (POS) to see what sells, how fast and when." bullets={['Sales by category and item','What sells fastest','Best sellers and slow sellers']} />}
      </SectionCard>
    </>
  );
}
