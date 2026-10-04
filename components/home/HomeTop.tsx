'use client';

// Home, redesigned (pilot, 4 October 2026): Mercury's calm structure with
// AIBOS's intelligence. Both modes open on it; each mode adds its own
// sections underneath.
//
//   greeting · the day · "updated just now"
//   action pills: Record, Scan a receipt, New invoice, Ask AIBOS
//   the money hero with its living line   |  where the money is
//   AIBOS's read of the day, with the ask bar
//   today's sales · getting paid · stock
//   recent activity                        |  coming up (the schedule)
//
// Every figure comes from the books (twin, recorded entries, products,
// invoices). Nothing here is decoration: what moves, moves because the books
// changed or the owner touched it.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Camera, FileText, Sparkles, CalendarPlus, ArrowUpRight, Package, Receipt } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { useAiAssistant } from '@/lib/aiAssistant';
import { industryOf } from '@/lib/industries';
import { canAccess, type Tier } from '@/lib/tiers';
import { roleAllows } from '@/lib/nav';
import { dailyFocus } from '@/lib/brief';
import { followUpProposals, dismissedFollowUps } from '@/lib/automation';
import { openRecordSheet } from '@/lib/recordSheet';
import { setPendingFile } from '@/lib/pendingFile';
import { fmt } from '@/lib/utils';
import { useBriefExtras } from '@/hooks/useBriefExtras';
import FileDrop from '@/components/ui/FileDrop';
import { OutboxChip } from '@/components/pwa/OfflineSync';
import MoneyHero from './MoneyHero';
import WhereItIs from './WhereItIs';
import ActivityFeed from './ActivityFeed';
import ComingUp from './ComingUp';
import BigMoney from './BigMoney';
import Panel from './Panel';

const ASKED_KEY = 'aibos-simple-asked-v1';

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

