'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { monthName, monthTick } from '@/lib/change';
import { fmt } from '@/lib/utils';
import { readMonths, type MonthsReading } from '@/lib/api';
import { Note } from '@/components/hospitality/kit';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import ChartTooltip from '@/components/ui/ChartTooltip';
import FeatureGate from '@/components/ui/FeatureGate';
import TimeSeriesUnavailable from '@/components/ui/TimeSeriesUnavailable';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import WhatChanged from '@/components/dashboard/WhatChanged';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';

export default function AnomalyPage() {
  const { anomalies, monthly, alerts, currencySymbol, dataShape } = useStore();
  const sym = currencySymbol || 'K';

  // The months read on the server with the busy and quiet months the owner
  // told AIBOS (aibos-api seasons.py): undefined while it is read, null when
  // it could not be (the page then reads them itself, as it always did).
  // Keyed by the figures, so a fresh copy of the same months is not read again.
  const rowsKey = useMemo(() => JSON.stringify(monthly.map((m) => [String(m.Month), Number(m.Revenue) || 0, Number(m.Costs) || 0])), [monthly]);
  const [reading, setReading] = useState<MonthsReading | null | undefined>(undefined);
  useEffect(() => {
    const rows = (JSON.parse(rowsKey) as [string, number, number][]).map(([month, revenue, costs]) => ({ month, revenue, costs }));
    if (anomalies.length > 0 || rows.length < 3) { setReading(null); return; }
    let alive = true;
    setReading(undefined);
    readMonths(rows).then((r) => { if (alive) setReading(r?.ok ? r : null); }).catch(() => { if (alive) setReading(null); });
    return () => { alive = false; };
  }, [rowsKey, anomalies.length]);

  if (dataShape === 'cross_sectional') {
    return <TimeSeriesUnavailable title="Unusual months" feature="Anomaly detection" />;
  }

  const loading = reading === undefined;
  const held = reading?.unusual.held ?? [];
  const statusOf = new Map((reading?.unusual.months ?? []).map((m) => [m.month, m.status]));

  // ── Null-safe: derive anomalies from monthly if store.anomalies is empty ─
  const derivedAnomalies = anomalies.length > 0
    ? anomalies
    : reading
      ? reading.unusual.flags
      : loading
        ? []
        : (() => {
        if (monthly.length < 3) return [];
        const revenues = monthly.map(m => Number(m.Revenue) || 0);
        const costs    = monthly.map(m => Number(m.Costs)   || 0);
        const mean     = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const std      = (arr: number[]) => {
          const m = mean(arr);
          return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
        };
        const revMean  = mean(revenues), revStd = std(revenues);
        const costMean = mean(costs),    costStd = std(costs);
        const result: any[] = [];
        monthly.forEach((m, i) => {
          const rev  = revenues[i];
          const cost = costs[i];
          const revZ  = revStd  > 0 ? Math.abs((rev  - revMean)  / revStd)  : 0;
          const costZ = costStd > 0 ? Math.abs((cost - costMean) / costStd) : 0;
          if (revZ > 1.5) result.push({ id: `r-${i}`, month: String(m.Month), field: 'Revenue', value: rev,  expected: Math.round(revMean),  zScore: Math.round(revZ  * 10) / 10, severity: revZ  > 2 ? 'critical' : 'warning' });
          if (costZ > 1.5) result.push({ id: `c-${i}`, month: String(m.Month), field: 'Costs',   value: cost, expected: Math.round(costMean), zScore: Math.round(costZ * 10) / 10, severity: costZ > 2 ? 'critical' : 'warning' });
        });
        return result;
      })();

  const critical = derivedAnomalies.filter((a: any) => a.severity === 'critical');
  const warnings = derivedAnomalies.filter((a: any) => a.severity === 'warning');
  const maxZ     = derivedAnomalies.length > 0
    ? derivedAnomalies.reduce((mx: number, a: any) => { const z = Number(a.zScore) || 0; return z > mx ? z : mx; }, 0)
    : 0;

  // Build Z-score scatter data from monthly
  const scatterData = monthly.map((m, i) => {
    const rev  = Number(m.Revenue) || 0;
    const cost = Number(m.Costs)   || 0;
    const revenues = monthly.map(x => Number(x.Revenue) || 0);
    const costs    = monthly.map(x => Number(x.Costs)   || 0);
    const rMean = revenues.reduce((s, v) => s + v, 0) / Math.max(revenues.length, 1);
    const cMean = costs.reduce((s, v) => s + v, 0) / Math.max(costs.length, 1);
    const rStd  = Math.sqrt(revenues.reduce((s, v) => s + (v - rMean) ** 2, 0) / Math.max(revenues.length, 1)) || 1;
    const cStd  = Math.sqrt(costs.reduce((s, v) => s + (v - cMean) ** 2, 0) / Math.max(costs.length, 1)) || 1;
    return {
      month: String(m.Month),
      revZ: Math.round(Math.abs((rev  - rMean) / rStd) * 10) / 10,
      costZ: Math.round(Math.abs((cost - cMean) / cStd) * 10) / 10,
      revenue: rev,
      cost,
    };
  });

  const severityColor = (s: string) =>
    s === 'critical' ? 'var(--crit)' : s === 'warning' ? 'var(--warn)' : 'var(--info)';

  return (
    <FeatureGate
      feature="anomaly"
      title="Unusual months"
      colour="var(--cyan)"
      headline={derivedAnomalies.length > 0
        ? `We flagged ${derivedAnomalies.length} anomal${derivedAnomalies.length === 1 ? 'y' : 'ies'} in your numbers: ${critical.length} critical.`
        : 'Nothing unusual yet. Keep recording and AIBOS spots any month that breaks your pattern.'}
      detail="See exactly which months broke your normal pattern, how far each one went and the likely cause, across sales and costs."
    >
    <>
      <PageHeader
        eyebrow="Reports"
        eyebrowColour="var(--cyan)"
        title="Unusual spending"
        subtitle="Months where sales or costs broke your normal pattern."
      />

      {/* Auto-investigation from recorded events (audit #13) — silent when
          there's no anomaly or under 4 months of history. */}
      <WhatChanged />

      {/* KPI cards: held back while the months are read with the owner's
          seasons, so a busy December never shows as unusual for a moment. */}
      {loading ? <div className="skeleton" style={{ height: 132, borderRadius: 'var(--radius-lg)', marginBottom: 24 }} /> : (
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <KPICard
          label="Unusual months" value={String(derivedAnomalies.length)}
          sub="months off your normal pattern"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="var(--warn)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M12 10v4M12 17v.5" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(251,191,36,0.15)"
          sparkColor="var(--warn)" delay={0}
        />
        <KPICard
          label="Far out of line" value={String(critical.length)}
          sub="well out of line"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--crit)" strokeWidth="1.5" fill="none"/><path d="M12 8v5M12 16v.5" stroke="var(--crit)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(239,68,68,0.15)"
          sparkColor="var(--crit)" delay={0.06}
        />
        <KPICard
          label="Biggest jump" value={maxZ.toFixed(1)}
          sub="times further than usual (2 or more is far)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M2 20l5-10 4 6 3-4 4 8" stroke="var(--purple)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          iconBg="rgba(167,139,250,0.15)"
          sparkData={scatterData.map(d => Math.max(d.revZ, d.costZ))}
          sparkColor="var(--purple)" delay={0.12}
        />
        <KPICard
          label="Worth a look" value={String(warnings.length)}
          sub="somewhat out of line"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="var(--blue)" strokeWidth="1.5" fill="none"/><path d="M12 9v4M12 17h.01" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(96,165,250,0.15)"
          sparkColor="var(--blue)" delay={0.18}
        />
      </div>
      )}

      {/* Z-score chart */}
      {scatterData.length > 0 && (
        <SectionCard title="How far each month strayed" subtitle="How far each month strayed from your usual. Past 2 is far." delay={0.1} style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scatterData} barCategoryGap="22%" barGap={4}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis tickMargin={8} minTickGap={16} dataKey="month" tickFormatter={monthTick} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={84} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip currency={false} />} cursor={{ fill: 'var(--table-row-hover)' }} />
              <ReferenceLine y={2} stroke="var(--crit)" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: 'Critical (2.0)', fill: 'var(--crit)', fontSize: 'var(--fs-body)', position: 'insideTopRight' }} />
              <ReferenceLine y={1.5} stroke="var(--warn)" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: 'Warning (1.5)', fill: 'var(--warn)', fontSize: 'var(--fs-body)', position: 'insideTopRight' }} />
              <Bar dataKey="revZ" name="Revenue Z" radius={[6, 6, 0, 0]}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={entry.revZ > 2 ? 'var(--crit)' : entry.revZ > 1.5 ? 'var(--warn)' : 'var(--chart-line)'} fillOpacity={0.8} />
                ))}
              </Bar>
              <Bar dataKey="costZ" name="Cost Z" radius={[6, 6, 0, 0]}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={entry.costZ > 2 ? 'var(--crit)' : entry.costZ > 1.5 ? 'var(--warn)' : 'var(--e2)'} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {[['var(--chart-line)', 'Sales'], ['var(--e2)', 'Costs']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c as string, opacity: 0.8 }} />
                <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>{l}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Anomaly detail cards */}
      {derivedAnomalies.length > 0 ? (
        <SectionCard title="Unusual months" subtitle="Months worth checking" delay={0.16} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {derivedAnomalies.map((a: any, i: number) => {
              const sc = severityColor(a.severity);
              const diff = (a.value ?? 0) - (a.expected ?? 0);
              return (
                <motion.div key={a.id ?? i}
                  initial={false} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.05 }}
                  style={{
                    display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)',
                    gap: 12, alignItems: 'center',
                    padding: '13px 16px', borderRadius: 10,
                    background: 'var(--bg-badge)', border: `1px solid color-mix(in srgb, ${sc} 20%, var(--border))`,
                  }}
                >
                  {/* Severity indicator */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc }} />
                    <div style={{ width: 1, height: 20, background: `color-mix(in srgb, ${sc} 20%, transparent)` }} />
                  </div>

                  {/* Content */}
                  {/* The severity sits with the month and the score, and the
                      line wraps on a phone instead of pushing past the card. */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
                        {String(a.month)}: {String(a.field)}
                      </span>
                      <span className="badge" style={{ color: sc, background: `color-mix(in srgb, ${sc} 10%, transparent)`, borderColor: `color-mix(in srgb, ${sc} 25%, transparent)` }}>
                        Z = {Number(a.zScore ?? 0).toFixed(1)}
                      </span>
                      <span className="badge" style={{ color: sc, background: `color-mix(in srgb, ${sc} 10%, transparent)`, borderColor: `color-mix(in srgb, ${sc} 25%, transparent)`, whiteSpace: 'nowrap' }}>
                        {String(a.severity ?? 'info').toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: 0 }}>
                      Actual: {fmt(Number(a.value) || 0, false, sym)} · Expected: {fmt(Number(a.expected) || 0, false, sym)} · Δ {diff >= 0 ? '+' : ''}{fmt(diff, false, sym)}
                    </p>
                    {a.told && (
                      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-2)', margin: '4px 0 0' }}>{String(a.told)}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </SectionCard>
      ) : loading ? (
        <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)', marginBottom: 20 }} />
      ) : (
        // Under four months there is no baseline to be unusual against, so
        // "All clear" would be a claim the arithmetic cannot make (the API's
        // own investigation refuses below four months for the same reason).
        monthly.length < 4 ? (
          <SectionCard title="Unusual months" subtitle="Not enough months yet" delay={0.16} style={{ marginBottom: 20 }}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)', margin: '0 0 4px' }}>
                {monthly.length} month{monthly.length === 1 ? '' : 's'} recorded so far
              </p>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
                Spotting an unusual month needs at least 4 months to compare against. Keep recording and this checks itself.
              </p>
            </div>
          </SectionCard>
        ) : (
        <SectionCard title="Unusual months" subtitle="Nothing unusual in your figures" delay={0.16} style={{ marginBottom: 20 }}>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--good)' }}>
              <path d="M5 13l4 4L19 7" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--good)', margin: '0 0 4px' }}>All clear</p>
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>
              No statistical anomalies detected in the current dataset
            </p>
          </div>
        </SectionCard>
        )
      )}

      {/* The months the owner told AIBOS run busy or quiet, high or low the
          way they said: not counted as unusual; the page says why. */}
      {held.length > 0 && (
        <SectionCard title="Your busy and quiet months" subtitle="Not counted as unusual" delay={0.2} style={{ marginBottom: 20 }}>
          <ul style={{ margin: 0, padding: 0 }}>
            {held.map((h) => (
              <li key={h.id} className="row" style={{ listStyle: 'none', alignItems: 'flex-start' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="row-title" style={{ display: 'block' }}>{monthName(h.month)}: {h.field === 'Revenue' ? 'Sales' : 'Costs'}</span>
                  <span className="row-sub" style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{h.told}</span>
                </span>
                <span className="row-amount">{fmt(h.value, false, sym)}</span>
              </li>
            ))}
          </ul>
          <Note tone="info">
            From your answers in <Link href="/dashboard/teach" className="tap-link">Teach AIBOS</Link>. A busy month that comes in low,
            or a quiet one that comes in high, is still flagged above.
          </Note>
        </SectionCard>
      )}

      {/* Monthly data table */}
      <SectionCard title="Every month" subtitle="Sales, costs and how far each month strayed" delay={0.24}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th><th>Revenue</th><th>Rev Z</th>
                <th>Costs</th><th>Cost Z</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scatterData.map((row, i) => {
                const maxZ    = Math.max(row.revZ, row.costZ);
                // The server's word when it read the owner's seasons: a busy
                // month high only for being busy says "Busy month".
                const status  = statusOf.get(row.month) ?? (maxZ > 2 ? 'Critical' : maxZ > 1.5 ? 'Warning' : 'Normal');
                const statCol = status === 'Critical' ? 'var(--crit)' : status === 'Warning' ? 'var(--warn)'
                  : status === 'Normal' ? 'var(--good)' : 'var(--text-2)';
                return (
                  <tr key={row.month}>
                    <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{monthName(row.month)}</td>
                    <td>{fmt(row.revenue, false, sym)}</td>
                    <td style={{ color: 'var(--text-1)', fontWeight: row.revZ > 1.5 ? 700 : 400 }}>
                      {row.revZ.toFixed(2)}
                    </td>
                    <td>{fmt(row.cost, false, sym)}</td>
                    <td style={{ color: 'var(--text-1)', fontWeight: row.costZ > 1.5 ? 700 : 400 }}>
                      {row.costZ.toFixed(2)}
                    </td>
                    <td>
                      <span className="badge" style={{ color: statCol, background: `color-mix(in srgb, ${statCol} 10%, transparent)`, borderColor: `color-mix(in srgb, ${statCol} 25%, transparent)` }}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
    </FeatureGate>
  );
}
