'use client';
/**
 * AIBOS — Cash & scenario simulator (audit #93). A dedicated home for the
 * /simulate backend that previously had no page: run "what if" scenarios
 * against a COPY of the Digital Twin (never live data) and see the P10/P50/P90
 * cash fan side by side, so the owner can test a decision — hire, price change,
 * cost cut — and read its effect on runway before committing to it.
 */
import PageHeader from '@/components/ui/PageHeader';
import { WhatIfPanel } from '@/components/dashboard/AdvisorPanel';
import CashForecastFan from '@/components/dashboard/CashForecastFan';

export default function SimulatePage() {
  return (
    <>
      <PageHeader
        eyebrow="Financial Intelligence"
        eyebrowColour="var(--cyan)"
        title="Simulator"
        subtitle="Test a decision before you make it — against a copy of your numbers, never the real books."
      />

      {/* Where you're heading on current trajectory. */}
      <CashForecastFan />

      {/* What changes if you act. Runs against a twin copy. */}
      <div className="grid-main">
        <WhatIfPanel />
        <div className="section-card" style={{ alignSelf: 'start' }}>
          <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 8px' }}>How this works</h2>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 10px' }}>
            Every scenario runs on a <strong>copy</strong> of your Digital Twin. Nothing here touches your real records — it&apos;s a safe sandbox for &ldquo;what if?&rdquo;.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}><strong>Change prices / volume / costs</strong> — see the effect on profit and margin.</li>
            <li style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}><strong>Hire staff</strong> — annualised salary impact on your cash.</li>
            <li style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>The fan above shows where cash is heading now; each result tells you how a decision moves it.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
