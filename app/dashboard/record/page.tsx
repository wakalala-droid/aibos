'use client';
/**
 * AIBOS — Record (Evolution Initiative 1 + 12).
 * The everyday entry point for businesses running on AIBOS: say what happened, and
 * the Digital Twin (cash / revenue / profit) updates live. No spreadsheet required.
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import RecordActivity from '@/components/spine/RecordActivity';
import EventList from '@/components/spine/EventList';
import { OutboxChip } from '@/components/pwa/OfflineSync';
import GrowthJourney from '@/components/spine/GrowthJourney';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { listEvents, type BusinessEvent } from '@/lib/api';
import BigMoney from '@/components/home/BigMoney';
import PageHeader from '@/components/ui/PageHeader';

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
    { label: 'Cash', value: twin?.cash ?? 0 },
    { label: 'Sales so far', value: twin?.total_revenue ?? 0 },
    { label: 'Profit so far', value: twin?.total_profit ?? 0 },
  ];

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <PageHeader
          title="Record"
          subtitle="Tell AIBOS what happened: it does the bookkeeping."
          actions={<a href="/dashboard/import" className="pill">Upload a spreadsheet</a>}
        />
        <OutboxChip style={{ marginTop: -16, marginBottom: 8 }} />
      </div>

      {needsSetup && (
        <a href="/onboarding" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--cyan-dim)',
          }}>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', fontWeight: 600 }}>
              Finish setting up your business: it takes a minute and seeds your starting cash.
            </span>
            <span className="pill pill-primary">Set up</span>
          </div>
        </a>
      )}

      <div className="grid-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="What happened?" subtitle="In your own words. AIBOS fills in the details and you check them.">
            <RecordActivity onSaved={loadRecent} />
          </SectionCard>

          <SectionCard title="Recent activity"
            action={<a className="pill pill-quiet" href="/dashboard/timeline">See all</a>}>
            <EventList events={recent} onChanged={() => { loadRecent(); refreshTwin(); }} />
          </SectionCard>
        </div>

        {/* Live twin snapshot + growth journey */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionCard title="Right now" subtitle={`${twin?.event_count ?? 0} ${(twin?.event_count ?? 0) === 1 ? 'entry' : 'entries'} recorded`}>
          <div>
            {snapshot.map(s => (
              <div key={s.label} className="row" style={{ minHeight: 48 }}>
                <span className="row-main"><span className="row-title" style={{ fontWeight: 500, color: 'var(--text-2)' }}>{s.label}</span></span>
                <BigMoney value={s.value} sym={sym} size="md" roll />
              </div>
            ))}
            <div className="row" style={{ minHeight: 48 }}>
              <span className="row-main"><span className="row-title" style={{ fontWeight: 500, color: 'var(--text-2)' }}>Health</span></span>
              <span className="row-amount">{twin?.health_label ?? 'Not enough yet'}</span>
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
