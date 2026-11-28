'use client';

// components/team/TeamScene.tsx
// The AI-BOS team as one scene (owner, 17 Nov 2026, from the reference picture
// they sent): the AI-BOS mark in its rings in the middle of a navy stage, the
// six workers around it, three each side, each a hexagon badge beside a small
// card with its name, its state and a meter of the week's work, joined to the
// middle by a line of light. Under the stage, the live activity in a row and
// the bar to talk to AI-BOS.
//
// Second pass the same day (owner): it lives on Home now, edge to edge, not a
// window on a page of its own (components/home/HomeTeam.tsx), and the mark
// sits exactly in the middle of the stage. Its name and state sit under the
// rings, so nothing pushes the mark off centre, and the live activity is under
// the stage instead of beside it.
//
// The kit's pieces in the kit's words: the mark in a white disc in a dashed
// ring, status told by fill (brand cyan needs the owner, outline is watching,
// faded and dashed is not on the plan), Geist, 44px taps. The kit allows this
// one scene to move (docs/AIBOS_UI_KIT.md, "The team scene"), and only when
// something is happening: light runs along a worker's line into the middle
// when it has found something, out along every line while AI-BOS auto is on,
// the dashed ring turns while auto is on, a sweep crosses the badges while
// the team looks, and a new line of live activity slides in. Nothing moves
// with reduced motion.

import { useState } from 'react';
import { BedDouble, BookCheck, HandCoins, Landmark, Mic, Send, Telescope, Users } from 'lucide-react';
import { BrandMark } from '@/components/kit';
import AibosSphere from '@/components/talk/AibosSphere';
import type { AiAction, AiWorker } from '@/lib/api';

export const WORKER_ICONS: Record<string, typeof Users> = {
  bookkeeper: BookCheck, collector: HandCoins, tax: Landmark,
  payroll: Users, scout: Telescope, guest_desk: BedDouble,
};

/** A quiet worker says what it went through today (workers.py looked_*), not "Watching" six times over. */
export function workerState(w: AiWorker): { word: string; tone: 'ask' | 'watch' | 'off' } {
  if (!w.on) return { word: w.off_reason || 'Not on your plan', tone: 'off' };
  if (w.waiting > 0) return { word: `${w.waiting} ${w.waiting === 1 ? 'needs' : 'need'} you`, tone: 'ask' };
  return { word: w.looked || 'Watching', tone: 'watch' };
}

/** Whether an ISO time falls on today's date where the owner is. */
function isToday(at?: string | null): boolean {
  const d = new Date(at ?? '');
  return !!at && !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
}

// Three down each side: [x of the badge, y], in % of the stage.
const SPOTS: [number, number][] = [[31, 16], [69, 16], [27, 50], [73, 50], [31, 84], [69, 84]];
const SIDE = ['left', 'right', 'left', 'right', 'left', 'right'] as const;
// On a phone the same six sit in a ring round the mark, badges with their names (CSS picks these up).
const PHONE: [number, number][] = [[22, 11], [78, 11], [11, 50], [89, 50], [22, 89], [78, 89]];
// Live activity shows the newest few, in a row under the stage.
const FEED = 3;

