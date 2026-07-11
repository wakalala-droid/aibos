'use client';

// /admin/design — the living design-system reference (audit #40).
// Every primitive rendered with seeded data, next to the tokens that drive it.
// If a new surface doesn't look like this page, the new surface is wrong.
// Admin-only by placement; contains no business data.

import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import EngineScoreCard from '@/components/ui/EngineScoreCard';
import InsightCard from '@/components/ui/InsightCard';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';

const TYPE_SCALE = [
  { token: '--fs-display', px: '32px', sample: 'K284,500', note: 'KPI values — one per card' },
  { token: '--fs-h1',      px: '28px', sample: 'Page display heading', note: 'reserved' },
  { token: '--fs-h2',      px: '22px', sample: 'Page title (PageHeader)', note: 'one per page' },
  { token: '--fs-h3',      px: '18px', sample: 'Section card title', note: '' },
  { token: '--fs-body',    px: '14px', sample: 'Body copy, nav labels, buttons and inputs.', note: '' },
  { token: '--fs-data',    px: '13px', sample: 'Table cells · dense data · sublines', note: '' },
  { token: '--fs-label',   px: '12px', sample: 'MICRO LABELS · EYEBROWS · BADGES', note: 'the floor — nothing smaller' },
];

const COLOR_GROUPS: { name: string; tokens: string[] }[] = [
  { name: 'Surfaces', tokens: ['--bg-page', '--bg-card', '--bg-sidebar', '--bg-badge', '--bg-input'] },
  { name: 'Text', tokens: ['--text-1', '--text-2', '--text-3', '--text-4'] },
  { name: 'Brand + engines', tokens: ['--cyan', '--e1', '--e2', '--e3', '--blue', '--purple'] },
  { name: 'Status (never brand, never series)', tokens: ['--good', '--warn', '--crit', '--info'] },
];

type DemoRow = { id: string; segment: string; value: number; risk: number };
const DEMO_ROWS: DemoRow[] = [
  { id: 'CUST-014', segment: 'Champion', value: 48200, risk: 12 },
  { id: 'CUST-031', segment: 'At Risk',  value: 21900, risk: 78 },
  { id: 'CUST-007', segment: 'Loyal',    value: 33400, risk: 34 },
  { id: 'CUST-022', segment: 'Lost',     value: 9100,  risk: 91 },
];
const DEMO_COLUMNS: DataTableColumn<DemoRow>[] = [
  { key: 'id', label: 'Customer', sortValue: r => r.id, render: r => <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{r.id}</span> },
  { key: 'segment', label: 'Segment', sortValue: r => r.segment, render: r => r.segment },
  { key: 'value', label: 'Value', sortValue: r => r.value, render: r => `K${r.value.toLocaleString()}` },
  { key: 'risk', label: 'Risk', sortValue: r => r.risk,
    render: r => <span style={{ color: r.risk >= 70 ? 'var(--crit)' : r.risk >= 40 ? 'var(--warn)' : 'var(--good)', fontWeight: 600 }}>{r.risk}%</span> },
];

function Specimen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>{title}</h2>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

export default function DesignGalleryPage() {
  return (
    <div data-bento>
      <PageHeader
        eyebrow="Admin · Design System"
        title="Component gallery"
        subtitle="The canonical primitives with seeded data. New surfaces must compose these — if it isn't here, question it."
      />

      <Specimen title="Type scale — 7 sizes, nothing else">
        <div className="section-card">
          {TYPE_SCALE.map(t => (
            <div key={t.token} style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <code className="tnum" style={{ flexShrink: 0, width: 130, fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>{t.token} · {t.px}</code>
              <span style={{ fontSize: `var(${t.token})`, color: 'var(--text-1)', fontWeight: t.token === '--fs-display' ? 800 : 500 }}>{t.sample}</span>
              {t.note && <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-label)', color: 'var(--text-4)', flexShrink: 0 }}>{t.note}</span>}
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="Colour tokens — roles, not decoration">
        <div className="grid-2">
          {COLOR_GROUPS.map(g => (
            <div key={g.name} className="section-card">
              <p style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>{g.name}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.tokens.map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 'var(--radius-sm)', background: `var(${t})`, border: '1px solid var(--border-md)', display: 'inline-block' }} />
                    <code style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{t}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="KPI cards — value is the hero; severity tints the bloom">
        <div className="grid-kpi">
          <KPICard label="TOTAL REVENUE" value="K284,500" growth={12.4} sub="vs last month" sparkData={[40, 52, 47, 61, 58, 72]} sparkColor="var(--spark-revenue)" />
          <KPICard label="TOTAL COSTS" value="K191,200" growth={8.1} goodWhenUp={false} sub="vs last month" sparkData={[30, 34, 31, 39, 41, 44]} sparkColor="var(--spark-cost)" />
          <KPICard label="NET PROFIT" value="K93,300" growth={-4.2} sub="vs last month" sparkData={[18, 22, 19, 25, 21, 20]} sparkColor="var(--spark-profit)" />
          <KPICard label="LOW SCORE (bloom tint)" value="42" score={42} sub="severity via colour, not motion" sparkData={[8, 7, 6, 6, 5, 4]} sparkColor="var(--spark-margin)" />
        </div>
      </Specimen>

      <Specimen title="Engine score cards">
        <div className="grid-3">
          <EngineScoreCard label="ENGINE 1 · FINANCIAL" sub="Cash · Forecast · P&L" score={81} colour="var(--e1)" href="#" />
          <EngineScoreCard label="CUSTOMER INTELLIGENCE" sub="RFM · CLV · Churn" score={55} colour="var(--e2)" href="#" />
          <EngineScoreCard label="OPERATIONS" sub="POS · Benchmarks" score={0} colour="var(--e3)" href="#" locked />
        </div>
      </Specimen>

      <Specimen title="Insights, empty states and the data table">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InsightCard
            insight="Net margin compressed 3.1 pts month-over-month."
            action="Costs are outpacing revenue — act on the largest line."
            priority="high"
            sourceEngines={['E1']}
          />
          <SectionCard title="Empty state" subtitle="Every empty space educates and points at the next action">
            <EmptyState
              colour="var(--e2)"
              text="Upload customer or sales data to unlock RFM segments, CLV tiers and churn risk."
              action={{ label: 'Import data', href: '/dashboard/import' }}
            />
          </SectionCard>
          <SectionCard title="DataTable" subtitle="Sortable · filterable · paginates past 25 rows">
            <DataTable
              ariaLabel="Demo data table"
              columns={DEMO_COLUMNS}
              rows={DEMO_ROWS}
              rowKey={r => r.id}
              defaultSort={{ key: 'risk', dir: 'desc' }}
              filters={[
                { label: 'High risk', predicate: r => r.risk >= 70 },
                { label: 'Healthy', predicate: r => r.risk < 40 },
              ]}
            />
          </SectionCard>
        </div>
      </Specimen>

      <Specimen title="Rules that are never broken">
        <div className="section-card">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6 }}>
            <li>Geist is the only typeface — every text, every number, everywhere.</li>
            <li>Every card ships the bento dot texture + cursor BorderGlow (core chrome).</li>
            <li>Glow light effects are dark-mode only; light mode keeps static borders + dot grain.</li>
            <li>Font sizes come from the 7 tokens; 12px is the floor.</li>
            <li>Status colours (good/warn/crit/info) never double as brand or series colours.</li>
            <li>Motion communicates state; auto-playing decorative loops are banned.</li>
            <li>2px line indicators for status/active marking — never 3px ribbons.</li>
          </ul>
        </div>
      </Specimen>
    </div>
  );
}
