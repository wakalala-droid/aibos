'use client';

// Revenue & profit area chart — the exact chart from the dashboard Overview,
// extracted so both the product and the marketing site render the same real
// component (recharts, design tokens, ChartTooltip). No fabricated styling.
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { formatAxis } from '@/lib/utils';

export interface RevenuePoint {
  month: string;
  Revenue: number;
  Profit: number;
}

export default function RevenueChart({
  data, sym = 'K', height = 200,
}: { data: RevenuePoint[]; sym?: string; height?: number }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--spark-revenue)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--spark-revenue)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--spark-profit)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--spark-profit)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month"
            tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-3)' }}
            axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fill: 'var(--text-3)' }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => formatAxis(Number(v))} />
          <Tooltip content={<ChartTooltip sym={sym} />}
            cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="Revenue"
            stroke="var(--spark-revenue)" strokeWidth={2}
            fill="url(#gR)" dot={false} name="Revenue" />
          <Area type="monotone" dataKey="Profit"
            stroke="var(--spark-profit)" strokeWidth={1.8}
            fill="url(#gP)" dot={false} name="Profit" />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        {[['var(--spark-revenue)', 'Revenue'], ['var(--spark-profit)', 'Profit']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 2, borderRadius: 2, background: c }} />
            <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-3)' }}>{l}</span>
          </div>
        ))}
      </div>
    </>
  );
}
