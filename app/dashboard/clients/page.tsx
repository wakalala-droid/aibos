'use client';

// Find clients (5 Nov 2026; every plan since 7 Nov): AIBOS finds businesses
// that could buy from the owner (the map around a town, or a list they paste),
// reads their websites, says which fit and why, and writes the first message,
// the follow-ups and the answer to a reply. It never sends: each message opens
// in the owner's own email or WhatsApp. The API is aibos-api
// find_clients_routes.py.
//
// The plans differ only in how many businesses a month are researched (20,
// 50, 100 and 300: FIND_CLIENTS_PER_MONTH). Staff use it on the owner's plan;
// the accountant only reads.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import FeatureGate from '@/components/ui/FeatureGate';
import { Note, Segmented } from '@/components/hospitality/kit';
import TodayTab from '@/components/clients/TodayTab';
import BusinessesTab from '@/components/clients/BusinessesTab';
import CampaignsTab from '@/components/clients/CampaignsTab';
import SettingsTab from '@/components/clients/SettingsTab';
import { ApiError, getClients, type ClientsHome } from '@/lib/api';
import { useStore } from '@/lib/store';

type Tab = 'today' | 'businesses' | 'campaigns' | 'settings';

const HEADLINE = 'AIBOS can find businesses that could buy from you';

export default function FindClientsPage() {
  const tier = useStore((s) => s.tier);
  const [home, setHome] = useState<ClientsHome | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [startedHere, setStartedHere] = useState(false);

  const load = useCallback(async () => {
    try {
      const got = await getClients();
      setHome(got);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof ApiError && e.status === 503 && e.message
        ? e.message
        : 'Find clients could not be opened just now. Try again in a moment.');
    }
  }, []);

  useEffect(() => { void load(); }, [load, tier]);

  // While a search or research runs on the server, look again every few seconds.
  const running = Boolean(home && !home.preview && home.job?.running);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(t);
  }, [running, load]);

  const allowance = home?.allowance ?? 20;
  const detail = `It reads their websites, says which fit and writes the first message for you to send from your own email or WhatsApp. ${allowance} businesses a month on your plan.`;

  // Messages to send and replies with no answer drafted yet (a reply whose
  // answer is waiting is counted once, as the answer).
  const waitingOnYou = home && !home.preview
    ? home.drafts.length + home.needs_you.filter((n) => !n.answer_waiting).length
    : 0;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'businesses', label: 'Businesses' },
    { value: 'campaigns', label: 'Campaigns' },
    ...(home && !home.preview && home.is_owner ? [{ value: 'settings' as Tab, label: 'Settings' }] : []),
  ];

  return (
    <div className="rooms">
      <PageHeader
        title="Find clients"
        subtitle="Businesses that could buy from you, found and written to. You send from your own email or WhatsApp."
      />
      {failed && <Note tone="bad">{failed}</Note>}
      {!home && !failed && <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />}

      {home && (
        <FeatureGate feature="find_clients" title="Find clients" colour="var(--cyan)" headline={HEADLINE} detail={detail}>
          {home.preview ? (
            // The plan on this device says Growth and the server does not (a
            // lapsed plan): say so rather than draw half a page.
            <Note tone="warn">
              Your plan does not include Find clients right now. <Link href="/dashboard/billing">Plan & billing</Link> shows why.
            </Note>
          ) : (
            <>
              {!home.can_write && (
                <Note tone="info">You can see Find clients. The owner and staff find businesses and write to them.</Note>
              )}
              <div style={{ margin: '4px 0 16px' }}>
                <Segmented<Tab> label="Find clients" value={tab} onChange={setTab}
                  options={tabs.map((t) => (t.value === 'today' && waitingOnYou > 0
                    ? { ...t, label: `Today (${waitingOnYou})` }
                    : t))} />
              </div>
              {tab === 'today' && (
                <TodayTab home={home} reload={load} startedHere={startedHere} onStarted={() => setStartedHere(true)} />
              )}
              {tab === 'businesses' && <BusinessesTab home={home} reload={load} />}
              {tab === 'campaigns' && <CampaignsTab home={home} reload={load} />}
              {tab === 'settings' && home.is_owner && <SettingsTab home={home} reload={load} />}
            </>
          )}
        </FeatureGate>
      )}
    </div>
  );
}
