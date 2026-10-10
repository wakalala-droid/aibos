'use client';

/**
 * The feature theatre (docs/LANDING_NAVY_PLAN_2026-10.md): five jobs AIBOS
 * takes off an owner's hands, each a short scene of the light product at work
 * on the navy stage (theatre/scenes.tsx).
 *
 *   - It plays only while at least a third of it is on screen, moves to the
 *     next job by itself when a scene ends (the 2px line under the tab is the
 *     scene's time) and loops.
 *   - Choosing a tab plays that job and stops the auto-play, so anyone can
 *     hold a scene still (WCAG 2.2.2). A mouse resting on the stage pauses it.
 *   - Reduced motion: no auto-play and every scene shows its finished picture.
 *   - The stage is a picture to a screen reader (role="img" with the job told
 *     in words); the words beside it carry the meaning.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BedDouble, Briefcase, CalendarClock, Check, Package, ReceiptText, type LucideIcon } from 'lucide-react';
import { DeadlinesScene, GetPaidScene, PayrollScene, RoomsScene, StockScene, type SceneProps } from './theatre/scenes';

type Story = {
  id: string;
  tab: string;
  icon: LucideIcon;
  plan: string;
  goal: string;
  text: string;
  values: string[];
  /** What the scene shows, for a screen reader. */
  alt: string;
  ms: number;
  Scene: (p: SceneProps) => JSX.Element;
};

const STORIES: Story[] = [
  {
    id: 'payroll', tab: 'Payroll', icon: Briefcase, plan: 'Pro',
    goal: 'Pay your people right, without the tax tables.',
    text: 'Add your staff once. Each month AIBOS works out PAYE, NAPSA and NHIMA at this year’s Zambian rates and shows every take-home figure. The payments to ZRA and NAPSA go straight on your schedule.',
    values: ['The 2026 ZRA bands and NAPSA ceiling, kept current for you', 'Wages posted to your books in one tap'],
    alt: 'Payroll for October: Mwila Banda’s payslip of K8,500.00 less NAPSA K425.00, PAYE K792.50 and NHIMA K85.00 leaves K7,197.50 take-home. PAYE, NAPSA and NHIMA due 10 November are added to the schedule.',
    ms: 7600, Scene: PayrollScene,
  },
  {
    id: 'paid', tab: 'Get paid', icon: ReceiptText, plan: 'Free',
    goal: 'Get paid the same day, not the same month.',
    text: 'Every invoice carries a mobile money payment link. Your customer pays from their own phone, AIBOS marks the invoice paid and your money figure moves by itself.',
    values: ['No app for your customer to install', 'See who still owes you and for how long'],
    alt: 'Invoice 0142 for K4,800.00 goes to Lusaka Hotels with a mobile money link. They pay from their phone, the invoice turns to Paid and money right now rises from K48,230.50 to K53,030.50.',
    ms: 7000, Scene: GetPaidScene,
  },
  {
    id: 'deadlines', tab: 'Deadlines', icon: CalendarClock, plan: 'Pro',
    goal: 'No more penalties. No more “I forgot”.',
    text: 'NAPSA, PAYE, rent and supplier pick-ups sit in one list. A reminder reaches your phone days before each one is due, even with AIBOS closed.',
    values: ['ZRA and NAPSA dates added for you when you run payroll', 'Mark it paid straight from the reminder'],
    alt: 'The coming up list with a supplier pick-up, NAPSA K1,950.00 and PAYE K990.00 due 10 November and rent. A reminder arrives that NAPSA is due on Tuesday and it is marked paid.',
    ms: 7000, Scene: DeadlinesScene,
  },
  {
    id: 'stock', tab: 'Stock', icon: Package, plan: 'Pro+',
    goal: 'Never tell a customer “we’ve run out”.',
    text: 'Set a reorder level once. When something runs low, AIBOS drafts the order with the right amount from the right supplier and you approve it in one tap.',
    values: ['Tops you back up to twice your reorder level', 'Approved orders wait under Expected deliveries until they arrive'],
    alt: 'Cooking oil falls to 2 left, under its reorder level of 6. AIBOS drafts 10 more from Kasama Traders and the draft is approved.',
    ms: 7400, Scene: StockScene,
  },
  {
    id: 'rooms', tab: 'Rooms & Stays', icon: BedDouble, plan: 'Pro',
    goal: 'Fill your rooms with the deposit already paid.',
    text: 'The whole week of rooms at a glance. Each booking gets its own payment link, the deposit confirms the stay and AIBOS reminds you before every guest arrives.',
    values: ['Requests, stays and finished stays in one picture', 'Every deposit lands in your books'],
    alt: 'The week calendar: a request from Mrs Tembo for Room 2, Thursday to Saturday. Her K650.00 deposit arrives through the payment link, the stay is confirmed and a reminder is set for her arrival.',
    ms: 7000, Scene: RoomsScene,
  },
];

