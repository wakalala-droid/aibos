'use client';
import { useStore } from '@/lib/store';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';

export default function BriefPage() {
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
