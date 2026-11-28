'use client';

// AI-BOS auto (17 Nov 2026): the switch at the top right of every page.
//
// On: the team looks through the books every hour and the safe jobs do
// themselves, each with an Undo. The owner touches nothing until AI-BOS needs
// them: anything that goes to another person, marks money paid, settles tax,
// refunds or is over the limit still waits in Needs you, and rings the bell.
//
// The first time it is turned on it says what it will and will not do, once.
// On a plan without the team it shows what the team would find in the
// owner's own books right now, and which plan has it (never a price; nothing
// to buy in the iPhone app). Staff and the accountant never see it.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Hand } from 'lucide-react';
import { useAutoMode } from '@/lib/autoMode';
import { previewAuto } from '@/lib/api';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { NOT_ON_PLAN, useIosApp } from '@/lib/iosApp';

const EXPLAINED_KEY = 'aibos-auto-explained-v1';

const FOUND_WORDS: Record<string, [string, string]> = {
  bookkeeper: ['entry to confirm', 'entries to confirm'],
  collector: ['customer to chase', 'customers to chase'],
  tax: ['tax date to settle', 'tax dates to settle'],
  payroll: ['pay run to work out', 'pay runs to work out'],
  scout: ['regular gone quiet', 'regulars gone quiet'],
  guest_desk: ['guest to get ready for', 'guests to get ready for'],
};

export default function AutoSwitch() {
  const { state, on, available, busy, error, setOn } = useAutoMode();
  const sym = useStore((s) => s.currencySymbol) || 'K';
  const ios = useIosApp();
  const [pop, setPop] = useState<null | 'explain' | 'preview' | 'not-ready'>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewAuto>> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pop) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setPop(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [pop]);

  if (!state) return null;

  async function flip() {
    if (!available) {
      setPop(pop === 'preview' ? null : 'preview');
      if (!preview) previewAuto().then(setPreview).catch(() => setPreview({ found: {}, total: 0, names: {} }));
      return;
    }
    if (!state!.ready) { setPop(pop === 'not-ready' ? null : 'not-ready'); return; }
    if (on) { await setOn(false); setPop(null); return; }
    let explained = false;
    try { explained = window.localStorage.getItem(EXPLAINED_KEY) === '1'; } catch { /* private mode */ }
    if (!explained) { setPop('explain'); return; }
    await setOn(true);
  }

  async function turnOn() {
    try { window.localStorage.setItem(EXPLAINED_KEY, '1'); } catch { /* private mode */ }
    if (await setOn(true)) setPop(null);
  }

  const limit = state.limit ? fmt(state.limit, false, sym) : null;

  return (
    <div ref={wrap} className="auto-wrap">
      <button type="button" role="switch" aria-checked={on} disabled={busy}
        className={`auto-switch${on ? ' is-on' : ''}${!available ? ' is-locked' : ''}`}
        onClick={flip} title={on ? 'AI-BOS auto is on: the team works by itself and asks only when it needs you' : 'Turn on AI-BOS auto'}>
        <span className="auto-switch-word"><span className="auto-switch-brand">AI-BOS </span>auto</span>
        <span className="auto-switch-track" aria-hidden="true"><span className="auto-switch-knob" /></span>
      </button>

      {pop === 'explain' && (
        <div role="dialog" aria-label="AI-BOS auto" className="dash-pop auto-pop">
          <p className="bento-title" style={{ margin: 0 }}>Let AI-BOS run the day</p>
          <p className="auto-pop-text">Your team looks through your books every hour and does the safe jobs itself. You only hear from it when it needs you.</p>
          <p className="eyebrow" style={{ margin: '12px 0 4px' }}>Does by itself, with an Undo</p>
          <ul className="auto-pop-list">
            {(state.does ?? []).map((d) => <li key={d}><Check aria-hidden="true" />{d}{limit && d.startsWith('Records') ? ` (${limit} each)` : ''}</li>)}
          </ul>
          <p className="eyebrow" style={{ margin: '12px 0 4px' }}>Always asks you first</p>
          <ul className="auto-pop-list">
            {(state.asks ?? []).map((d) => <li key={d}><Hand aria-hidden="true" />{d}</li>)}
          </ul>
          {error && <p role="alert" className="auto-pop-text" style={{ color: 'var(--red)' }}>{error}</p>}
          <div className="ai-job-actions">
            <button type="button" className="pill pill-primary" disabled={busy} onClick={turnOn}>{busy ? 'Turning on' : 'Turn on'}</button>
            <button type="button" className="pill pill-quiet" onClick={() => setPop(null)}>Not now</button>
          </div>
        </div>
      )}

      {pop === 'not-ready' && (
        <div role="dialog" aria-label="AI-BOS auto" className="dash-pop auto-pop">
          <p className="bento-title" style={{ margin: 0 }}>Almost ready</p>
          <p className="auto-pop-text">AI-BOS auto needs one update on AI-BOS&apos;s side first. Everything else works as it does now.</p>
        </div>
      )}

      {pop === 'preview' && (
        <div role="dialog" aria-label="AI-BOS auto" className="dash-pop auto-pop">
          <p className="bento-title" style={{ margin: 0 }}>Your team, on your books</p>
          {preview === null ? <div className="skeleton" style={{ height: 64, marginTop: 12 }} /> : preview.total > 0 ? (
            <>
              <p className="auto-pop-text">Right now, AI-BOS auto would be handling:</p>
              <ul className="auto-pop-list">
                {Object.entries(preview.found).map(([w, n]) => (
                  <li key={w}><Check aria-hidden="true" />{n} {(FOUND_WORDS[w] ?? ['thing', 'things'])[n === 1 ? 0 : 1]}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="auto-pop-text">Six workers who confirm entries, chase what is owed, watch tax dates and spot regulars gone quiet, every hour, asking before anything goes out.</p>
          )}
          {ios ? (
            <p className="auto-pop-text">{NOT_ON_PLAN}</p>
          ) : (
            <div className="ai-job-actions">
              <Link href="/dashboard/billing" className="pill pill-primary" onClick={() => setPop(null)}>It comes with Pro+</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
