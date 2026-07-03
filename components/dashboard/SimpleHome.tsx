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
import { listEvents, listProducts, type BusinessEvent, type Product } from '@/lib/api';

const ASKED_KEY = 'aibos-simple-asked-v1';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
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

  // Live detail the twin doesn't carry: item-level stock + today's sales.
  const [products, setProducts] = useState<Product[] | null>(null);
  const [todaySales, setTodaySales] = useState<BusinessEvent[] | null>(null);
  const [asked, setAsked] = useState(true); // assume done until localStorage says otherwise
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, e] = await Promise.allSettled([
        listProducts(),
        listEvents({ event_type: 'Sale', limit: 100 }),
      ]);
      if (!alive) return;
      setProducts(p.status === 'fulfilled' ? p.value : []);
      if (e.status === 'fulfilled') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        setTodaySales(e.value.filter((ev) => ev.status !== 'void' && new Date(ev.occurred_at) >= start));
      } else {
        setTodaySales([]);
      }
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

  const twinActive = !!twin && (Number(twin.event_count) > 0 || Number(twin.cash) !== 0);
  const eventCount = Number(twin?.event_count) || 0;
  const cash = Number(twin?.cash) || 0;
  const receivables = Number(twin?.receivables) || 0;
  const payables = Number(twin?.payables) || 0;

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
      </motion.div>

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
        <Link href="/dashboard/cash" style={cardStyle} data-ai-explain="simple-cash" aria-label="Money right now — open Money page">
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

        <Link href="/dashboard/timeline" style={cardStyle} data-ai-explain="simple-today" aria-label="Today's sales — open Activity page">
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

        <Link href="/dashboard/inventory" style={cardStyle} data-ai-explain="simple-stock" aria-label="Stock status — open Stock page">
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
      </motion.div>

      {/* Getting started — real signals, disappears when complete */}
      {showChecklist && (
        <motion.div {...fade(3)} style={{ ...cardStyle, gap: 10 }}>
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
        </motion.div>
      )}

      {/* Automation receipts — what AIBOS is doing without being asked */}
      {handled.length > 0 && (
        <motion.div {...fade(4)} style={{ ...cardStyle, gap: 8 }}>
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
