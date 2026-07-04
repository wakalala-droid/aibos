'use client';

// SimpleHome — the Simple-mode front door (/dashboard when uiMode === 'simple').
//
// One screen that answers the three questions every owner actually asks —
// "how much money do I have?", "how is today going?", "is anything wrong?" —
// in plain language, from real recorded data, with an ask-bar straight into
// the assistant. No engine jargon; the Pro dashboards stay one toggle away.
//
// Trust rule (SAFEGUARD §0.1): every number here comes from the twin, the
// product catalog or recorded events. Missing data shows an honest empty
// state, never a fabricated figure.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { useAiAssistant } from '@/lib/aiAssistant';
import { industryOf } from '@/lib/industries';
import { TOUR_RESTART_EVENT } from '@/components/onboarding/DashboardTour';
import { fmt } from '@/lib/utils';
import { canAccess } from '@/lib/tiers';
import { bucketSales, expectedOf, dailyFocus } from '@/lib/brief';
import {
  reorderProposals, draftReorder, followUpProposals, dismissedFollowUps, dismissFollowUp,
  type ReorderProposal,
} from '@/lib/automation';
import { OutboxChip } from '@/components/pwa/OfflineSync';
import BorderGlow from '@/components/ui/BorderGlow';
import { listEvents, listProducts, type BusinessEvent, type Product } from '@/lib/api';

const ASKED_KEY = 'aibos-simple-asked-v1';

// React Bits cursor edge-glow + mesh gradient, tuned identically to KPICard /
// SectionCard — Simple mode shares the dashboard's one visual language.
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

function Glow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <BorderGlow
      glowColor={CURSOR_GLOW}
      backgroundColor="var(--bg-card)"
      borderRadius={14}
      glowRadius={48}
      glowIntensity={1.2}
      coneSpread={12}
      colors={MESH}
      style={{ height: '100%', ...style }}
    >
      {children}
    </BorderGlow>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Inner-panel layout only — the BorderGlow wrapper plus the section-card /
// kpi-card `glow-inner` classes draw the chrome (border, sheen, bento texture).
const cardStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  textDecoration: 'none',
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', fontWeight: 600,
  color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em',
};

const valueStyle: React.CSSProperties = {
  fontFamily: 'Geist, sans-serif', fontSize: '1.55rem', fontWeight: 700,
  color: 'var(--text-1)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
};

const subStyle: React.CSSProperties = {
  fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.45,
};

