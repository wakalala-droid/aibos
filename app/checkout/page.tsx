'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import BorderGlow from '@/components/ui/BorderGlow';
import PriceCurrencySwitch, { KwachaNote } from '@/components/ui/PriceCurrencySwitch';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { useTheme } from '@/lib/theme';
import { LEGAL } from '@/lib/legal';
import { usePlanPricing } from '@/lib/planPrice';
import { TIERS, TIER_ORDER, isPaidTier, isTier, type Tier } from '@/lib/tiers';
import {
  getCardConfig, getMyBilling, startCardCheckout, previewCardChange, confirmCardChange,
  type CardCheckout, type CardConfig, type CardChangePreview, type MyBilling,
} from '@/lib/api';
import {
  checkoutTotals, closeCardCheckout, formatMoney, mountInlineCheckout,
  type CheckoutTotals, type PaddleEvent,
} from '@/lib/paddle';
import './checkout.css';

// Every plan is paid by card through Paddle, in US dollars, and renews
// automatically until it is cancelled (owner's decision, 25 September 2026:
// mobile money is no longer a way to buy a plan). Kwacha can be shown beside
// the price for reference, never as what is charged (lib/planPrice.ts).

type Billing = 'monthly' | 'annual';

// After Paddle says a card payment is complete, the plan is switched on by
// Paddle's webhook to the API, not by this page. Wait for the API to agree.
// A sleeping API can take most of a minute to wake, so wait generously, and
// never offer to pay again: the money has already gone.
const CARD_CONFIRM_POLL_MS = 3_000;
const CARD_CONFIRM_FOR_MS = 3 * 60_000;

/** The class Paddle draws its card form into (Paddle targets a class, not an id). */
const FRAME_CLASS = 'aibos-card-frame';

