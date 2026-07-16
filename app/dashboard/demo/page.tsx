'use client';
/**
 * AIBOS — Sample business (audit §10 fix #3, the demo bridge).
 * A brand-new owner with an empty dashboard can see EXACTLY what AIBOS looks
 * like full — Zoe's Kitchen, a year of real, internally-consistent numbers —
 * then "replace with my numbers" in one tap. Read-only and clearly labelled as
 * a sample (SAFEGUARD §0.1: never mistaken for the owner's own data); it reuses
 * the genuine StrategicBriefView and demoData, so what they preview is exactly
 * what they'll get.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StrategicBriefView from '@/components/dashboard/StrategicBriefView';
import { DEMO_BRIEF, DEMO_BUSINESS } from '@/lib/demoData';

export default function DemoPage() {
  const router = useRouter();
  return (
    <>
      {/* Persistent sample banner — this is never the owner's data. */}
      <div role="note" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: '14px 16px', marginBottom: 20, borderRadius: 12,
        border: '1px solid var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
      }}>
        <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>
          🍳 <strong>This is a sample business — {DEMO_BUSINESS}.</strong> Not your data. It shows what your dashboard looks like after a few months of recording.
        </span>
        <button type="button" onClick={() => router.push('/dashboard/record')} className="touch-target"
          style={{ flexShrink: 0, padding: '9px 16px', minHeight: 40, borderRadius: 8, border: 'none', background: 'var(--cyan)', color: '#04121a', fontSize: 'var(--fs-data)', fontWeight: 700, cursor: 'pointer' }}>
          Replace with my numbers
        </button>
      </div>

      <StrategicBriefView
        kpi={DEMO_BRIEF.kpi}
        health={DEMO_BRIEF.health}
        monthly={DEMO_BRIEF.monthly}
        alerts={DEMO_BRIEF.alerts}
        scores={DEMO_BRIEF.scores}
        unifiedBrief={DEMO_BRIEF.unifiedBrief}
        sym="K"
      />

      <p style={{ textAlign: 'center', margin: '24px 0 0' }}>
        <Link href="/dashboard" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>← Back to my dashboard</Link>
      </p>
    </>
  );
}