export default function SimpleHome() {
  const twin = useStore((s) => s.twin);
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const setUiMode = useStore((s) => s.setUiMode);
  const { profile } = useProfile();
  const { sendMessage, setOpen } = useAiAssistant();

  const ind = industryOf(profile?.business_type, profile?.industry);
  const money = useCallback((n: number) => fmt(n, true, sym), [sym]);

  // Live detail the twin doesn't carry: item-level stock, recent sales, and
  // deliveries the owner is expecting (pending receipts dated today+).
  const [products, setProducts] = useState<Product[] | null>(null);
  const [todaySales, setTodaySales] = useState<BusinessEvent[] | null>(null);
  const [yesterdaySales, setYesterdaySales] = useState<BusinessEvent[]>([]);
  const [expected, setExpected] = useState<BusinessEvent[]>([]);
  const [asked, setAsked] = useState(true); // assume done until localStorage says otherwise
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, e, r] = await Promise.allSettled([
        listProducts(),
        listEvents({ event_type: 'Sale', limit: 300 }),
        listEvents({ event_type: 'InventoryReceipt', status: 'pending', limit: 50 }),
      ]);
      if (!alive) return;
      setProducts(p.status === 'fulfilled' ? p.value : []);
      const { today, yesterday } = bucketSales(e.status === 'fulfilled' ? e.value : []);
      setTodaySales(e.status === 'fulfilled' ? today : []);
      setYesterdaySales(yesterday);
      setExpected(expectedOf(r.status === 'fulfilled' ? r.value : []));
    })();
    try { setAsked(window.localStorage.getItem(ASKED_KEY) === '1'); } catch { /* private mode */ }
    return () => { alive = false; };
  }, []);

  const [question, setQuestion] = useState('');
  const ask = useCallback((q: string) => {
    const text = q.trim();
    if (!text) return;
    setOpen(true);
    sendMessage(text);
    setQuestion('');
    try { window.localStorage.setItem(ASKED_KEY, '1'); } catch { /* private mode */ }
    setAsked(true);
  }, [sendMessage, setOpen]);

  const tier = useStore((s) => s.tier);
  const canBrief = canAccess(tier, 'morning_brief');
  const canAutomate = canAccess(tier, 'automation');

  const twinActive = !!twin && (Number(twin.event_count) > 0 || Number(twin.cash) !== 0);
  const eventCount = Number(twin?.event_count) || 0;
  const cash = Number(twin?.cash) || 0;
  const receivables = Number(twin?.receivables) || 0;
  const payables = Number(twin?.payables) || 0;

  // Drifting customers worth a check-in (Engine 2 × automation). Dismissals
  // live on-device and expire after a week.
  const rfm = useStore((s) => s.rfm);
  const [fuDismissed, setFuDismissed] = useState<Set<string>>(new Set());
  useEffect(() => { setFuDismissed(dismissedFollowUps()); }, []);
  const followUps = useMemo(
    () => followUpProposals(rfm, sym, profile?.business_name).filter((f) => !fuDismissed.has(f.customerId)),
    [rfm, sym, profile?.business_name, fuDismissed],
  );

  // Zero-click focus: the day's story is ready before the owner asks (Pro+).
  const focus = useMemo(() => {
    if (!canBrief || !twinActive) return [];
    return dailyFocus({
      sym, twin, products: products ?? [],
      salesToday: todaySales ?? [], salesYesterday: yesterdaySales,
      expectedDeliveries: expected,
      topFollowUp: followUps[0]?.headline ?? null,
    });
  }, [canBrief, twinActive, sym, twin, products, todaySales, yesterdaySales, expected, followUps]);

  // Anticipated work: reorders AIBOS has prepared. Computed in memory — nothing
  // touches the books until the owner taps Draft (propose → confirm, always).
  const proposals = useMemo(() => reorderProposals(products ?? []), [products]);
  const [draftState, setDraftState] = useState<Record<string, 'drafting' | 'done' | 'error'>>({});
  const onFollowUpDone = useCallback((customerId: string) => {
    dismissFollowUp(customerId);
    setFuDismissed((prev) => new Set([...prev, customerId]));
  }, []);
  const onDraft = useCallback(async (p: ReorderProposal) => {
    setDraftState((s) => ({ ...s, [p.productId]: 'drafting' }));
    try {
      const ev = await draftReorder(p);
      setDraftState((s) => ({ ...s, [p.productId]: 'done' }));
      setExpected((e) => [...e, ev]); // feeds the focus card + deliveries instantly
    } catch {
      setDraftState((s) => ({ ...s, [p.productId]: 'error' }));
    }
  }, []);

  const lowStock = useMemo(
    () => (products ?? []).filter((p) => Number(p.reorder_level) > 0 && Number(p.on_hand ?? 0) <= Number(p.reorder_level)),
    [products],
  );
  const todayTotal = useMemo(
    () => (todaySales ?? []).reduce((sum, ev) => sum + (Number(ev.payload?.amount) || 0), 0),
    [todaySales],
  );

  // Getting-started checklist — real signals only, hidden once complete.
  const steps = [
    { done: eventCount > 0, label: 'Record your first activity', href: '/dashboard/record' },
    { done: (products?.length ?? 0) > 0, label: `Add your ${ind.stockWord}`, href: '/dashboard/inventory' },
    { done: asked, label: 'Ask AIBOS a question', href: null },
  ];
  const showChecklist = products !== null && steps.some((s) => !s.done);

  // "AIBOS is handling this" — honest automation receipts from real data.
  const handled: string[] = [];
  if (eventCount > 0) handled.push(`Your books: ${eventCount} event${eventCount === 1 ? '' : 's'} recorded — cash, ${ind.stockWord} and money owed update themselves.`);
  if (products && products.length > 0) {
    handled.push(lowStock.length > 0
      ? `Watching your ${ind.stockWord}: ${lowStock.length} item${lowStock.length === 1 ? '' : 's'} at or below reorder level.`
      : `Watching your ${ind.stockWord}: all ${products.length} items above their reorder levels.`);
  }
  if (twin?.health_label) handled.push(`Business health: ${twin.health_label}.`);

  const fade = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, delay: i * 0.05, ease: 'easeOut' as const },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Greeting */}
      <motion.div {...fade(0)}>
        <h1 style={{
          fontFamily: 'Geist, sans-serif', fontSize: '1.65rem', fontWeight: 700,
          color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0,
        }}>
          {greeting()}{profile?.business_name ? `, ${profile.business_name}` : ''}.
        </h1>
        <p style={{ ...subStyle, marginTop: 6, fontSize: '0.86rem' }}>
          {twinActive
            ? `Here's where your ${ind.label} stands. Ask me anything — I'm keeping the books.`
            : `Let's get your ${ind.label} set up — record what happens and I'll do the rest.`}
        </p>
        <OutboxChip style={{ marginTop: 10 }} />
      </motion.div>

      {/* Today's focus — the day's story, ready before the owner asks (Pro+). */}
      {focus.length > 0 && (
        <motion.div {...fade(1)}>
          <Glow style={{ borderColor: 'color-mix(in srgb, var(--cyan) 25%, var(--border))' }}>
            <div className="section-card glow-inner" style={{ ...cardStyle, gap: 8 }}>
              <span className="bento-tex" aria-hidden="true" />
              <span style={labelStyle}>Today&rsquo;s focus</span>
              {focus.map((line) => (
                <span
                  key={line}
                  style={{
                    ...subStyle,
                    color: line.startsWith('One thing') ? 'var(--text-1)' : 'var(--text-3)',
                    fontWeight: line.startsWith('One thing') ? 600 : 400,
                  }}
                >
                  {line}
                </span>
              ))}
            </div>
          </Glow>
        </motion.div>
      )}

      {/* Ask bar */}
      <motion.div {...fade(1)} data-tour="ask-bar">
        <form
          onSubmit={(e) => { e.preventDefault(); ask(question); }}
          style={{ display: 'flex', gap: 8 }}
        >
          <label htmlFor="simple-ask" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Ask AIBOS about your business
          </label>
          <input
            id="simple-ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask about your ${ind.label} — “${ind.prompts[0]}”`}
            style={{
              flex: 1, height: 46, padding: '0 16px', borderRadius: 10,
              border: '1px solid var(--border-md)', background: 'var(--bg-card)',
              color: 'var(--text-1)', fontFamily: 'Geist, sans-serif', fontSize: '0.9rem',
              outline: 'none', minWidth: 0,
            }}
          />
          <button
            type="submit"
            disabled={!question.trim()}
            style={{
              height: 46, padding: '0 18px', borderRadius: 10, border: 'none',
              background: question.trim() ? 'var(--cyan)' : 'var(--bg-badge)',
              color: question.trim() ? '#fff' : 'var(--text-4)',
              fontFamily: 'Geist, sans-serif', fontSize: '0.86rem', fontWeight: 700,
              cursor: question.trim() ? 'pointer' : 'default', transition: 'all 0.15s ease',
            }}
          >
            Ask
          </button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => ask('Morning brief')}
            style={{
              padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
              border: '1px solid color-mix(in srgb, var(--cyan) 40%, transparent)',
              background: 'var(--cyan-dim)', color: 'var(--cyan)',
              fontFamily: 'Geist, sans-serif', fontSize: '0.76rem', fontWeight: 700,
            }}
          >
            Morning Brief
          </button>
          {ind.prompts.slice(0, 3).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => ask(p)}
              style={{
                padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
                border: '1px solid var(--border-md)', background: 'var(--bg-badge)',
                color: 'var(--text-2)', fontFamily: 'Geist, sans-serif', fontSize: '0.76rem',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </motion.div>

      {/* The three questions that matter */}
      <motion.div
        {...fade(2)}
        data-tour="today-cards"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}
      >
        <Glow>
        <Link href="/dashboard/cash" className="kpi-card glow-inner" style={cardStyle} data-ai-explain="simple-cash" aria-label="Money right now — open Money page">
          <span className="bento-tex" aria-hidden="true" />
          <span style={labelStyle}>Money right now</span>
          <span style={valueStyle}>{twin ? money(cash) : '—'}</span>
          <span style={subStyle}>
            {twin
              ? (receivables > 0 || payables > 0
                ? `${receivables > 0 ? `Owed to you: ${money(receivables)}` : ''}${receivables > 0 && payables > 0 ? ' · ' : ''}${payables > 0 ? `You owe: ${money(payables)}` : ''}`
                : 'No debts either way on record.')
              : 'Record your first sale and I\'ll track this live.'}
          </span>
        </Link>
        </Glow>

        <Glow>
        <Link href="/dashboard/timeline" className="kpi-card glow-inner" style={cardStyle} data-ai-explain="simple-today" aria-label="Today's sales — open Activity page">
          <span className="bento-tex" aria-hidden="true" />
          <span style={labelStyle}>Today</span>
          <span style={valueStyle}>{todaySales === null ? '…' : money(todayTotal)}</span>
          <span style={subStyle}>
            {todaySales === null
              ? 'Checking today\'s activity…'
              : todaySales.length > 0
                ? `${todaySales.length} sale${todaySales.length === 1 ? '' : 's'} recorded so far.`
                : 'No sales recorded yet today.'}
          </span>
        </Link>
        </Glow>

        <Glow>
        <Link href="/dashboard/inventory" className="kpi-card glow-inner" style={cardStyle} data-ai-explain="simple-stock" aria-label="Stock status — open Stock page">
          <span className="bento-tex" aria-hidden="true" />
          <span style={labelStyle}>{ind.stockWord}</span>
          <span style={{ ...valueStyle, color: lowStock.length > 0 ? 'var(--amber)' : 'var(--text-1)' }}>
            {products === null ? '…' : products.length === 0 ? '—' : lowStock.length > 0 ? `${lowStock.length} low` : 'All good'}
          </span>
          <span style={subStyle}>
            {products === null
              ? 'Checking stock levels…'
              : products.length === 0
                ? `Add your ${ind.stockWord} and I'll watch the levels.`
                : lowStock.length > 0
                  ? `${lowStock.slice(0, 2).map((p) => p.name).join(', ')}${lowStock.length > 2 ? '…' : ''} running low.`
                  : `${products.length} items tracked, none below reorder level.`}
          </span>
        </Link>
        </Glow>
      </motion.div>

      {/* Anticipated work — reorders AIBOS prepared; one tap turns a proposal
          into a pending receipt the owner confirms on arrival. */}
      {(proposals.length > 0 || followUps.length > 0) && (
        <motion.div {...fade(3)}>
        <Glow>
        <div className="section-card glow-inner" style={{ ...cardStyle, gap: 14 }}>
          <span className="bento-tex" aria-hidden="true" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={labelStyle}>AIBOS prepared this</span>
            {!canAutomate && (
              <Link
                href="/checkout?plan=proplus"
                style={{
                  fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', fontWeight: 700,
                  color: 'var(--cyan)', textDecoration: 'none', padding: '3px 9px', borderRadius: 999,
                  border: '1px solid color-mix(in srgb, var(--cyan) 40%, transparent)', background: 'var(--cyan-dim)',
                }}
              >
                Pro+
              </Link>
            )}
          </div>
          {proposals.slice(0, 4).map((p) => {
            const st = draftState[p.productId];
            return (
              <div key={p.productId} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
                    Reorder {p.headline}
                  </div>
                  <div style={{ ...subStyle, fontSize: '0.74rem', color: 'var(--text-4)' }}>
                    {p.reason}
                    {p.estimatedCost !== undefined ? ` · about ${money(p.estimatedCost)}` : ''}
                    {' · brings you back to 2× reorder level'}
                  </div>
                </div>
                {st === 'done' ? (
                  <span style={{ ...subStyle, color: 'var(--green)', fontWeight: 600 }}>
                    Drafted — confirm when it arrives
                  </span>
                ) : canAutomate ? (
                  <button
                    type="button"
                    onClick={() => void onDraft(p)}
                    disabled={st === 'drafting'}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: 'none', cursor: st === 'drafting' ? 'default' : 'pointer',
                      background: 'var(--cyan)', color: '#fff',
                      fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 700,
                      opacity: st === 'drafting' ? 0.6 : 1, transition: 'all 0.15s ease',
                    }}
                  >
                    {st === 'drafting' ? 'Drafting…' : st === 'error' ? 'Try again' : 'Draft reorder'}
                  </button>
                ) : (
                  <Link href="/checkout?plan=proplus" style={{ ...subStyle, color: 'var(--cyan)', fontWeight: 600, textDecoration: 'none' }}>
                    Unlock one-tap reorders →
                  </Link>
                )}
              </div>
            );
          })}

          {/* Drifting customers — AIBOS drafted the check-in; the owner sends
              it from their OWN WhatsApp. AIBOS never messages anyone itself. */}
          {followUps.map((f) => (
            <div key={f.customerId} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
                  Check in with {f.headline}
                </div>
                <div style={{ ...subStyle, fontSize: '0.74rem', color: 'var(--text-4)' }}>
                  {f.reason}
                </div>
              </div>
              {canAutomate ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a
                    href={f.waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 14px', borderRadius: 8, textDecoration: 'none',
                      background: 'var(--green-dim)', color: 'var(--green)',
                      border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)',
                      fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 700,
                    }}
                  >
                    Send on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => onFollowUpDone(f.customerId)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid var(--border-md)', background: 'transparent',
                      color: 'var(--text-3)', fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 600,
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <Link href="/checkout?plan=proplus" style={{ ...subStyle, color: 'var(--cyan)', fontWeight: 600, textDecoration: 'none' }}>
                  Unlock check-in drafts →
                </Link>
              )}
            </div>
          ))}
        </div>
        </Glow>
        </motion.div>
      )}

      {/* Getting started — real signals, disappears when complete */}
      {showChecklist && (
        <motion.div {...fade(3)}>
        <Glow>
        <div className="section-card glow-inner" style={{ ...cardStyle, gap: 10 }}>
          <span className="bento-tex" aria-hidden="true" />
          <span style={labelStyle}>Getting started</span>
          {steps.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{
                width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                border: s.done ? 'none' : '1.5px solid var(--border-md)',
                background: s.done ? 'var(--green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {s.done ? (
                <span style={{ ...subStyle, color: 'var(--text-4)', textDecoration: 'line-through' }}>{s.label}</span>
              ) : s.href ? (
                <Link href={s.href} style={{ ...subStyle, color: 'var(--text-2)', textDecoration: 'none', fontWeight: 600 }}>
                  {s.label} →
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => ask(ind.prompts[0])}
                  style={{ ...subStyle, color: 'var(--text-2)', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                >
                  {s.label} →
                </button>
              )}
            </div>
          ))}
        </div>
        </Glow>
        </motion.div>
      )}

      {/* Automation receipts — what AIBOS is doing without being asked */}
      {handled.length > 0 && (
        <motion.div {...fade(4)}>
        <Glow>
        <div className="section-card glow-inner" style={{ ...cardStyle, gap: 8 }}>
          <span className="bento-tex" aria-hidden="true" />
          <span style={labelStyle}>AIBOS is handling this for you</span>
          {handled.map((line) => (
            <div key={line} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ color: 'var(--green)', flexShrink: 0, display: 'flex', marginTop: 2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span style={subStyle}>{line}</span>
            </div>
          ))}
        </div>
        </Glow>
        </motion.div>
      )}

      {/* Pro door + tour replay */}
      <motion.div {...fade(5)} style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setUiMode('technical')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px',
            fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', color: 'var(--text-4)',
          }}
        >
          Want the full picture? Switch to <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>Pro mode</span> →
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(TOUR_RESTART_EVENT))}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px',
            fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', color: 'var(--text-4)',
          }}
        >
          Take the tour again
        </button>
      </motion.div>
    </div>
  );
}
