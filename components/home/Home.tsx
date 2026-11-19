'use client';

// Home (17 Nov 2026 cleanup): one home for everyone, five blocks.
//
// Before this, the Full home had about 40 cards and the Simple home 16, and
// eight different blocks all said "here is what to do". Hick's law: the more
// choices on a screen, the longer each one takes. So the home now asks for
// one thing at a time:
//
//   1. the greeting, the one thing today, Record and Talk
//   2. Needs you: the only to-do list, one line when nothing needs the owner
//      (moved up by the UX audit the same day)
//   3. the AIBOS team: the whole scene, edge to edge (HomeTeam), for owners
//      whose plan has it; on other plans it comes last, asleep. On a phone
//      the money comes before it (the scene is most of a phone screen and
//      the money is what the owner opens Home for).
//   4. the money: the figure and its line, where it is, the 13-week watch
//   5. Today: sales, money owed and stock, then coming up or just happened
//
// The AIBOS team page folded into Home the same day (/dashboard/team sends
// here): the owner works with the team where they already are.
//
// The numbers (scores, the month figures, the chart, the findings) moved to
// Your numbers (/dashboard/numbers). Above the five blocks, at most one
// nudge (teach AIBOS, unlock the brief, a milestone), never three, and none
// while the layout shows a plan notice (globals.css .layout-nudge).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Mic, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess, type Tier } from '@/lib/tiers';
import { roleAllows } from '@/lib/nav';
import { dailyFocus } from '@/lib/brief';
import { followUpProposals, dismissedFollowUps } from '@/lib/automation';
import { openRecordSheet } from '@/lib/recordSheet';
import { startTalk } from '@/lib/talkEvent';
import { useBriefExtras } from '@/hooks/useBriefExtras';
import { OutboxChip } from '@/components/pwa/OfflineSync';
import { TOUR_RESTART_EVENT } from '@/components/onboarding/DashboardTour';
import MilestoneBanner from '@/components/dashboard/MilestoneBanner';
import ActivationProgress from '@/components/dashboard/ActivationProgress';
import WelcomeBack from '@/components/home/WelcomeBack';
import BooksRhythm from '@/components/home/BooksRhythm';
import BriefTrialEnded from '@/components/dashboard/BriefTrialEnded';
import { useBriefTrial, dayWords } from '@/lib/briefTrial';
import TeachAibosCard from '@/components/dashboard/TeachAibosCard';
import MoneyHero from './MoneyHero';
import WhereItIs from './WhereItIs';
import CashWatch from './CashWatch';
import NeedsYou from './NeedsYou';
import TodayPanel from './TodayPanel';
import HomeTeam from './HomeTeam';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Updated just now" / "Updated 3 minutes ago", ticking while the page is open. */
function useUpdatedWords(stamp: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const mins = Math.max(0, Math.floor((now - stamp) / 60_000));
  return mins < 1 ? 'Updated just now' : mins === 1 ? 'Updated a minute ago' : mins < 60 ? `Updated ${mins} minutes ago` : 'Updated over an hour ago';
}