// The cards share the dashboard's edge glow (dark theme only) and dot texture.
const CURSOR_GLOW = '190 95 62';
const MESH = ['#22d3ee', '#60a5fa', '#a78bfa'];

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** When a plan bought today first renews: a month or a year on, same day. */
function firstRenewal(billing: Billing): string {
  const d = new Date();
  const day = d.getDate();
  if (billing === 'annual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  // 31 January plus a month is the last day of February, not 3 March.
  if (d.getDate() !== day) d.setDate(0);
  return longDate(d.toISOString());
}

/** Paddle statuses of a card plan that is still going (renews automatically). */
const LIVE_CARD = ['active', 'trialing', 'past_due', 'paused'];

// ── Icons (2px stroke, per the Design OS) ────────────────────────────────────
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const I = {
  back: 'M15 18l-6-6 6-6',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z',
  check: 'M20 6L9 17l-5-5',
  chevron: 'M9 18l6-6-6-6',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  info: 'M12 16v-4M12 8h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
};

// ── The page frame: a slim top bar and nothing else in the way ──────────────
function Shell({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const router = useRouter();
  // Back to wherever they came from; a checkout opened in a fresh tab has
  // nowhere to go back to, so it goes to pricing.
  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/pricing'));
  return (
    <div className="co-page" data-bento>
      <div className="co-wrap">
        <header className="co-top">
          <div className="co-brand">
            <button type="button" className="co-back" aria-label="Go back" onClick={goBack}>
              <Icon d={I.back} size={20} />
            </button>
            <Image src={isDark ? '/brand/aibos-mark-white-glyph.png' : '/brand/aibos-mark.png'} alt="" width={28} height={28} />
            <Image src={isDark ? '/brand/aibos-wordmark-white.png' : '/brand/aibos-wordmark.png'} alt="AIBOS" width={74} height={19} />
          </div>
          <span className="co-secure">
            <Icon d={I.lock} size={16} />
            <span>Secure <span className="co-secure-word">checkout</span></span>
          </span>
        </header>
        <main id="main">{children}</main>
      </div>
    </div>
  );
}

function Panel({ children, labelledBy, className = '' }: { children: React.ReactNode; labelledBy?: string; className?: string }) {
  return (
    <div className={className}>
      <BorderGlow
        glowColor={CURSOR_GLOW}
        backgroundColor="var(--bg-card)"
        borderRadius={14}
        glowRadius={48}
        glowIntensity={1.2}
        coneSpread={12}
        colors={MESH}
      >
        <section className="section-card glow-inner co-card" aria-labelledby={labelledBy}>
          <span className="bento-tex" aria-hidden="true" />
          {children}
        </section>
      </BorderGlow>
    </div>
  );
}

function Note({ tone = 'plain', icon, children, role }: {
  tone?: 'plain' | 'warn' | 'info' | 'err' | 'good';
  icon?: 'spin' | keyof typeof I;
  children: React.ReactNode;
  role?: 'status' | 'alert';
}) {
  const cls = tone === 'plain' ? 'co-note' : `co-note co-${tone}`;
  return (
    <div className={cls} role={role}>
      {icon === 'spin' ? <span className="co-spin" aria-hidden="true" /> : icon ? <Icon d={I[icon]} /> : null}
      <div>{children}</div>
    </div>
  );
}

/** The card form's stand-in while Paddle loads it, the shape of the real thing. */
function FormSkeleton({ label }: { label: string }) {
  return (
    <>
      <span className="co-sr" role="status">{label}</span>
      <div className="skeleton co-skel-label" />
      <div className="skeleton co-skel-field" />
      <div className="skeleton co-skel-label" />
      <div className="skeleton co-skel-field" />
      <div className="co-skel-row">
        <div className="skeleton co-skel-field" />
        <div className="skeleton co-skel-field" />
      </div>
      <div className="skeleton co-skel-btn" />
    </>
  );
}

function CheckoutInner() {
  const params = useSearchParams();
  const planParam = params.get('plan');
  const plan = isPaidTier(planParam) ? planParam : null;
  // Billing is chosen here (audit #71): default from the URL, but the owner can
  // switch to yearly (two months free) right at the point of payment.
  const [billing, setBilling] = useState<Billing>(params.get('billing') === 'annual' ? 'annual' : 'monthly');
  const setTier = useStore((s) => s.setTier);
  const { serverTier, paidUntil, ownPlan, planExpired, paidTier, isAdmin, loading: profileLoading, refresh } = useProfile();
  // Prices are in US dollars; the owner can see them in Kwacha at today's rate.
  const pricing = usePlanPricing();

  // Tier is SERVER-authoritative and the client can no longer write it directly
  // (the profiles guard trigger pins tier for self-updates — migration 0010).
  //   • Paid unlocks are granted by the backend when the payment is confirmed
  //     (aibos-api `_grant_tier`); here we just update the local UX cache and let
  //     lib/profile.tsx re-hydrate the real value from Supabase.
  //   • Free is set through the service-role route /api/checkout/select-free.
  const cacheTier = useCallback((t: Tier) => setTier(t), [setTier]);

  // Choosing Free. It used to switch the moment the button was pressed, even
  // for someone with weeks of a paid plan left, and it reported success even
  // when the server refused.
  const [freeState, setFreeState] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');
  const selectFree = useCallback(async () => {
    setFreeState('saving');
    try {
      const res = await fetch('/api/checkout/select-free', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      setTier('free');
      setFreeState('done');
      void refresh();
    } catch {
      setFreeState('failed');
    }
  }, [setTier, refresh]);

  const [cards, setCards] = useState<CardConfig | null>(null);
  const [account, setAccount] = useState<MyBilling | null>(null);
  // Whether we know if there is a card plan already. A card form must not be
  // started before then: a second card plan would be refused.
  const [accountKnown, setAccountKnown] = useState(false);

  useEffect(() => {
    let alive = true;
    void getCardConfig().then((c) => { if (alive) setCards(c); });
    getMyBilling()
      .then((b) => { if (alive) setAccount(b); })
      .catch(() => { /* card plan unknown: offer a new one */ })
      .finally(() => { if (alive) setAccountKnown(true); });
    return () => { alive = false; };
  }, []);

  // ── A new plan, with Paddle's card form inside the page ────────────────────
  // idle → opening (the API makes a transaction, Paddle loads its form) → open
  // (the form is showing) → confirming (Paddle took the money, waiting for the
  // API) → done. `failed` means the form could not load; nothing was taken.
  const [cardState, setCardState] = useState<'idle' | 'opening' | 'open' | 'failed' | 'confirming' | 'slow' | 'done'>('idle');
  const [cardError, setCardError] = useState('');
  const [cardTotals, setCardTotals] = useState<CheckoutTotals | null>(null);
  const [cardRetry, setCardRetry] = useState(0);
  const cardPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // One Paddle transaction per plan and period for this visit, so switching
  // Monthly and Yearly back and forth reuses them instead of making new ones.
  const txnCache = useRef<Record<string, Promise<CardCheckout>>>({});
  const txnRef = useRef<string | null>(null);

  // After "completed", wait for the API to have switched the plan on.
  useEffect(() => {
    if (cardState !== 'confirming' || !plan) return;
    let active = true;
    const started = Date.now();
    const tick = async () => {
      if (!active) return;
      try {
        const b = await getMyBilling();
        if (!active) return;
        if (b.own_plan && b.plan === plan && b.state === 'active') {
          setAccount(b);
          cacheTier(plan);
          setCardState('done');
          void refresh();
          return;
        }
      } catch { /* a sleeping API: keep waiting */ }
      if (Date.now() - started > CARD_CONFIRM_FOR_MS) {
        setCardState('slow');
        return;
      }
      cardPollRef.current = setTimeout(tick, CARD_CONFIRM_POLL_MS);
    };
    cardPollRef.current = setTimeout(tick, CARD_CONFIRM_POLL_MS);
    return () => { active = false; if (cardPollRef.current) clearTimeout(cardPollRef.current); };
  }, [cardState, plan, cacheTier, refresh]);

  const onPaddle = useCallback((e: PaddleEvent) => {
    // Paddle sends the real subtotal, tax and total (tax depends on the
    // country) with its events; the summary shows them as they change.
    const totals = checkoutTotals(e);
    if (totals && (!totals.transactionId || totals.transactionId === txnRef.current)) setCardTotals(totals);
    if (e.name === 'checkout.loaded') {
      // From `failed` too: a slow form that turns up after the time limit.
      setCardState((s) => (s === 'opening' || s === 'failed' ? 'open' : s));
      setCardError('');
    } else if (e.name === 'checkout.completed') {
      // The money has gone: the form closes (cardAfterPayment) and the page
      // waits for the API to switch the plan on. It never offers to pay again.
      setCardState('confirming');
    } else if (e.name === 'checkout.error') {
      setCardError('The card form ran into a problem. No money was taken. Please try again.');
      setCardState('failed');
    }
  }, []);

  // ── Moving an existing card plan to another plan ───────────────────────────
  const [change, setChange] = useState<'idle' | 'previewing' | 'preview' | 'applying' | 'done'>('idle');
  const [preview, setPreview] = useState<CardChangePreview | null>(null);
  const [changeError, setChangeError] = useState('');

  // A different plan or period chosen: an old price no longer applies.
  useEffect(() => { setChange('idle'); setPreview(null); setChangeError(''); }, [billing, planParam]);

  const askChange = async () => {
    if (!plan) return;
    setChangeError('');
    setChange('previewing');
    try {
      setPreview(await previewCardChange(plan, billing));
      setChange('preview');
    } catch (e) {
      setChange('idle');
      setChangeError((e as Error).message || 'Could not work out the price of the change. Please try again.');
    }
  };

  const applyChange = async () => {
    if (!plan) return;
    setChangeError('');
    setChange('applying');
    try {
      await confirmCardChange(plan, billing);
      cacheTier(plan);
      setChange('done');
      void refresh();
      getMyBilling().then(setAccount).catch(() => {});
    } catch (e) {
      setChange('preview');
      setChangeError((e as Error).message || 'The plan was not changed. Please try again.');
    }
  };

  // Cards are open to everyone once Paddle is set up. While it is being tested
  // (a sandbox key, or a live one before its first real payment) only an admin
  // can pay; everyone else is told how to start a plan in the meantime.
  const cardPrice = plan ? cards?.prices?.[plan]?.[billing] ?? null : null;
  const cardsOpen = Boolean(plan && cards?.enabled && cardPrice && (!cards.testers_only || isAdmin));
  const cardOffered = cardsOpen && ownPlan;
  const cardAfterPayment = cardState === 'confirming' || cardState === 'slow' || cardState === 'done';
  // While a payment is being confirmed the period stays as it is: switching
  // would invite a second payment for the same plan.
  const choiceLocked = cardAfterPayment;
  const cardPlan = account?.card && LIVE_CARD.includes(account.card.status) ? account.card : null;
  // Not yet known whether cards are on offer: hold a placeholder rather than
  // say "not open yet" and then change our mind.
  const deciding = Boolean(plan) && !cardOffered && (cards === null || profileLoading);
  const frameActive = Boolean(plan) && cardOffered && accountKnown && !cardPlan && !cardAfterPayment;

  // Put Paddle's card form into the page, and again for another period.
  useEffect(() => {
    if (!frameActive || !plan) return;
    let alive = true;
    const key = `${plan}|${billing}`;
    setCardError('');
    setCardTotals(null);
    setCardState('opening');
    void (async () => {
      try {
        // A refused request is forgotten at once, so "Try again" asks afresh.
        const t = await (txnCache.current[key] ??= startCardCheckout(plan, billing).catch((err) => {
          delete txnCache.current[key];
          throw err;
        }));
        if (!alive) return;
        txnRef.current = t.transaction_id;
        await mountInlineCheckout({
          transactionId: t.transaction_id,
          token: t.client_token,
          environment: t.environment,
          frameClass: FRAME_CLASS,
          onEvent: onPaddle,
          alive: () => alive,
        });
      } catch (e) {
        if (!alive) return;
        setCardError((e as Error).message || 'The card form could not load. Please try again.');
        setCardState('failed');
      }
    })();
    return () => {
      alive = false;
      closeCardCheckout();
    };
  }, [frameActive, plan, billing, cardRetry, onPaddle]);

  // A form that never arrives (a dropped connection, a blocked frame) must not
  // leave the placeholder up forever. The API is already awake by now: the
  // account was read before the form was asked for.
  useEffect(() => {
    if (cardState !== 'opening') return;
    const t = setTimeout(() => {
      setCardError('The card form is taking too long to load. Check your connection and try again. No money was taken.');
      setCardState('failed');
    }, 45_000);
    return () => clearTimeout(t);
  }, [cardState, cardRetry, billing]);

  if (!plan) {
    // Free needs no payment. Someone still on a paid plan of their own is told
    // what they would give up before anything changes.
    const giving = planParam === 'free' && ownPlan && serverTier && serverTier !== 'free' ? TIERS[serverTier].name : null;
    const byCard = account?.card && LIVE_CARD.includes(account.card.status) && !account.card.cancel_at;
    return (
      <Shell>
        <div className="co-solo">
          <Panel labelledBy="co-free-title">
            <h1 id="co-free-title" className="co-h1" style={{ fontSize: 26 }}>
              {planParam !== 'free' ? 'Choose a plan first'
                : freeState === 'done' || (!giving && serverTier === 'free') ? 'You’re on the Free plan'
                : giving ? `Switch from ${giving} to Free?` : 'The Free plan'}
            </h1>
            <p className="co-tagline">
              {planParam !== 'free'
                ? 'Head back to pricing to pick a plan.'
                : freeState === 'done'
                ? 'Your records are all still here. You can move to a paid plan again whenever you like.'
                : giving && byCard
                ? `${giving} renews automatically on your card. To stop paying, cancel the renewal on Plan & billing: ${giving} then stays on until the end of what you paid. Your records stay.`
                : giving
                ? `${giving} switches off straight away${paidUntil ? `, even though it is paid until ${longDate(paidUntil)}` : ''}. Money already paid is not refunded. Your records stay.`
                : 'Financial engine, last 30 days, full P&L and cashflow. No payment needed.'}
            </p>
            {freeState === 'failed' && (
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <Note tone="err" icon="alert" role="alert">
                  The plan could not be changed just now. Nothing was changed, so please try again.
                </Note>
              </div>
            )}
            <div className="co-stack">
              {planParam === 'free' && giving && byCard ? (
                <Link href="/dashboard/billing" className="co-btn">Go to Plan &amp; billing</Link>
              ) : planParam === 'free' && freeState !== 'done' && !profileLoading && (giving || serverTier !== 'free') ? (
                <button type="button" className="co-btn" disabled={freeState === 'saving'} aria-busy={freeState === 'saving'}
                  onClick={() => void selectFree()}>
                  {freeState === 'saving' ? 'Switching…' : giving ? 'Switch to Free' : 'Confirm Free plan'}
                </button>
              ) : null}
              {planParam === 'free' && (freeState === 'done' || serverTier === 'free')
                ? <Link href="/dashboard" className="co-btn co-btn-quiet">Go to dashboard</Link>
                : giving
                ? <Link href="/dashboard" className="co-btn co-btn-quiet">Keep {giving}</Link>
                : <Link href="/pricing" className="co-btn co-btn-quiet">See the plans</Link>}
            </div>
          </Panel>
        </div>
      </Shell>
    );
  }

  const meta = TIERS[plan];
  // The plan in force, and a plan that has ended, are shown as "Renew".
  const renewing = ownPlan && serverTier === plan && Boolean(paidUntil) && new Date(paidUntil ?? 0).getTime() > Date.now();
  const lapsedSame = ownPlan && planExpired && paidTier === plan;
  // Paying for a smaller plan than the one in force switches the account DOWN
  // to it (the payment sets the plan). A Growth owner could land here from a
  // pricing link and pay to lose features, with nothing on the page saying so.
  const downgradeFrom = ownPlan && serverTier && !planExpired
    && TIER_ORDER.indexOf(serverTier) > TIER_ORDER.indexOf(plan) ? TIERS[serverTier].name : null;
  const each = billing === 'annual' ? 'each year' : 'each month';
  const cardSame = Boolean(cardPlan && cardPlan.plan === plan && cardPlan.billing === billing);

  if (cardState === 'done' || change === 'done') {
    const paid = cardState === 'done' && cardTotals ? formatMoney(cardTotals.total, cardTotals.currency, { cents: true })
      : change === 'done' && preview?.action === 'charge' ? formatMoney(preview.amount, preview.currency, { cents: true })
      : null;
    return (
      <Shell>
        <div className="co-solo">
          <Panel labelledBy="co-done-title">
            <div className="co-done-mark"><Icon d={I.check} size={28} /></div>
            <h1 id="co-done-title" className="co-h1" style={{ fontSize: 26 }}>
              {change === 'done' ? `You’re now on ${meta.name}` : renewing ? `${meta.name} renewed` : `Welcome to ${meta.name}`}
            </h1>
            <p className="co-tagline">
              Payment confirmed{paid ? `: ${paid}` : ''}. Everything in {meta.name} is switched on
              {account?.card?.renews_on ? ` and renews automatically on ${longDate(account.card.renews_on)}` : ' and renews automatically'}.
              Paddle has emailed your receipt. You can cancel the renewal any time on Plan &amp; billing.
            </p>
            <Link href="/dashboard" className="co-btn">Go to dashboard</Link>
          </Panel>
        </div>
      </Shell>
    );
  }

  // ── What the summary shows ─────────────────────────────────────────────────
  // What is charged is always in US dollars (Paddle's price when it is known,
  // the list price otherwise); the headline follows the Kwacha switch.
  const usdMonthly = cards?.prices?.[plan]?.monthly?.amount ?? meta.priceMonthly;
  const usdAnnual = cards?.prices?.[plan]?.annual?.amount ?? meta.priceAnnual;
  const usd = billing === 'annual' ? usdAnnual : usdMonthly;
  const money = (n: number | null | undefined) => formatMoney(n, cardPrice?.currency ?? 'USD', { cents: true });
  const { currency, fmt, rate } = pricing;
  const kwacha = currency === 'ZMW';
  const saveLine = billing === 'annual'
    ? <><strong>2 months free:</strong> {fmt(usdAnnual)} a year instead of {fmt(usdMonthly * 12)}.</>
    : <>Pay yearly and get <strong>2 months free</strong>: {fmt(usdAnnual)} a year.</>;

  const summary = (
    <Panel labelledBy="co-title" className="co-summary">
      <p className="co-eyebrow">{renewing || lapsedSame ? 'Renew' : 'Subscribe to'}</p>
      <h1 id="co-title" className="co-h1">AIBOS {meta.name}</h1>
      <div className="co-price">
        <span className="co-price-fig">{fmt(usd)}</span>
        <span className="co-price-per">
          {billing === 'annual' ? 'per year' : 'per month'}{kwacha ? ', about' : ''}
        </span>
      </div>
      {kwacha && <p className="co-after" style={{ marginTop: 4 }}>Charged as {money(usd)} {billing === 'annual' ? 'a year' : 'a month'}</p>}
      <p className="co-tagline">{meta.tagline}</p>

      <PriceCurrencySwitch className="co-pcs" currency={currency} onChange={pricing.choose} rate={rate} loading={pricing.loading} />

      <div role="radiogroup" aria-label="Billing period" className="co-seg">
        {(['monthly', 'annual'] as const).map((b) => (
          <button key={b} type="button" role="radio" aria-checked={billing === b} onClick={() => setBilling(b)}
            disabled={choiceLocked && billing !== b}>
            {b === 'monthly' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
      </div>
      <p className="co-save">{saveLine}</p>

      {/* The receipt is in US dollars: it is what the card is charged. */}
      <dl className="co-lines">
        {cardPlan ? (
          <>
            <div className="co-line">
              <dt>AIBOS {meta.name}<span className="co-line-sub">Billed {billing === 'annual' ? 'yearly' : 'monthly'}</span></dt>
              <dd>{money(usd)}</dd>
            </div>
            <div className="co-line co-total">
              <dt>Due today</dt>
              <dd>
                {cardSame ? money(0)
                  : preview ? money(preview.action === 'charge' ? preview.amount : 0)
                  : <span className="co-pending">Shown before you switch</span>}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div className="co-line">
              <dt>AIBOS {meta.name}<span className="co-line-sub">Billed {billing === 'annual' ? 'yearly' : 'monthly'}</span></dt>
              <dd>{money(usd)}</dd>
            </div>
            <div className="co-line">
              <dt>Subtotal</dt>
              <dd>{money(cardTotals?.subtotal ?? usd)}</dd>
            </div>
            <div className="co-line">
              <dt>Sales tax</dt>
              <dd>{cardTotals ? money(cardTotals.tax) : <span className="co-pending">Based on your country</span>}</dd>
            </div>
            <div className="co-line co-total">
              <dt>Total due today</dt>
              <dd>{money(cardTotals?.total ?? usd)}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="co-after">
        {cardPlan
          ? (cardSame ? `You already pay for ${meta.name} by card.` : `Your card plan moves to ${meta.name}. You are never charged for two plans.`)
          : cardTotals?.recurring != null
          ? `Then ${money(cardTotals.recurring)} ${each} from ${firstRenewal(billing)}. Renews automatically until you cancel.`
          : `Then ${money(usd)} ${each} plus any sales tax, from ${firstRenewal(billing)}. Renews automatically until you cancel.`}
      </p>
      {kwacha && rate && <div style={{ marginTop: 12 }}><KwachaNote rate={rate} /></div>}

      <ul className="co-trust">
        {['Renews automatically. Cancel any time on Plan & billing', '30-day money-back guarantee on every payment', 'Your card details go to Paddle, never to AIBOS'].map((t) => (
          <li key={t}><Icon d={I.shield} />{t}</li>
        ))}
      </ul>

      <details className="co-incl">
        <summary><Icon d={I.chevron} />What’s included in {meta.name}</summary>
        <ul>
          {meta.inclusions.map((inc) => (
            <li key={inc}><Icon d={I.check} />{inc}</li>
          ))}
        </ul>
      </details>
    </Panel>
  );

  // ── How to pay ─────────────────────────────────────────────────────────────
  const changeForm = cardPlan && (
    // Already paying by card: a second card plan would charge twice. Move
    // the one there is instead.
    <div className="co-stack" style={{ marginTop: 24 }}>
      {cardPlan.status === 'past_due' || cardPlan.status === 'paused' ? (
        <Note tone="warn" icon="alert">
          <p>
            {cardPlan.status === 'past_due'
              ? 'Your last card payment did not go through. Update your card on Plan & billing first, then you can change plan.'
              : 'Your card plan is paused. Resume it on Plan & billing first, then you can change plan.'}
          </p>
          <p><Link href="/dashboard/billing" className="co-link">Go to Plan &amp; billing</Link></p>
        </Note>
      ) : cardSame ? (
        <Note tone="good" icon="check">
          <p>
            You already pay for {meta.name} by card.{cardPlan.renews_on ? ` It renews automatically on ${longDate(cardPlan.renews_on)}.` : ''}
            {' '}There is nothing to pay here.
          </p>
          <p><Link href="/dashboard/billing" className="co-link">See Plan &amp; billing</Link></p>
        </Note>
      ) : (
        <>
          <Note icon="info">
            You pay for {TIERS[isTier(cardPlan.plan) ? cardPlan.plan : 'pro'].name} by card. Switching moves that same card plan to {meta.name}{billing !== cardPlan.billing ? `, billed ${billing === 'annual' ? 'yearly' : 'monthly'}` : ''}. You are never charged for two plans.
          </Note>
          {change === 'preview' && preview && (
            <Note tone="info" role="status">
              {preview.action === 'charge'
                ? <>Your card is charged <strong>{formatMoney(preview.amount, preview.currency)}</strong> today: the difference for the rest of the time you have already paid for.</>
                : <>You get <strong>{formatMoney(preview.amount, preview.currency)}</strong> of credit for the time you have already paid for. It comes off your next payments.</>}
              {preview.next_amount != null && preview.next_billed_at
                ? <> From {longDate(preview.next_billed_at)} it is {formatMoney(preview.next_amount, preview.currency)} {each}.</>
                : null}
            </Note>
          )}
          {changeError && <Note tone="err" icon="alert" role="alert">{changeError}</Note>}
          {change === 'preview' || change === 'applying' ? (
            <button type="button" className="co-btn" disabled={change === 'applying'} aria-busy={change === 'applying'} onClick={() => void applyChange()}>
              {change === 'applying' ? 'Switching…'
                : preview?.action === 'charge' ? `Switch to ${meta.name} and pay ${formatMoney(preview.amount, preview.currency)}`
                : `Switch to ${meta.name}`}
            </button>
          ) : (
            <button type="button" className="co-btn" disabled={change === 'previewing'} aria-busy={change === 'previewing'} onClick={() => void askChange()}>
              {change === 'previewing' ? 'Working out the price…' : `See the price to switch to ${meta.name}`}
            </button>
          )}
        </>
      )}
    </div>
  );

  const cardForm = cardState === 'confirming' || cardState === 'slow' ? (
    <div style={{ marginTop: 24 }}>
      <Note tone={cardState === 'confirming' ? 'info' : 'good'} icon={cardState === 'confirming' ? 'spin' : 'check'} role="status">
        <p><strong>Payment received.</strong></p>
        <p>
          {cardState === 'confirming'
            ? `Switching ${meta.name} on. This usually takes a few seconds.`
            : `${meta.name} will switch on within a few minutes. You get a note in the bell when it does. Please do not pay again.`}
        </p>
      </Note>
    </div>
  ) : (
    <>
      {(renewing || lapsedSame) && (
        <div style={{ marginTop: 16 }}>
          <Note icon="info">
            {renewing
              ? `Your plan starts again today and renews automatically. Days left on your current payment, to ${longDate(paidUntil as string)}, are not added on.`
              : `Your ${meta.name} plan has ended. Paying now switches it back on today.`}
          </Note>
        </div>
      )}
      {frameActive ? (
        <div className="co-frame-wrap" data-state={cardState}>
          <div className={`${FRAME_CLASS} co-frame`} />
          {cardState !== 'open' && (
            <div className="co-frame-cover">
              {cardState === 'failed' ? (
                <div className="co-stack">
                  <Note tone="err" icon="alert" role="alert">{cardError || 'The card form could not load. No money was taken.'}</Note>
                  <button type="button" className="co-btn co-btn-quiet" onClick={() => setCardRetry((n) => n + 1)}>Try again</button>
                </div>
              ) : (
                <FormSkeleton label="Loading the secure card form" />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="co-frame-wrap" data-state="opening">
          <div className="co-frame-cover"><FormSkeleton label="Loading the secure card form" /></div>
        </div>
      )}
    </>
  );

  // Cards not open to this account yet: how to start a plan meanwhile.
  const notOpen = !ownPlan ? (
    <div style={{ marginTop: 24 }}>
      <Note icon="info">
        This pays for your own account. The business that invited you has its own plan, which only its owner can pay for.
      </Note>
    </div>
  ) : (
    <div className="co-stack" style={{ marginTop: 24 }}>
      <Note tone="info" icon="info">
        <p><strong>Card payments are opening very soon.</strong></p>
        <p>
          To start {meta.name} today, email <a className="co-link" href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(`Start AIBOS ${meta.name}`)}`}>{LEGAL.email}</a> or
          call <a className="co-link" href={LEGAL.phoneHref}>{LEGAL.phoneDisplay}</a> and we will set it up for you.
        </p>
      </Note>
    </div>
  );

  const payment = (
    <Panel labelledBy="co-pay-title">
      <h2 id="co-pay-title" className="co-h2">Pay by card</h2>
      <p className="co-method-sub" style={{ marginTop: 0 }}>
        Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay, in US dollars.
      </p>
      {deciding ? (
        <div className="co-frame-wrap" data-state="opening">
          <div className="co-frame-cover"><FormSkeleton label="Loading the secure card form" /></div>
        </div>
      ) : !cardOffered ? (
        notOpen
      ) : (
        <>
          {cards?.testers_only && (
            <div style={{ marginTop: 16 }}>
              <Note tone="warn" icon="info">
                {cards.stage === 'sandbox'
                  ? 'Test mode: use a Paddle test card. No real money moves.'
                  : 'Only admins can see card payments until the first real one goes through.'}
              </Note>
            </div>
          )}
          {cardPlan ? changeForm : cardForm}
          {!cardPlan && (
            <p className="co-fine">
              <Icon d={I.lock} size={16} />
              <span>Card payments are handled by Paddle, our online reseller. Your card details never reach AIBOS and your statement shows PADDLE.NET.</span>
            </p>
          )}
        </>
      )}
    </Panel>
  );

  return (
    <Shell>
      <div className="co-grid">
        {downgradeFrom && (
          <div className="co-span">
            <Note tone="warn" icon="alert" role="alert">
              You are on {downgradeFrom}. Paying for {meta.name} switches this account to {meta.name} and everything {downgradeFrom} adds is switched off.{' '}
              <Link href="/pricing" className="co-link">Compare plans</Link>
            </Note>
          </div>
        )}
        {summary}
        {payment}
      </div>
      <p className="co-foot">
        By paying you agree to our <Link href="/terms" className="co-link">Terms</Link> and <Link href="/refunds" className="co-link">Refund policy</Link>.
      </p>
    </Shell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="co-page" style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 18 }}>Loading checkout…</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
