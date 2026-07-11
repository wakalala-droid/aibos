'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TIERS } from '@/lib/tiers';

// Honest, RANGED outputs only — no fabricated precision (conversion_psychology.md
// + the SAFEGUARD no-fabrication ethos). Every figure is shown as an estimate or
// a clearly-labelled example the visitor can check against their own numbers.

const PRO = TIERS.pro.priceMonthly; // single source of truth — lib/tiers.ts

function fmt(n: number) {
  return n.toLocaleString('en-ZM', { maximumFractionDigits: 0 });
}

function Field({
  label, suffix, value, min, max, step, onChange,
}: {
  label: string; suffix: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div style={{ marginBottom: 22 }}>
      <label htmlFor={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>
          {suffix === 'K' ? 'K' : ''}{fmt(value)}{suffix !== 'K' ? ` ${suffix}` : ''}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--cyan)' }}
      />
    </div>
  );
}

export default function ROICalculator() {
  const [revenue, setRevenue] = useState(60000);
  const [hours, setHours] = useState(6);

  const out = useMemo(() => {
    const hoursMonth = hours * 4.3;
    const hoursLow = Math.round(hoursMonth * 0.5);
    const hoursHigh = Math.round(hoursMonth * 0.7);
    const daysLow = (hoursLow / 8).toFixed(1);
    const daysHigh = (hoursHigh / 8).toFixed(1);
    const leak1pct = Math.round(revenue * 0.01);
    const multiple = Math.max(1, Math.round(leak1pct / PRO));
    return { hoursLow, hoursHigh, daysLow, daysHigh, leak1pct, multiple };
  }, [revenue, hours]);

  return (
    <div className="mkt-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'stretch' }}>
      {/* Inputs */}
      <div className="mkt-card">
        <p style={{ fontWeight: 800, color: 'var(--text-1)', margin: '0 0 20px' }}>Your business, roughly</p>
        <Field label="Monthly revenue" suffix="K" value={revenue} min={5000} max={1000000} step={5000} onChange={setRevenue} />
        <Field label="Hours a week on spreadsheets & reports" suffix="hrs" value={hours} min={1} max={40} step={1} onChange={setHours} />
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '6px 0 0', lineHeight: 1.5 }}>
          Drag to match your business. Nothing is sent anywhere; this runs entirely in your browser.
        </p>
      </div>

      {/* Results */}
      <div className="mkt-card" style={{ background: 'linear-gradient(180deg, var(--cyan-dim), transparent 40%), var(--bg-card)', borderColor: 'color-mix(in srgb, var(--cyan) 35%, var(--border-md))' }}>
        <p style={{ fontSize: 'var(--fs-label)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cyan)', margin: '0 0 16px' }}>
          A rough estimate
        </p>

        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', margin: 0 }}>
            {out.hoursLow} to {out.hoursHigh} hrs
          </p>
          <p className="mkt-body" style={{ fontSize: 'var(--fs-body)' }}>
            likely back in your month once the reporting runs itself, about {out.daysLow} to {out.daysHigh} working days.
          </p>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 18px' }} />

        <p className="mkt-body" style={{ fontSize: 'var(--fs-body)' }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Example</span><br />
          Catching even a <strong style={{ color: 'var(--text-1)' }}>1% margin leak</strong> on K{fmt(revenue)}/mo is{' '}
          <strong style={{ color: 'var(--text-1)' }}>K{fmt(out.leak1pct)} a month</strong>, about {out.multiple}× the price of Pro (K{fmt(PRO)}/mo).
        </p>

        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '16px 0 0', lineHeight: 1.5 }}>
          Estimates, not promises. Your numbers, your call. AI-BOS won’t invent a result it can’t see in your data.
        </p>

        <Link href="/login" className="mkt-btn mkt-btn-primary" style={{ marginTop: 18, justifyContent: 'center', width: '100%' }}>
          Start free and run it on your real numbers
        </Link>
      </div>
    </div>
  );
}