export default function Home() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const tier = useStore((s) => s.tier) as Tier;
  const rfm = useStore((s) => s.rfm);
  const { profile, teamRole } = useProfile();
  const extras = useBriefExtras();
  // The brief's 14 free days after the first-week goal (lib/briefTrial).
  const trial = useBriefTrial();
  const briefOn = canAccess(tier, 'morning_brief') || !!trial?.active;

  // The twin is refreshed after every record, fix and removal: that moment
  // is when the screen last matched the books.
  const [stamp, setStamp] = useState(() => Date.now());
  useEffect(() => { setStamp(Date.now()); }, [twin]);
  const updated = useUpdatedWords(stamp);

  const seesMoney = roleAllows(teamRole, '/dashboard/cash');
  const canRecord = roleAllows(teamRole, '/dashboard/record');
  const owner = !teamRole || teamRole === 'owner';
  const teamFirst = owner && canAccess(tier, 'chat_actions');

  // The one thing today, from the morning brief's own reading of the day.
  const twinActive = !!twin && (Number(twin.event_count) > 0 || Number(twin.cash) !== 0);
  const oneThing = useMemo(() => {
    if (!briefOn || !twinActive || !extras) return null;
    const gone = typeof window === 'undefined' ? new Set<string>() : dismissedFollowUps();
    const followUps = followUpProposals(rfm, sym, profile?.business_name).filter((f) => !gone.has(f.customerId));
    const lines = dailyFocus({
      sym, twin, products: extras.products,
      salesToday: extras.salesToday, salesYesterday: extras.salesYesterday,
      expectedDeliveries: extras.expectedDeliveries,
      topFollowUp: followUps[0]?.headline ?? null,
      commitmentsToday: extras.commitmentsToday,
      overdueInvoices: extras.overdueInvoices,
    });
    const line = lines.find((l) => l.startsWith('One thing today: '));
    if (!line) return null;
    // The brief writes it mid-sentence ("chase the K2,350 ..."); on its own
    // line under the eyebrow it starts a sentence.
    const said = line.slice('One thing today: '.length);
    return said.charAt(0).toUpperCase() + said.slice(1);
  }, [briefOn, twinActive, extras, sym, twin, rfm, profile?.business_name]);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="home">
      {/* At most one nudge: the first of these that has something to say.
          Welcome back leads (three days away is when a habit ends), then the
          first-week goal and the brief's ending: each lasts days, where Teach
          waits until it is answered. */}
      <div className="one-nudge">
        <WelcomeBack />
        <ActivationProgress />
        <BriefTrialEnded />
        <TeachAibosCard />
        <MilestoneBanner />
      </div>

      {/* 1. The greeting, the one thing today, Record and Talk */}
      <header className="home-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="home-hello">
            {greeting()}{profile?.business_name ? `, ${profile.business_name}` : ''}
          </h1>
          <p className="home-date">
            {today}
            {twin && <span style={{ marginLeft: 16, whiteSpace: 'nowrap' }}><span className="live-dot" aria-hidden="true" />{updated}</span>}
          </p>
          {canRecord && <BooksRhythm />}
          {oneThing && (
            <p className="home-one-thing">
              <span className="eyebrow">
                One thing today
                {trial?.active && trial.endsOn && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{` · free until ${dayWords(trial.endsOn)}`}</span>}
              </span>
              {oneThing}
            </p>
          )}
          <OutboxChip style={{ marginTop: 10 }} />
        </div>
        <div className="home-acts" role="group" aria-label="Quick actions">
          {canRecord && (
            <button type="button" className="pill pill-primary" onClick={openRecordSheet} data-tour="record-action">
              <Plus aria-hidden="true" /> Record
            </button>
          )}
          <button type="button" className="pill" onClick={startTalk} data-tour="ask-bar">
            <Mic aria-hidden="true" /> Talk to AIBOS
          </button>
        </div>
      </header>

      {/* 2. Needs you: the only to-do list, first after the greeting (UX
          audit 17 Nov 2026). One line when nothing does. */}
      {seesMoney && <NeedsYou />}

      {/* 3. The AIBOS team, edge to edge */}
      {teamFirst && <HomeTeam first />}

      {/* 4. The money */}
      {seesMoney && (
        <>
          <div className="home-hero">
            <MoneyHero />
            <WhereItIs />
          </div>
          <CashWatch />
        </>
      )}

      {/* 5. Today */}
      <div className="home-today"><TodayPanel /></div>

      {/* Plans without the team: the team asleep, last */}
      {owner && !teamFirst && <HomeTeam />}

      <nav className="home-foot" aria-label="More">
        {seesMoney && <Link href="/dashboard/numbers" className="pill pill-quiet">Your numbers</Link>}
        {roleAllows(teamRole, '/dashboard/brief') && <Link href="/dashboard/brief" className="pill pill-quiet">Briefs</Link>}
        <button type="button" className="pill pill-quiet" onClick={() => window.dispatchEvent(new Event(TOUR_RESTART_EVENT))}>
          Take the tour again
        </button>
      </nav>
    </div>
  );
}
