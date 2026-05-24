'use client';

import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { KPICard } from '@/components/cards/KPICard';
import { HealthRing } from '@/components/cards/HealthRing';
import { RevenueChart, MarginChart } from '@/components/charts/RevenueChart';
import { FileUpload } from '@/components/upload/FileUpload';
import { AIChat } from '@/components/chat/AIChat';
import { severityConfig } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

// ─── Icons ────────────────────────────────────────────────────────────────────

const RevenueIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);
const CostIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const ProfitIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
  </svg>
);
const MarginIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const AlertsIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const RunwayIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8"/>
  </svg>
);

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 2 }}>{subtitle}</p>}
    </div>
  );
}

// ─── Alerts Panel ─────────────────────────────────────────────────────────────

function AlertsPanel() {
  const alerts = useStore(s => s.alerts);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      style={{
        background:   'rgba(9,13,30,0.72)',
        backdropFilter: 'blur(16px)',
        border:       '1px solid rgba(99,179,237,0.12)',
        borderRadius: 16,
        overflow:     'hidden',
        boxShadow:    '0 4px 24px rgba(0,0,0,0.3)',
        position:     'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)' }} />
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(99,179,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>Variance Alerts</h3>
        <span style={{ fontSize: '0.62rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', background: 'rgba(99,179,237,0.1)', padding: '2px 8px', borderRadius: 999 }}>
          {alerts.length} active
        </span>
      </div>
      <div style={{ maxHeight: 340, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,179,237,0.15) transparent' }}>
        {alerts.map((alert, i) => {
          const cfg = severityConfig[alert.severity];
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                padding:     '13px 20px',
                borderBottom:'1px solid rgba(99,179,237,0.06)',
                display:     'flex',
                gap:         12,
                alignItems:  'flex-start',
                transition:  'background .15s',
              }}
              onHoverStart={() => {}}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: cfg.colour,
                flexShrink: 0, marginTop: 5,
                boxShadow: `0 0 8px ${cfg.colour}80`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#d4ddf0', fontFamily: 'Outfit, sans-serif' }}>{alert.title}</span>
                  <span style={{
                    fontSize: '0.58rem', fontFamily: 'DM Mono, monospace',
                    color: cfg.colour, background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                  }}>
                    {cfg.label}
                  </span>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#4a6285', fontFamily: 'Outfit, sans-serif', margin: 0, lineHeight: 1.4 }}>
                  {alert.description}
                </p>
                {alert.value && alert.expected && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'DM Mono, monospace', color: '#ef4444' }}>Actual: {formatCurrency(alert.value, true)}</span>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>Expected: {formatCurrency(alert.expected, true)}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const kpi     = useStore(s => s.kpi);
  const monthly = useStore(s => s.monthly);
  const revenueSparkline = monthly.map(m => m.revenue);
  const costsSparkline   = monthly.map(m => m.costs);
  const profitSparkline  = monthly.map(m => m.profit);
  const marginSparkline  = monthly.map(m => m.margin);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* ── KPI Grid ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Key Performance Indicators" subtitle="FY · 12-month rolling · vs prior period" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <KPICard
            title="Total Revenue"
            value={kpi.totalRevenue}
            delta={kpi.revenueDelta}
            format="currency"
            compact
            icon={<RevenueIcon />}
            sparkline={revenueSparkline}
            index={0}
            colour="#60a5fa"
          />
          <KPICard
            title="Total Costs"
            value={kpi.totalCosts}
            delta={kpi.costsDelta}
            format="currency"
            compact
            icon={<CostIcon />}
            sparkline={costsSparkline}
            index={1}
            colour="#f59e0b"
          />
          <KPICard
            title="Net Profit"
            value={kpi.netProfit}
            delta={kpi.profitDelta}
            format="currency"
            compact
            icon={<ProfitIcon />}
            sparkline={profitSparkline}
            index={2}
            colour="#10b981"
          />
          <KPICard
            title="Avg Net Margin"
            value={kpi.avgMargin}
            delta={kpi.marginDelta}
            format="percent"
            icon={<MarginIcon />}
            sparkline={marginSparkline}
            index={3}
            colour="#a78bfa"
          />
          <KPICard
            title="Variance Alerts"
            value={kpi.varianceAlerts}
            format="number"
            suffix=" alerts"
            icon={<AlertsIcon />}
            index={4}
            colour="#ef4444"
            subtitle="Active anomalies"
          />
          <KPICard
            title="Cash Runway"
            value={kpi.cashRunway}
            format="months"
            icon={<RunwayIcon />}
            index={5}
            colour="#06b6d4"
            subtitle="At current burn rate"
          />
        </div>
      </section>

      {/* ── Health + Upload ────────────────────────────────────────── */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <HealthRing />
          <FileUpload />
        </div>
      </section>

      {/* ── Revenue Chart ──────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Revenue Intelligence" subtitle="Monthly revenue, costs & profit · FY" />
        <RevenueChart />
      </section>

      {/* ── Margin Chart + Alerts ─────────────────────────────────── */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <SectionHeader title="Margin Trend" subtitle="Net margin % · monthly" />
            <MarginChart />
          </div>
          <div>
            <SectionHeader title="Active Alerts" subtitle="Variance & anomaly flags" />
            <AlertsPanel />
          </div>
        </div>
      </section>

      {/* ── AI CFO Chat ────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="AI CFO Assistant" subtitle="Ask anything about your financial data" />
        <AIChat compact={false} />
      </section>

      {/* ── Footer stamp ──────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#2d4a70', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          AI-BOS v2.0 · Data refreshed · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
