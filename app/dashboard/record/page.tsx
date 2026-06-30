'use client';
/**
 * AI-BOS — Record (Evolution Initiative 1 + 12).
 * The everyday entry point for businesses running on AIBOS: say what happened, and
 * the Digital Twin (cash / revenue / profit) updates live. No spreadsheet required.
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import RecordActivity from '@/components/spine/RecordActivity';
import EventList from '@/components/spine/EventList';
import GrowthJourney from '@/components/spine/GrowthJourney';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { listEvents, type BusinessEvent } from '@/lib/api';

export default function RecordPage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const twin = useStore(s => s.twin);
  const refreshTwin = useStore(s => s.refreshTwin);
  const { profile, loading: profileLoading } = useProfile();
  const needsSetup = !profileLoading && profile != null && !profile.business_name;
  const [recent, setRecent] = useState<BusinessEvent[]>([]);

  const loadRecent = useCallback(() => {
    listEvents({ limit: 8 }).then(setRecent).catch(() => setRecent([]));
  }, []);

  useEffect(() => { refreshTwin(); loadRecent(); }, [refreshTwin, loadRecent]);

  const snapshot = [
    { label: 'Cash', value: twin?.cash ?? 0, color: 'var(--cyan)' },
    { label: 'Revenue', value: twin?.total_revenue ?? 0, color: 'var(--spark-revenue)' },
    { label: 'Profit', value: twin?.total_profit ?? 0, color: 'var(--green)' },
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
          Record activity
        </h1>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>
          Tell AIBOS what happened — it does the bookkeeping.
        </p>
      </div>

      {needsSetup && (
        <a href="/onboarding" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            padding: '14px 16px', borderRadius: 10, border: '1px solid var(--cyan)',
            background: 'rgba(0,212,255,0.06)',
          }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', color: 'var(--text-1)', fontWeight: 600 }}>
              Finish setting up your business — it takes a minute and seeds your starting cash.
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: 'var(--cyan)' }}>
              Set up →
            </span>
          </div>
        </a>
      )}

      <div className="grid-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionCard title="What happened?" subtitle="Plain language — AIBOS proposes, you confirm">
            <RecordActivity onSaved={loadRecent} />
          </SectionCard>

          <SectionCard title="Recent activity" subtitle="Your latest recorded events"
            action={<a href="/dashboard/timeline" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--cyan)', textDecoration: 'none' }}>View all →</a>}>
            <EventList events={recent} />
          </SectionCard>
        </div>

        {/* Live twin snapshot + growth journey */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="Live snapshot" subtitle={`${twin?.event_count ?? 0} events recorded`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {snapshot.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.label}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 600, color: s.color }}>
                  {sym}{fmt(s.value)}
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Health
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-1)' }}>
                  {twin?.health_label ?? 'No Data'}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Your AIBOS journey" subtitle="Capability grows as you record">
          <GrowthJourney />
        </SectionCard>
        </div>
      </div>
    </>
  );
}
