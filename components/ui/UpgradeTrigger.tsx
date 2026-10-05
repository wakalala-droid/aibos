'use client';

// UpgradeTrigger — surfaces an upgrade prompt ONLY at moments of demonstrated
// value (conversion_psychology.md UPGRADE TRIGGER RULE). Never on a timer,
// never a generic "upgrade now" banner. Dismissible per session.

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
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
      detail: 'AIBOS spotted a month that broke your pattern. See exactly what is driving it.',
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
      detail: 'That is enough history to look ahead. Unlock the year-ahead forecast and unusual-month alerts.',
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

  // A bento card (5 Oct 2026), monochrome: round mark, spaced-capital title,
  // the plan as its tag, one plain sentence and one button.
  return (
    <section role="region" aria-label="Upgrade suggestion" className="bento" style={{ marginBottom: 24 }}>
      <div className="bento-head">
        <span className="bento-icon" aria-hidden="true"><Sparkles /></span>
        <div className="bento-main">
          <div className="bento-titlerow">
            <p className="bento-title">{active.headline}</p>
            <button type="button" className="icon-pill" aria-label="Dismiss upgrade suggestion"
              onClick={() => setDismissed((d) => [...d, active.id])} style={{ marginLeft: 'auto', background: 'transparent' }}>
              <X aria-hidden="true" />
            </button>
          </div>
          <p className="bento-text">{active.detail}</p>
        </div>
      </div>
      <div className="bento-foot">
        <Link href={active.href} className="pill pill-primary">{active.cta}</Link>
      </div>
    </section>
  );
}
