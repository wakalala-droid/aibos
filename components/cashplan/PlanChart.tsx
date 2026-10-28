'use client';

// The 13-week fan (Growth cash plan, 16 Oct 2026): the money at the end of
// every day for 91 days. The likely path is the brand line, the cautious to
// hopeful range shaded around it, the cautious path dashed, the floor (zero
// unless the owner set one) a red dashed line when any future goes under it.
// A decision being tried shows as a second, dashed line on the same futures.

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartKey from '@/components/ui/ChartKey';
import ChartTooltip from '@/components/ui/ChartTooltip';
import { formatAxis, fmt } from '@/lib/utils';
import type { Band } from '@/lib/api';

export function dayWords(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** The line the plan keeps above, as a sentence says it: "zero", "K5,000",
 *  or "your K20,000 cushion" when it is the cash the owner told AIBOS to keep
 *  (aibos-api cash_plan.floor_words). */
export function floorWords(floor: number | null | undefined, fromCushion: boolean, sym: string): string {
  if (!floor || floor <= 0) return 'zero';
  return fromCushion ? `your ${fmt(floor, true, sym)} cushion` : fmt(floor, true, sym);
}

export default function PlanChart({ daily, floor, sym, decision, height = 280 }: {
  daily: ({ day: string } & Band)[];
  floor: number;
  sym: string;
  /** The likely path with a decision tried, one per day, when there is one. */
  decision?: number[] | null;
  height?: number;
}) {
  const data = daily.map((d, i) => ({
    label: dayWords(d.day),
    range: [d.p10, d.p90] as [number, number],
    likely: d.p50,
    cautious: d.p10,
    decision: decision ? decision[i] : undefined,
  }));
  const dips = daily.some((d) => d.p10 < floor);
  const last = daily[daily.length - 1];
  const keys: [string, string, boolean?][] = [
    ['var(--chart-line)', 'Most likely'],
    ['color-mix(in srgb, var(--chart-line) 30%, transparent)', 'Cautious to hopeful'],
    ['var(--text-3)', 'Cautious', true],
  ];
  if (decision) keys.push(['var(--text-1)', 'With your decision', true]);

  return (
    <>
      <ChartKey items={keys} />
      <div role="img" style={{ marginTop: 12 }}
        aria-label={`Money over the next 13 weeks: most likely ${fmt(last?.p50 ?? 0, true, sym)} on ${dayWords(last?.day)}, cautious ${fmt(last?.p10 ?? 0, true, sym)}`}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" interval={13} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickMargin={10} />
            <YAxis width={84} tick={{ fontSize: 13, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(Number(v))} />
            <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
            {dips && <ReferenceLine y={floor} stroke="var(--red)" strokeDasharray="4 4" strokeWidth={1} />}
            <Area dataKey="range" stroke="none" fill="var(--chart-line)" fillOpacity={0.16} isAnimationActive={false} name="Range" legendType="none" />
            <Line dataKey="cautious" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} name="Cautious" />
            <Line dataKey="likely" stroke="var(--chart-line)" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Most likely" />
            {decision && (
              <Line dataKey="decision" stroke="var(--text-1)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} name="With your decision" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
