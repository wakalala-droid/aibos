'use client';
/**
 * Briefs — the deep-analysis drill-in (audit #9, owner-approved plan).
 * The homepage answers the day; this page holds the long reads as tabs:
 * Financial (Engine 1 strategic brief), Ops (Engine 3 + cross-engine), and
 * Advisor (full recommendation list + the what-if simulator). The old
 * /dashboard/advisor and /dashboard/ops-brief routes redirect here or home.
 */
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import OpsBriefView from '@/components/dashboard/OpsBriefView';
import AdvisorPanel from '@/components/dashboard/AdvisorPanel';
import PageHeader from '@/components/ui/PageHeader';

type Tab = 'financial' | 'ops' | 'advisor';
const TABS: { id: Tab; label: string; colour: string }[] = [
  { id: 'financial', label: 'Financial', colour: 'var(--e1)' },
  { id: 'ops',       label: 'Operations', colour: 'var(--e3)' },
  { id: 'advisor',   label: 'Advisor',    colour: 'var(--cyan)' },
];

function BriefsInner() {
  const params = useSearchParams();
  const initial = (params.get('tab') as Tab) || 'financial';
  const [tab, setTab] = useState<Tab>(TABS.some(t => t.id === initial) ? initial : 'financial');

  const {
    kpi, health, monthly, alerts, currencySymbol,
    intelligenceScores, unifiedBrief, dataShape,
  } = useStore();

  return (
    <>
      <PageHeader
        title="Briefs"
        subtitle="The long reads — deep analysis by engine, and the full Advisor."
      />

      <div role="tablist" aria-label="Brief type" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="touch-target"
            style={{
              padding: '8px 16px', minHeight: 36, borderRadius: 8, cursor: 'pointer',
              fontSize: 'var(--fs-data)', fontWeight: tab === t.id ? 700 : 600,
              color: tab === t.id ? 'var(--text-1)' : 'var(--text-3)',
              background: tab === t.id ? 'var(--bg-badge)' : 'transparent',
              border: `1px solid ${tab === t.id ? 'var(--border-md)' : 'transparent'}`,
              borderBottom: tab === t.id ? `2px solid ${t.colour}` : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'financial' && (
        // Month-over-month framing is meaningless for item-level files — show
        // the honest notice rather than "Best Month: Period 9".
        dataShape === 'cross_sectional'
          ? <TimeSeriesUnavailable title="Financial Brief" feature="The financial brief" />
          : <StrategicBriefView
              kpi={kpi}
              health={health}
              monthly={monthly}
              alerts={alerts}
              scores={intelligenceScores}
              unifiedBrief={unifiedBrief}
              sym={currencySymbol || 'K'}
            />
      )}

      {tab === 'ops' && <OpsBriefView />}

      {tab === 'advisor' && <AdvisorPanel />}
    </>
  );
}

export default function BriefsPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <BriefsInner />
    </Suspense>
  );
}
