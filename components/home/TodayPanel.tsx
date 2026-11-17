'use client';

// Today (17 Nov 2026 cleanup): what used to be five cards (sales today,
// getting paid, stock, recent activity, coming up) as one panel. Three
// figures across the top, each opening its page, then one list with a switch:
// what is coming up, or what just happened.

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { industryOf } from '@/lib/industries';
import { roleAllows } from '@/lib/nav';
import { fmt } from '@/lib/utils';
import { sumMoney } from '@/lib/ngwee';
import { useBriefExtras } from '@/hooks/useBriefExtras';
import Panel from './Panel';
import BigMoney from './BigMoney';
import ActivityFeed from './ActivityFeed';
import ComingUp from './ComingUp';

export default function TodayPanel() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const { profile, teamRole } = useProfile();
  const ind = industryOf(profile?.business_type, profile?.industry);
  const extras = useBriefExtras();
  const [tab, setTab] = useState<'coming' | 'recent'>('coming');

  const seesMoney = roleAllows(teamRole, '/dashboard/cash');
  const sum = (xs: { payload?: Record<string, unknown> }[]) => sumMoney(xs.map((e) => e.payload?.amount));
  const todayTotal = extras ? sum(extras.salesToday) : 0;
  const yesterdayTotal = extras ? sum(extras.salesYesterday) : 0;
  const waitingToday = extras?.salesWaitingToday?.length ?? 0;
  const products = extras?.products ?? [];
  const lowStock = products.filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? 0) <= Number(p.reorder_level));
  const receivables = Number(twin?.receivables) || 0;
  const overdue = extras?.overdueInvoices;
  // "Owed to you" is the books' figure. A sent invoice whose sale is not in
  // the books (voided on Activity, or never posted) is still overdue on the
  // Invoices page, so the two disagreed ("K0 owed, 1 invoice overdue,
  // K2,400"). Say so, and open the books check that puts it right.
  const unbooked = !!overdue && overdue.total > receivables + 0.005;
  const stockWord = ind.stockWord.charAt(0).toUpperCase() + ind.stockWord.slice(1);

  return (
    <Panel title="Today" labelledBy="today-title">
      <div className="today-figures" data-tour="today-cards">
        <Link href="/dashboard/timeline?type=Sale&period=this-week" className="today-figure">
          <span className="today-figure-label">Sales today</span>
          {extras === null ? <span className="skeleton" style={{ height: 32, width: 120 }} /> : (
            <BigMoney value={todayTotal} sym={sym} size="lg" roll rememberAs="today" />
          )}
          <span className="today-figure-sub">
            {extras === null ? '' : extras.salesToday.length === 0 ? 'Nothing recorded yet'
              : `${extras.salesToday.length} sale${extras.salesToday.length === 1 ? '' : 's'}`
                + (yesterdayTotal > 0 ? `, ${fmt(Math.abs(todayTotal - yesterdayTotal), false, sym)} ${todayTotal >= yesterdayTotal ? 'more' : 'less'} than yesterday` : '')}
            {waitingToday > 0 && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{`, ${waitingToday} waiting for you`}</span>}
          </span>
        </Link>

        {seesMoney && (
          <Link href={unbooked ? '/dashboard/cash?check=1' : '/dashboard/invoices'} className="today-figure">
            <span className="today-figure-label">Owed to you</span>
            <BigMoney value={receivables} sym={sym} size="lg" />
            <span className="today-figure-sub" style={overdue ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
              {overdue && unbooked
                ? `${overdue.count} overdue invoice${overdue.count === 1 ? '' : 's'} (${fmt(overdue.total, false, sym)}) not in your books. Check them`
                : overdue
                ? `${overdue.count} invoice${overdue.count === 1 ? '' : 's'} overdue, ${fmt(overdue.total, false, sym)}`
                : receivables > 0 ? 'Nothing overdue' : 'Nobody owes you'}
            </span>
          </Link>
        )}

        <Link href="/dashboard/inventory" className="today-figure">
          <span className="today-figure-label">{stockWord}</span>
          <span className="money money-lg">
            {extras === null ? '' : products.length === 0 ? 'None yet' : lowStock.length ? `${lowStock.length} low` : 'All good'}
          </span>
          <span className="today-figure-sub">
            {extras === null ? '' : products.length === 0 ? `Add your ${ind.stockWord} and AIBOS watches it`
              : lowStock.length ? `${lowStock.slice(0, 2).map((p) => p.name).join(', ')}${lowStock.length > 2 ? ' and more' : ''} running low`
              : `${products.length} items, none low`}
          </span>
        </Link>
      </div>

      <div className="today-switch">
        <div className="chips" role="tablist" aria-label="Today's list">
          <button type="button" role="tab" aria-selected={tab === 'coming'} className="chip" onClick={() => setTab('coming')}>Coming up</button>
          <button type="button" role="tab" aria-selected={tab === 'recent'} className="chip" onClick={() => setTab('recent')}>Just happened</button>
        </div>
        <Link href={tab === 'coming' ? '/dashboard/schedule' : '/dashboard/timeline'} className="pill pill-quiet" style={{ minHeight: 44 }}>
          {tab === 'coming' ? 'Schedule' : 'See all'}
        </Link>
      </div>
      <div role="tabpanel">
        {tab === 'coming' ? <ComingUp bare limit={4} /> : <ActivityFeed bare limit={5} />}
      </div>
    </Panel>
  );
}
