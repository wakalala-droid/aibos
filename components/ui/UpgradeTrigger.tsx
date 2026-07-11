'use client';

// UpgradeTrigger — surfaces an upgrade prompt ONLY at moments of demonstrated
// value (conversion_psychology.md UPGRADE TRIGGER RULE). Never on a timer,
// never a generic "upgrade now" banner. Dismissible per session.

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';

interface Trigger {
  id: string;
  headline: string;
  detail: string;
  cta: string;
  href: string;
  colour: string;
}

export default function UpgradeTrigger() {
  const { tier, monthly, anomalies, alerts, locations } = useStore();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const anomalyCount =
    (Array.isArray(anomalies) ? anomalies.length : 0) +
    (Array.isArray(alerts) ? alerts.length : 0);

  const triggers: Trigger[] = [];

  // First anomaly detected on the free tier.
  if (tier === 'free' && anomalyCount > 0) {
    triggers.push({
      id: 'anomaly',
      headline: 'We spotted something in your numbers',
      detail: 'An anomaly was flagged in your data. See exactly what’s driving it with full Engine 1.',
      cta: 'Investigate with Pro',
      href: '/checkout?plan=pro',
      colour: 'var(--warn)',
    });
  }

  // Three months of data uploaded → forecasting becomes meaningful.
  if (tier === 'free' && Array.isArray(monthly) && monthly.length >= 3) {
    triggers.push({
      id: 'forecast3mo',
      headline: `You've uploaded ${monthly.length} months of data`,
      detail: 'That’s enough history to project forward. Unlock 12-month forecasting and anomaly detection.',
      cta: 'Unlock forecasting',
      href: '/checkout?plan=pro',
      colour: 'var(--cyan)',
    });
  }

  // A second location was added → Growth territory.
  if (tier !== 'growth' && Array.isArray(locations) && locations.length >= 2) {
    triggers.push({
      id: 'multiloc',
      headline: `You're now running ${locations.length} locations`,
      detail: 'See a cross-engine score and one unified brief across every location with Growth.',
      cta: 'Compare locations',
      href: '/checkout?plan=growth',
      colour: 'var(--e3)',
    });
  }

  const active = triggers.find((t) => !dismissed.includes(t.id));
  if (!active) return null;

  return (
    <div
      role="region"
      aria-label="Upgrade suggestion"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '14px 16px', borderRadius: 12, marginBottom: 20,
        background: `color-mix(in srgb, ${active.colour} 8%, var(--bg-card))`,
        border: `1px solid color-mix(in srgb, ${active.colour} 30%, var(--border))`,
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 2px' }}>
          {active.headline}
        </p>
        <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)', margin: 0, lineHeight: 1.45 }}>
          {active.detail}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link
          href={active.href}
          style={{
            fontSize: 'var(--fs-data)', fontWeight: 700,
            color: '#fff', background: active.colour, padding: '9px 16px',
            borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          {active.cta}
        </Link>
        <button
          type="button"
          aria-label="Dismiss upgrade suggestion"
          onClick={() => setDismissed((d) => [...d, active.id])}
          style={{
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            border: '1px solid var(--border-md)', background: 'transparent',
            color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
}
