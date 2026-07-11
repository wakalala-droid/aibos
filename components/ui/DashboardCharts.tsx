'use client';

// Genuine dashboard chart cores, extracted from the dashboard pages so the
// marketing site renders the REAL visuals (same recharts config, same tokens,
// same ChartTooltip). Each takes data as props. Used by marketing with seeded
// demo data; the in-app pages can adopt these too.
import {
  AreaChart, Area, BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import ChartTooltip from './ChartTooltip';
import { formatAxis } from '@/lib/utils';

// ── Forecast (from dashboard/forecast) ───────────────────────────────────────
export interface ForecastRow { month: string; hist?: number; fcast?: number; lower?: number; upper?: number }
export function ForecastChart({ data, sym = 'K', height = 240 }: { data: ForecastRow[]; sym?: string; height?: number }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="mHistG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.20} /><stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} /></linearGradient>
            <linearGradient id="mForeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--purple)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--purple)" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(Number(v))} />
          <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="upper" stroke="none" fill="rgba(167,139,250,0.07)" dot={false} name="Upper" connectNulls />
          <Area type="monotone" dataKey="lower" stroke="none" fill="var(--bg-page)" dot={false} name="Lower" connectNulls />
          <Area type="monotone" dataKey="hist" stroke="var(--cyan)" strokeWidth={2.2} fill="url(#mHistG)" dot={{ r: 3.5, fill: 'var(--cyan)', strokeWidth: 0 }} connectNulls name="Historical" />
          <Area type="monotone" dataKey="fcast" stroke="var(--purple)" strokeWidth={2} strokeDasharray="6 4" fill="url(#mForeG)" dot={{ r: 4, fill: 'var(--purple)', strokeWidth: 0 }} connectNulls name="Forecast" />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
        {[{ c: 'var(--cyan)', l: 'Historical', d: false }, { c: 'var(--purple)', l: 'Forecast', d: true }].map((it) => (
          <div key={it.l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="24" height="4">{it.d ? <line x1="0" y1="2" x2="24" y2="2" stroke={it.c} strokeWidth="2" strokeDasharray="5 3" /> : <line x1="0" y1="2" x2="24" y2="2" stroke={it.c} strokeWidth="2.2" />}</svg>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>{it.l}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Cash projection (from dashboard/cash) ────────────────────────────────────
export interface CashRow { label: string; cash: number }
export function CashProjectionChart({ data, sym = 'K', height = 210 }: { data: CashRow[]; sym?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs><linearGradient id="mCashGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxis(Number(v))} />
        <Tooltip content={<ChartTooltip sym={sym} />} cursor={{ stroke: 'var(--border-md)', strokeWidth: 1 }} />
        <Area type="monotone" dataKey="cash" stroke="var(--cyan)" strokeWidth={2} fill="url(#mCashGrad)" dot={false} name="Cash Position" />
        <ReferenceLine y={0} stroke="var(--crit)" strokeDasharray="4 4" strokeWidth={1} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Runway status bar (from dashboard/cash) ──────────────────────────────────
export function RunwayBar({ runway, target = 18 }: { runway: number; target?: number }) {
  const pct = Math.min((runway / target) * 100, 100);
  const color = runway >= 12 ? 'var(--good)' : runway >= 6 ? 'var(--warn)' : 'var(--crit)';
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 2px' }}>Cash Runway Status</p>
          <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: 0 }}>{runway}mo remaining · {runway < target ? `⚠ below ${target}mo target` : `✓ above ${target}mo target`}</p>
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{runway}mo <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', fontWeight: 400 }}>/ {target}mo</span></span>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 8, background: 'var(--border)', overflow: 'hidden', marginBottom: 10 }}>
        <motion.div style={{ height: '100%', background: color, borderRadius: 8 }} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 1.2, ease: 'easeOut' }} />
        <div style={{ position: 'absolute', left: `${Math.min((12 / target) * 100, 98)}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-4)', opacity: 0.5 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {[0, 6, 12, 18, 24].map((mo) => (
          <span key={mo} style={{ fontSize: 'var(--fs-label)', color: mo === 12 ? 'var(--warn)' : 'var(--text-4)' }}>{mo}mo{mo === 12 ? ' ⚑' : ''}</span>
        ))}
      </div>
    </div>
  );
}

// ── Anomaly Z-score bars (from dashboard/anomaly) ────────────────────────────
export interface ZRow { month: string; revZ: number; costZ: number }
export function AnomalyZChart({ data, height = 200 }: { data: ZRow[]; height?: number }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barCategoryGap="22%" barGap={4}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip currency={false} />} cursor={{ fill: 'var(--table-row-hover)' }} />
          <ReferenceLine y={2} stroke="var(--crit)" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: 'Critical (2.0)', fill: 'var(--crit)', fontSize: 12, position: 'insideTopRight' }} />
          <ReferenceLine y={1.5} stroke="var(--warn)" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'Warning (1.5)', fill: 'var(--warn)', fontSize: 12, position: 'insideTopRight' }} />
          <Bar dataKey="revZ" name="Revenue Z" radius={[3, 3, 0, 0]}>
            {data.map((e, i) => <Cell key={i} fill={e.revZ > 2 ? 'var(--crit)' : e.revZ > 1.5 ? 'var(--warn)' : 'var(--cyan)'} fillOpacity={0.8} />)}
          </Bar>
          <Bar dataKey="costZ" name="Cost Z" radius={[3, 3, 0, 0]}>
            {data.map((e, i) => <Cell key={i} fill={e.costZ > 2 ? 'var(--crit)' : e.costZ > 1.5 ? 'var(--warn)' : 'var(--e2)'} fillOpacity={0.7} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[['var(--cyan)', 'Revenue Z-score'], ['var(--e2)', 'Cost Z-score']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c as string, opacity: 0.8 }} />
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>{l}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Segment donut (from dashboard/customers) ─────────────────────────────────
export interface SegRow { name: string; value: number; colour: string }
export function SegmentDonut({ segments }: { segments: SegRow[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <ResponsiveContainer width={130} height={130}>
        <PieChart>
          <Pie data={segments} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" stroke="none">
            {segments.map((e, i) => <Cell key={i} fill={e.colour} fillOpacity={0.9} />)}
          </Pie>
          <Tooltip content={<ChartTooltip currency={false} />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex: 1 }}>
        {segments.map((s) => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.colour }} />
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-2)' }}>{s.name}</span>
            </div>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: s.colour }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
