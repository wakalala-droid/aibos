'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  const sym = useStore(s => s.currencySymbol);
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   'rgba(9,13,30,0.95)',
      border:       '1px solid rgba(99,179,237,0.25)',
      borderRadius: 10,
      padding:      '10px 14px',
      boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)',
    }}>
      <p style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: 0, marginBottom: 8 }}>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{entry.name}:</span>
          <span style={{ fontSize: '0.78rem', color: '#e2eeff', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
            {formatCurrency(entry.value, true, sym)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart Card Wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, controls }: { title: string; subtitle?: string; children: React.ReactNode; controls?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background:   'rgba(9,13,30,0.72)',
        backdropFilter: 'blur(16px)',
        border:       '1px solid rgba(99,179,237,0.12)',
        borderRadius: 16,
        padding:      '22px 24px',
        boxShadow:    '0 4px 24px rgba(0,0,0,0.3)',
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {controls}
      </div>
      {children}
    </motion.div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:    '4px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(96,165,250,0.18)' : 'transparent',
        color:      active ? '#60a5fa' : '#4a6285',
        fontSize:   '0.72rem', fontFamily: 'DM Mono, monospace',
        transition: 'all .18s',
      }}
    >
      {label}
    </button>
  );
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────

export function RevenueChart() {
  const sym = useStore(s => s.currencySymbol);
  const monthly = useStore(s => s.monthly);
  const [view, setView] = useState<'area' | 'bar'>('area');

  const controls = (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(9,13,30,0.6)', borderRadius: 8, padding: 3, border: '1px solid rgba(99,179,237,0.1)' }}>
      <TabBtn label="Area" active={view === 'area'} onClick={() => setView('area')} />
      <TabBtn label="Bar"  active={view === 'bar'}  onClick={() => setView('bar')}  />
    </div>
  );

  const COMMON_AXIS = {
    tick: { fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' },
    axisLine: { stroke: 'rgba(99,179,237,0.1)' },
    tickLine: false,
  };

  return (
    <ChartCard title="Revenue vs Costs" subtitle="Monthly performance · FY" controls={controls}>
      <ResponsiveContainer width="100%" height={240}>
        {view === 'area' ? (
          <AreaChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false} />
            <XAxis dataKey="month" {...COMMON_AXIS} />
            <YAxis {...COMMON_AXIS} tickFormatter={v => `${sym}${v / 1000}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', paddingTop: 12 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#60a5fa" strokeWidth={2} fill="url(#gradRevenue)" />
            <Area type="monotone" dataKey="costs"   name="Costs"   stroke="#f59e0b" strokeWidth={2} fill="url(#gradCosts)"   />
            <Area type="monotone" dataKey="profit"  name="Profit"  stroke="#10b981" strokeWidth={2} fill="url(#gradProfit)"  />
          </AreaChart>
        ) : (
          <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false} />
            <XAxis dataKey="month" {...COMMON_AXIS} />
            <YAxis {...COMMON_AXIS} tickFormatter={v => `${sym}${v / 1000}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', paddingTop: 12 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#60a5fa" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            <Bar dataKey="costs"   name="Costs"   fill="#f59e0b" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            <Bar dataKey="profit"  name="Profit"  fill="#10b981" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Margin Chart ─────────────────────────────────────────────────────────────

export function MarginChart() {
  const sym = useStore(s => s.currencySymbol);
  const monthly = useStore(s => s.monthly);

  return (
    <ChartCard title="Net Margin Trend" subtitle="Monthly margin % · FY">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={{ stroke: 'rgba(99,179,237,0.1)' }} tickLine={false} />
          <YAxis tick={{ fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={{ stroke: 'rgba(99,179,237,0.1)' }} tickLine={false} tickFormatter={v => `${sym}${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line type="monotone" dataKey="margin" name="Margin %" stroke="#a78bfa" strokeWidth={2.5} dot={{ fill: '#a78bfa', r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Monthly Profit Bar ───────────────────────────────────────────────────────

export function ProfitBarChart() {
  const sym = useStore(s => s.currencySymbol);
  const monthly = useStore(s => s.monthly);

  return (
    <ChartCard title="Monthly Net Profit" subtitle="Absolute profit by month · FY">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.07)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={{ stroke: 'rgba(99,179,237,0.1)' }} tickLine={false} />
          <YAxis tick={{ fill: '#4a6285', fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={{ stroke: 'rgba(99,179,237,0.1)' }} tickLine={false} tickFormatter={v => `${sym}${v / 1000}K`} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]}>
            {monthly.map((entry, index) => (
              <rect key={index} fill={entry.profit >= 70000 ? '#10b981' : entry.profit >= 50000 ? '#60a5fa' : '#f59e0b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