function clock(at?: string): string {
  const d = new Date(at ?? '');
  if (!at || Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** The hexagon badge, pointy at the top, drawn so its edge can glow. */
function Hex({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`scene-hex is-${tone}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="scene-hex-shape">
        <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" />
      </svg>
      <span className="scene-hex-icon">{children}</span>
    </span>
  );
}

/** Five bars, as tall as the week's work, the newest at the right. */
function Meter({ done }: { done: number }) {
  const lit = Math.min(5, Math.ceil(done / 2));
  return (
    <span className="scene-meter" aria-hidden="true">
      {[0.35, 0.5, 0.65, 0.82, 1].map((h, i) => (
        <i key={i} style={{ height: `${h * 100}%` }} className={i < lit ? 'is-lit' : undefined} />
      ))}
    </span>
  );
}

export default function TeamScene({ workers, recent, auto, checking, picked, onPick, onTalk, onAsk, locked, ask = true, lookedAt }: {
  workers: AiWorker[];
  recent: AiAction[];
  /** When the team last went through the books (GET /workers looked_at); said under the mark when it was today. */
  lookedAt?: string | null;
  auto: boolean;
  checking: boolean;
  picked: string | null;
  onPick: (id: string) => void;
  onTalk: () => void;
  onAsk: (text: string) => void;
  /** Not on this plan (or not ready): the team shows asleep and `locked` takes the live activity's place. */
  locked?: React.ReactNode;
  /** The ask bar under the stage; the landing page's sample team has none. */
  ask?: boolean;
}) {
  const [q, setQ] = useState('');
  const assistant = workers.find((w) => w.id === 'assistant');
  const crew = workers.filter((w) => w.id !== 'assistant').slice(0, SPOTS.length);
  const waiting = workers.reduce((n, w) => n + (w.on ? w.waiting : 0), 0);
  const feed = recent.filter((j) => j.status === 'done' || j.status === 'waiting').slice(0, FEED);
  const sub = locked ? 'Your team is asleep'
    : auto ? 'On auto. Asks only when it must'
    : waiting > 0 ? `${waiting} ${waiting === 1 ? 'thing needs' : 'things need'} you`
    : isToday(lookedAt) ? `Checked your books at ${clock(lookedAt ?? undefined)}`
    : 'Watching your books';

  return (
    <section className={`scene${auto && !locked ? ' is-auto' : ''}${checking ? ' is-checking' : ''}${locked ? ' is-locked' : ''}`}
      data-theme="dark" aria-label="Your AI-BOS team">
      <div className="scene-inner">
        <div className="scene-stage">
          <span className="scene-orbits" aria-hidden="true"><i /><i /><i /></span>
          <svg className="scene-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {crew.map((w, i) => (
              <line key={w.id} x1="50" y1="50" x2={SPOTS[i][0]} y2={SPOTS[i][1]}
                className={`scene-line is-${workerState(w).tone}`} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <svg className="scene-lines is-phone" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {crew.map((w, i) => (
              <line key={w.id} x1="50" y1="50" x2={PHONE[i][0]} y2={PHONE[i][1]}
                className={`scene-line is-${workerState(w).tone}`} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>

          {/* Light along the lines: in from a worker that found something, out to all while auto runs. */}
          {!locked && crew.map((w, i) => {
            const tone = workerState(w).tone;
            if (tone === 'off' || (tone !== 'ask' && !auto)) return null;
            const style = {
              '--x1': `${SPOTS[i][0]}%`, '--y1': `${SPOTS[i][1]}%`, '--px': `${PHONE[i][0]}%`, '--py': `${PHONE[i][1]}%`,
              '--d': `${(i % 3) * 0.7}s`,
            } as React.CSSProperties;
            return <span key={w.id} className={`scene-spark ${tone === 'ask' ? 'is-in' : 'is-out'}`} style={style} aria-hidden="true" />;
          })}

          {/* The mark, dead centre: the rings and the disc share one middle; the words hang under the rings. */}
          <button type="button" className="scene-hub" aria-pressed={picked === 'assistant'}
            onClick={() => (locked ? onTalk() : onPick('assistant'))}
            aria-label={locked ? 'Talk to AI-BOS' : `AI-BOS Assistant${assistant?.waiting ? `, ${assistant.waiting} waiting` : ''}`}>
            <span className="scene-hub-outer" aria-hidden="true" />
            <span className="scene-hub-ring" aria-hidden="true"><i /></span>
            <span className="scene-hub-disc" aria-hidden="true"><BrandMark size={48} theme="light" /></span>
            <span className="scene-hub-text">
              <span className="scene-hub-word">AI-BOS</span>
              <span className="scene-hub-sub">{sub}</span>
            </span>
          </button>

          {crew.map((w, i) => {
            const Icon = WORKER_ICONS[w.id] ?? Users;
            const s = workerState(w);
            const style = {
              left: `${SPOTS[i][0]}%`, top: `${SPOTS[i][1]}%`, '--px': `${PHONE[i][0]}%`, '--py': `${PHONE[i][1]}%`,
            } as React.CSSProperties;
            return (
              <button key={w.id} type="button" className={`scene-station is-${s.tone} is-${SIDE[i]}`} style={style}
                aria-pressed={picked === w.id} onClick={() => onPick(w.id)} aria-label={`${w.name}: ${s.word}`}>
                <Hex tone={s.tone}><Icon /></Hex>
                <span className="scene-card">
                  <span className="scene-card-name">{w.name}</span>
                  <span className="scene-card-state">
                    <i className="scene-dot" aria-hidden="true" />
                    {s.tone === 'watch' && auto ? 'Working' : s.word}
                  </span>
                  {w.on && <Meter done={w.done_this_week} />}
                </span>
                {s.tone === 'ask' && <span className="scene-count" aria-hidden="true">{w.waiting}</span>}
              </button>
            );
          })}
        </div>

        {locked ? <div className="scene-locked">{locked}</div> : (
          <div className="scene-live" aria-label="Live activity" role="region">
            <p className="scene-live-head">
              <span>Live activity</span>
              <span className={`scene-live-chip${auto ? ' is-on' : ''}`}><i aria-hidden="true" />{auto ? 'Auto' : 'Live'}</span>
            </p>
            {feed.length === 0 ? (
              <p className="scene-live-empty">Nothing yet today. Every job the team does or asks about shows here.</p>
            ) : (
              <ol className="scene-feed">
                {feed.map((j) => (
                  <li key={j.id} className={`is-${j.status}`}>
                    <span className="scene-feed-top">
                      <span className="scene-feed-who">{j.worker?.name ?? 'Assistant'}</span>
                      <span className="scene-feed-time">{clock(j.at)}</span>
                    </span>
                    <span className="scene-feed-what">{j.status === 'done' ? `${j.how === 'automatic' ? 'By itself: ' : ''}${j.did}` : j.said}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {ask && <form className="scene-ask" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { onAsk(q.trim()); setQ(''); } }}>
          <button type="button" className="scene-ask-sphere" onClick={onTalk} aria-label="Talk to AI-BOS">
            <AibosSphere size={56} still />
          </button>
          <label htmlFor="scene-ask-input" className="sr-only">Ask AI-BOS anything</label>
          <input id="scene-ask-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Ask AI-BOS anything, like “Who owes me the most?”" />
          <button type="button" className="icon-pill scene-ask-mic" onClick={onTalk} aria-label="Talk instead"><Mic aria-hidden="true" /></button>
          <button type="submit" className="scene-ask-send" disabled={!q.trim()} aria-label="Ask"><Send aria-hidden="true" /></button>
        </form>}
      </div>
    </section>
  );
}