export default function HomeTop() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const tier = useStore((s) => s.tier) as Tier;
  const rfm = useStore((s) => s.rfm);
  const { profile, teamRole } = useProfile();
  const { sendMessage, setOpen } = useAiAssistant();
  const ind = industryOf(profile?.business_type, profile?.industry);
  const extras = useBriefExtras();

  // The twin is refreshed after every record, fix and removal: that moment
  // is when the screen last matched the books.
  const [stamp, setStamp] = useState(() => Date.now());
  useEffect(() => { setStamp(Date.now()); }, [twin]);
  const updated = useUpdatedWords(stamp);

  const seesMoney = roleAllows(teamRole, '/dashboard/cash');
  const canInvoice = roleAllows(teamRole, '/dashboard/invoices');
  const canRecord = roleAllows(teamRole, '/dashboard/record');
  const hospitality = canAccess(tier, 'hospitality');
  const canBrief = canAccess(tier, 'morning_brief');

  const twinActive = !!twin && (Number(twin.event_count) > 0 || Number(twin.cash) !== 0);
  const followUps = useMemo(() => {
    const gone = typeof window === 'undefined' ? new Set<string>() : dismissedFollowUps();
    return followUpProposals(rfm, sym, profile?.business_name).filter((f) => !gone.has(f.customerId));
  }, [rfm, sym, profile?.business_name]);

  const focus = useMemo(() => {
    if (!canBrief || !twinActive || !extras) return [] as string[];
    return dailyFocus({
      sym, twin, products: extras.products,
      salesToday: extras.salesToday, salesYesterday: extras.salesYesterday,
      expectedDeliveries: extras.expectedDeliveries,
      topFollowUp: followUps[0]?.headline ?? null,
      commitmentsToday: extras.commitmentsToday,
      overdueInvoices: extras.overdueInvoices,
    });
  }, [canBrief, twinActive, extras, sym, twin, followUps]);

  const sum = (xs: { payload?: Record<string, unknown> }[]) => xs.reduce((t, e) => t + (Number(e.payload?.amount) || 0), 0);
  const todayTotal = extras ? sum(extras.salesToday) : 0;
  const yesterdayTotal = extras ? sum(extras.salesYesterday) : 0;
  const lowStock = (extras?.products ?? []).filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? 0) <= Number(p.reorder_level));
  const receivables = Number(twin?.receivables) || 0;

  const [question, setQuestion] = useState('');
  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    setOpen(true);
    sendMessage(text);
    setQuestion('');
    try { window.localStorage.setItem(ASKED_KEY, '1'); } catch { /* private mode */ }
  };

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      {/* Greeting */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-h1)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-1)' }}>
            {greeting()}{profile?.business_name ? `, ${profile.business_name}` : ''}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>
            {today}
            {twin && <span style={{ marginLeft: 16, whiteSpace: 'nowrap' }}><span className="live-dot" aria-hidden="true" />{updated}</span>}
          </p>
          <OutboxChip style={{ marginTop: 10 }} />
        </div>
      </header>

      {/* Actions */}
      <div role="group" aria-label="Quick actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {canRecord && (
          <button type="button" className="pill pill-primary" onClick={openRecordSheet} data-tour="record-action">
            <Plus aria-hidden="true" /> Record
          </button>
        )}
        {canRecord && (
          <FileDrop variant="button" className="pill" accept="image/*" capture="environment" photo
            label="Scan a receipt" icon={<Camera aria-hidden="true" />}
            onFile={(f) => { setPendingFile(f, 'receipt'); openRecordSheet(); }} />
        )}
        {canInvoice && (
          <Link href="/dashboard/invoices?new=1" className="pill"><FileText aria-hidden="true" /> New invoice</Link>
        )}
        {hospitality && (
          <Link href="/dashboard/hospitality?new=1" className="pill"><CalendarPlus aria-hidden="true" /> New booking</Link>
        )}
        <button type="button" className="pill" onClick={() => setOpen(true)}><Sparkles aria-hidden="true" /> Ask AIBOS</button>
      </div>

      {/* The money, and where it is */}
      {seesMoney && (
        <div className="home-hero">
          <MoneyHero />
          <WhereItIs />
        </div>
      )}

      {/* AIBOS's read of the day, and the ask bar */}
      <Panel labelledBy="aibos-read-title" title={
        <h2 id="aibos-read-title" className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="avatar avatar-brand" aria-hidden="true" style={{ width: 32, height: 32 }}><Sparkles /></span>
          {focus.length > 0 ? 'AIBOS on today' : 'Ask AIBOS about your business'}
        </h2>
      }>
        {focus.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
            {focus.map((line) => (
              <p key={line} style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 1.55,
                color: line.startsWith('One thing') ? 'var(--text-1)' : 'var(--text-2)', fontWeight: line.startsWith('One thing') ? 600 : 400 }}>
                {line}
              </p>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); ask(question); }} style={{ display: 'flex', gap: 8 }} data-tour="ask-bar">
          <label htmlFor="home-ask" className="sr-only">Ask AIBOS about your business</label>
          <input id="home-ask" value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Like “${ind.prompts[0]}”`}
            style={{ flex: 1, minWidth: 0, padding: '0 18px', borderRadius: 999, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 'var(--fs-body)' }} />
          <button type="submit" className="pill pill-primary" disabled={!question.trim()}>Ask</button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {['Morning brief', ...ind.prompts.slice(0, 2)].map((p) => (
            <button key={p} type="button" className="pill pill-quiet" onClick={() => ask(p)}>{p}</button>
          ))}
        </div>
      </Panel>

      {/* Today · getting paid · stock */}
      <div className="home-trio" data-tour="today-cards">
        <Panel title="Sales today" labelledBy="sales-today-title"
          action={<Link href="/dashboard/timeline?type=Sale&period=this-week" className="icon-pill" aria-label="See sales"><ArrowUpRight aria-hidden="true" /></Link>}>
          {extras === null ? <div className="skeleton" style={{ height: 64 }} /> : (
            <>
              <BigMoney value={todayTotal} sym={sym} size="lg" roll rememberAs="today" />
              <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                {extras.salesToday.length === 0 ? 'No sales recorded yet today.'
                  : `${extras.salesToday.length} sale${extras.salesToday.length === 1 ? '' : 's'}`
                    + (yesterdayTotal > 0 ? `, ${fmt(Math.abs(todayTotal - yesterdayTotal), false, sym)} ${todayTotal >= yesterdayTotal ? 'more' : 'less'} than yesterday` : '')}
              </p>
            </>
          )}
        </Panel>

        {seesMoney && (
          <Panel title="Getting paid" labelledBy="getting-paid-title"
            action={canInvoice ? <Link href="/dashboard/invoices" className="icon-pill" aria-label="Open invoices"><Receipt aria-hidden="true" /></Link> : undefined}>
            <BigMoney value={receivables} sym={sym} size="lg" />
            <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: extras?.overdueInvoices ? 'var(--red)' : 'var(--text-3)', fontWeight: extras?.overdueInvoices ? 600 : 400 }}>
              {extras?.overdueInvoices
                ? `${extras.overdueInvoices.count} invoice${extras.overdueInvoices.count === 1 ? '' : 's'} overdue, ${fmt(extras.overdueInvoices.total, false, sym)}`
                : receivables > 0 ? 'Owed to you, nothing overdue' : 'Nobody owes you right now'}
            </p>
          </Panel>
        )}

        <Panel title={ind.stockWord.charAt(0).toUpperCase() + ind.stockWord.slice(1)} labelledBy="stock-title"
          action={<Link href="/dashboard/inventory" className="icon-pill" aria-label={`Open ${ind.stockWord}`}><Package aria-hidden="true" /></Link>}>
          {extras === null ? <div className="skeleton" style={{ height: 64 }} /> : (
            <>
              <span className="money money-lg" style={{ color: lowStock.length ? 'var(--amber)' : 'var(--text-1)' }}>
                {extras.products.length === 0 ? 'None yet' : lowStock.length ? `${lowStock.length} low` : 'All good'}
              </span>
              <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                {extras.products.length === 0 ? `Add your ${ind.stockWord} and AIBOS watches the levels.`
                  : lowStock.length ? `${lowStock.slice(0, 2).map((p) => p.name).join(', ')}${lowStock.length > 2 ? ' and more' : ''} running low`
                  : `${extras.products.length} items, none below reorder level`}
              </p>
            </>
          )}
        </Panel>
      </div>

      {/* What happened, and what is coming */}
      <div className="home-split">
        <ActivityFeed />
        <ComingUp />
      </div>
    </div>
  );
}