export default function FeatureTheatre() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0);        // restarts a scene when the loop comes back to it
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onCalm = () => setStill(calm.matches);
    onCalm();
    calm.addEventListener('change', onCalm);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.33 });
      io.observe(el);
    } else {
      setInView(true);
    }
    return () => {
      calm.removeEventListener('change', onCalm);
      document.removeEventListener('visibilitychange', onVis);
      io?.disconnect();
    };
  }, []);

  const playing = inView && !hover && !hidden && !still;

  const next = useCallback(() => {
    setActive((i) => (i + 1) % STORIES.length);
    setRun((r) => r + 1);
  }, []);

  const choose = (i: number) => {
    setAuto(false);
    setActive(i);
    setRun((r) => r + 1);
  };

  // Arrow keys move between the tabs, as a tab list should.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = (active + step + STORIES.length) % STORIES.length;
    choose(i);
    document.getElementById(`story-tab-${STORIES[i].id}`)?.focus();
  };

  const story = STORIES[active];
  const { Scene } = story;

  return (
    <section ref={ref} id="jobs" className="mkt-section mkt-theatre" aria-labelledby="jobs-h">
      <div className="mkt-wrap">
        <div className="mkt-head">
          <div>
            <p className="mkt-eyebrow">Jobs done for you</p>
            <h2 id="jobs-h" className="mkt-h2">Less paperwork. More business.</h2>
          </div>
          <p className="mkt-head-sub">
            Five jobs that eat an owner&apos;s week, shown the way AIBOS does them. Pick one, or let them play.
          </p>
        </div>

        <div className="story-tabs" role="tablist" aria-label="Jobs AIBOS does for you" onKeyDown={onKey}>
          {STORIES.map((s, i) => {
            const on = i === active;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                id={`story-tab-${s.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="story-panel"
                tabIndex={on ? 0 : -1}
                className="story-tab"
                onClick={() => choose(i)}
              >
                <span className="bento-icon" aria-hidden="true"><Icon /></span>
                {s.tab}
                {on && auto && !still && (
                  <span
                    key={run}
                    className="story-progress"
                    data-run={playing ? 'on' : 'off'}
                    style={{ animationDuration: `${s.ms}ms` }}
                    onAnimationEnd={next}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div id="story-panel" className="story-panel" role="tabpanel" aria-labelledby={`story-tab-${story.id}`}>
          <div key={`copy-${active}`} className="story-copy">
            <span className="bento-tag story-plan">{story.plan}</span>
            <h3 className="story-goal">{story.goal}</h3>
            <p className="mkt-lead" style={{ marginTop: 16 }}>{story.text}</p>
            <ul className="mkt-values">
              {story.values.map((v) => <li key={v}><Check aria-hidden />{v}</li>)}
            </ul>
          </div>

          <div
            className="story-stage"
            role="img"
            aria-label={story.alt}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
            onPointerLeave={() => setHover(false)}
          >
            <div key={`${active}-${run}`} className="story-screen" data-theme="light" aria-hidden="true">
              <Scene playing={playing} still={still} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
