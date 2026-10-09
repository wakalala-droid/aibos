'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, Calculator } from 'lucide-react';
import { BentoCard } from '@/components/kit';
import { TIERS } from '@/lib/tiers';
import { useZmwRate } from '@/lib/planPrice';

// Honest, RANGED outputs only — no fabricated precision (conversion_psychology.md
// + the SAFEGUARD no-fabrication ethos). Every figure is shown as an estimate or
// a clearly-labelled example the visitor can check against their own numbers.

// Pro's price in US dollars (single source of truth: lib/tiers.ts). The visitor's
// revenue is in Kwacha, so the comparison converts it at today's rate, and
// leaves the comparison out rather than guess when there is no rate.
const PRO_USD = TIERS.pro.priceMonthly;

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
  const { rate } = useZmwRate();
  const proK = rate ? PRO_USD * rate.rate : null;

  const out = useMemo(() => {
    const hoursMonth = hours * 4.3;
    const hoursLow = Math.round(hoursMonth * 0.5);
    const hoursHigh = Math.round(hoursMonth * 0.7);
    const daysLow = (hoursLow / 8).toFixed(1);
    const daysHigh = (hoursHigh / 8).toFixed(1);
    const leak1pct = Math.round(revenue * 0.01);
    const multiple = proK ? Math.max(1, Math.round(leak1pct / proK)) : null;
    return { hoursLow, hoursHigh, daysLow, daysHigh, leak1pct, multiple };
  }, [revenue, hours, proK]);

  // Two kit bento cards: what you tell it, and the estimate it gives back.
  return (
    <div className="bento-grid">
      <BentoCard className="span-3" icon={<SlidersHorizontal />} title="Your business, roughly" motion="tilt">
        <div style={{ marginTop: 20 }}>
          <Field label="Monthly revenue" suffix="K" value={revenue} min={5000} max={1000000} step={5000} onChange={setRevenue} />
          <Field label="Hours a week on spreadsheets and reports" suffix="hrs" value={hours} min={1} max={40} step={1} onChange={setHours} />
          <p className="bento-note">Drag to match your business. Nothing is sent anywhere: this runs in your browser.</p>
        </div>
      </BentoCard>

      <BentoCard
        className="span-3"
        icon={<Calculator />}
        title="A rough estimate"
        tag="Estimate"
        motion="pulse"
        foot={
          <Link href="/login" className="pill pill-primary" style={{ width: '100%' }}>
            Start free and run it on your real numbers
          </Link>
        }
      >
        <p className="bento-figure" style={{ marginTop: 16 }}>{out.hoursLow} to {out.hoursHigh} hours</p>
        <p className="bento-note">
          likely back in your month once the reporting runs itself, about {out.daysLow} to {out.daysHigh} working days.
        </p>
        <p className="bento-note" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          Catching even a <strong>1% margin leak</strong> on K{fmt(revenue)} a month is{' '}
          <strong>K{fmt(out.leak1pct)} a month</strong>
          {out.multiple && proK
            ? <>, about {out.multiple} times the price of Pro (${PRO_USD} a month, about K{fmt(proK)} at today’s rate).</>
            : <>. Pro costs ${PRO_USD} a month.</>}
        </p>
        <p className="mkt-preview-cap" style={{ marginTop: 12 }}>
          Estimates, not promises. AIBOS will not invent a result it cannot see in your numbers.
        </p>
      </BentoCard>
    </div>
  );
}
