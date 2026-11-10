'use client';

// Find clients (5 Nov 2026): AIBOS finds businesses that could buy from the
// owner (from its own directory of places around a town, or a list they
// paste), reads their websites, says which fit and why, and writes the first
// message, the follow-ups and the answer to a reply. It never sends: each
// message opens in the owner's own email, WhatsApp or LinkedIn (10 Nov 2026:
// AIBOS never opens LinkedIn itself; it copies the note and opens their page
// or a search). The API is aibos-api find_clients_routes.py.
//
// Priced the way Explee prices it (9 Nov 2026): Free gets one free day
// (FIND_CLIENTS_TRIAL), the paid plans a month's businesses (50, 100 and 300:
// FIND_CLIENTS_PER_MONTH), and anyone can top up by card
// (FIND_CLIENTS_TOPUPS). The SERVER decides whether the page opens: a Free
// account on its free day or with credits gets the whole page even though its
// plan does not list the feature. Staff use it on the owner's plan; the
// accountant only reads.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import FeatureGate from '@/components/ui/FeatureGate';
import { Note, Segmented } from '@/components/hospitality/kit';
import Panel from '@/components/home/Panel';
import TodayTab from '@/components/clients/TodayTab';
import TopUp, { topupWords } from '@/components/clients/TopUp';
import BusinessesTab from '@/components/clients/BusinessesTab';
import CampaignsTab from '@/components/clients/CampaignsTab';
import SettingsTab from '@/components/clients/SettingsTab';
import { ApiError, getClients, type ClientsHome, type ClientsPreview } from '@/lib/api';
import { FIND_CLIENTS_PER_MONTH, FIND_CLIENTS_TRIAL } from '@/lib/tiers';
import { plural } from '@/components/clients/shared';
import { useStore } from '@/lib/store';

type Tab = 'today' | 'businesses' | 'campaigns' | 'settings';

const HEADLINE = 'AIBOS can find businesses that could buy from you';

/**
 * A Free account's free day is over and nothing is left: what it found and
 * wrote is kept, and the owner can top up or choose a plan to carry on.
 */
function FreeDayOver({ home, reload }: { home: ClientsPreview; reload: () => Promise<void> }) {
  const kept = home.kept ?? { businesses: 0, drafts: 0 };
  const trial = home.usage?.trial;
  const pro = home.allowances?.pro ?? FIND_CLIENTS_PER_MONTH.pro;
  return (
    <Panel title="Your free day has ended">
      <p className="rs-text">
        {trial && trial.used > 0
          ? `On your free day AIBOS researched ${plural(trial.used, 'business', 'businesses')} and wrote to the ones that fit. `
          : ''}
        To carry on, top up {topupWords(home.topups ?? home.usage?.topups)}. They never run out.
      </p>
      {(kept.businesses > 0 || kept.drafts > 0) && (
        <p className="rs-text is-quiet">
          AIBOS kept the {plural(kept.businesses, 'business', 'businesses')} it found
          {kept.drafts > 0 ? ` and the ${plural(kept.drafts, 'message')} it wrote` : ''}. They are here when you carry on.
        </p>
      )}
      {home.is_owner ? (
        <div style={{ marginTop: 14 }}>
          <TopUp packs={home.topups ?? home.usage?.topups} bought={home.usage?.topup.bought ?? 0} reload={reload} />
          <p className="rs-text is-quiet" style={{ marginTop: 12 }}>
            Or <Link href="/dashboard/billing">see the plans</Link>: Pro researches {pro} businesses every month.
          </p>
        </div>
      ) : (
        <p className="rs-text is-quiet" style={{ marginTop: 12 }}>Ask the owner to top up or choose a plan to carry on.</p>
      )}
    </Panel>
  );
}

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

  const trialHours = home?.trial_hours ?? FIND_CLIENTS_TRIAL.hours;
  const detail = `It reads their websites, says which fit and writes the first message for you to send from your own email, WhatsApp or LinkedIn. Try it free for ${trialHours} hours, then top up or choose a plan.`;

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
        subtitle="Businesses that could buy from you, found and written to. You send from your own email, WhatsApp or LinkedIn."
      />
      {failed && <Note tone="bad">{failed}</Note>}
      {!home && !failed && <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />}

      {home?.preview && home.reason === 'free_day_over' && <FreeDayOver home={home} reload={load} />}
      {home?.preview && home.reason !== 'free_day_over' && (
        <FeatureGate feature="find_clients" title="Find clients" colour="var(--cyan)" headline={HEADLINE} detail={detail}>
          {/* The plan on this device has Find clients and the server could not
              say so: say that rather than draw half a page. */}
          <Note tone="warn">
            {home.reason === 'unreadable'
              ? 'Your plan could not be read just now, so Find clients is closed for a moment. Try again in a minute.'
              : <>Your plan does not include Find clients right now. <Link href="/dashboard/billing">Plan & billing</Link> shows why.</>}
          </Note>
        </FeatureGate>
      )}

      {/* Open: the server says so (a plan with it, Free's free day or credits
          bought), whatever the plan on this device lists. */}
      {home && !home.preview && (
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
    </div>
  );
}
