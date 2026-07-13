'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { logUsage } from '@/lib/usage';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';

export default function BriefPage() {
  // Funnel stage marker (audit #14) — explicit so it survives layout changes.
  useEffect(() => { logUsage('brief_viewed'); }, []);
  const {
    kpi, health, monthly, alerts, currencySymbol,
    intelligenceScores, unifiedBrief, dataShape,
  } = useStore();

  // The brief leans on month-over-month / best-month framing — meaningless for
  // item-level files, so show the honest notice rather than "Best Month: Period 9".
  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Intelligence Brief" feature="The financial brief" />;
  }

  return (
    <StrategicBriefView
      kpi={kpi}
      health={health}
      monthly={monthly}
      alerts={alerts}
      scores={intelligenceScores}
      unifiedBrief={unifiedBrief}
      sym={currencySymbol || 'K'}
    />
  );
}
