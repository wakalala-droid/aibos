'use client';

// The money hero (redesign pilot, Home and Money).
//
// The one figure that leads the page: the money the business holds right
// now, large, with its line underneath. The line is alive under the pointer
// or finger: scrub across it and the big figure rolls to that evening's
// balance, with the day's money in and out beside it; let go and it rolls
// back to now. The period control redraws the line (that redraw is the only
// time it animates: cause and effect). Every point is worked back from the
// books (lib/moneyLine.ts), never smoothed or estimated.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '@/lib/store';
import { useBooksEvents } from '@/hooks/useBooksEvents';
import { moneyLine, dayWords } from '@/lib/moneyLine';
import { openRecordSheet } from '@/lib/recordSheet';
import { fmt } from '@/lib/utils';
import BigMoney from './BigMoney';
import Panel from './Panel';

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: 'Year' },
] as const;

export default function MoneyHero({ title = 'Money right now', initialDays = 30 }: { title?: string; initialDays?: number }) {
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const twin = useStore((s) => s.twin);
  const events = useBooksEvents();
  const [days, setDays] = useState<number>(initialDays);
  const [scrub, setScrub] = useState<number | null>(null);
  const gradId = `mh-${useId().replace(/:/g, '')}`;
  const headingId = `${gradId}-title`;

  // The line draws itself only when the owner changes the period, never on
  // arrival (motion_governance.md: no entrance animation).
  const changed = useRef(false);
  const [animate, setAnimate] = useState(false);
  useEffect(() => { if (changed.current) setAnimate(true); }, [days]);

  const cash = Number(twin?.cash) || 0;
  const line = useMemo(() => (events ? moneyLine(events, cash, days) : null), [events, cash, days]);
  const point = scrub !== null && line ? line.points[scrub] : null;
  const shown = point ? point.balance : cash;
  const moneyIn = point ? point.moneyIn : line?.moneyIn ?? 0;
  const moneyOut = point ? point.moneyOut : line?.moneyOut ?? 0;
  const empty = !!line && line.activeDays === 0 && cash === 0;

  const values = line?.points.map((p) => p.balance) ?? [];
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const pad = Math.max((hi - lo) * 0.15, Math.abs(hi) * 0.02, 1);
  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;
  // Four dates spread inside the line, never at its very edges where they clip.
  const ticks = line && line.points.length > 4
    ? [0.12, 0.38, 0.62, 0.88].map((f) => line.points[Math.round(f * (line.points.length - 1))].day)
    : line?.points.map((p) => p.day);

  return (
    <Panel labelledBy={headingId} explainId="simple-cash">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 id={headingId} className="panel-title" style={{ marginBottom: 6 }}>
            {point ? `End of ${dayWords(point.day)}` : title}
          </h2>
          <div>
            {twin ? <BigMoney value={shown} sym={sym} size="hero" roll /> : <span className="money money-hero" style={{ color: 'var(--text-4)' }}>…</span>}
          </div>
          <p style={{ margin: '10px 0 0', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}><span aria-hidden="true">↗ </span>{fmt(moneyIn, false, sym)} in</span>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}><span aria-hidden="true">↘ </span>{fmt(moneyOut, false, sym)} out</span>
            <span>{point ? 'that day' : `last ${periodLabel.toLowerCase() === 'year' ? 'year' : periodLabel}`}</span>
          </p>
        </div>
        <div className="seg" role="group" aria-label="Period for the money line">
          {PERIODS.map((p) => (
            <button key={p.days} type="button" aria-pressed={days === p.days}
              onClick={() => { changed.current = true; setScrub(null); setDays(p.days); }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Record your first sale and this line comes alive.</p>
          <button type="button" className="pill pill-primary" onClick={openRecordSheet}>Record a sale</button>
        </div>
      ) : (
        <div className="money-chart" role="img"
          aria-label={line ? `Money over the last ${periodLabel}: from ${fmt(line.points[0]?.balance ?? 0, false, sym)} to ${fmt(cash, false, sym)}` : 'Loading the money line'}
          onMouseLeave={() => setScrub(null)} onTouchEnd={() => setScrub(null)}>
          {line && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={line.points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                onMouseMove={(s) => { const i = (s as { activeTooltipIndex?: number })?.activeTooltipIndex; setScrub(typeof i === 'number' ? i : null); }}
                onMouseLeave={() => setScrub(null)}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.32} />
                    <stop offset="60%" stopColor="#00d4ff" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" ticks={ticks} interval={0} tickFormatter={(d: string) => dayWords(d, false)}
                  tick={{ fontSize: 18, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[lo - pad, hi + pad]} />
                <Tooltip content={() => null} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="balance" stroke="var(--chart-line)" strokeWidth={2}
                  fill={`url(#${gradId})`} isAnimationActive={animate} animationDuration={320}
                  activeDot={{ r: 5, fill: 'var(--chart-line)', stroke: 'var(--bg-card)', strokeWidth: 2 }} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </Panel>
  );
}
