'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { TIERS, TIER_ORDER, isTier, usdApprox, type PaidTier, type Tier } from '@/lib/tiers';
import {
  initiatePayment, checkPaymentStatus, getCardConfig, getMyBilling, startCardCheckout,
  previewCardChange, confirmCardChange,
  type CardConfig, type CardChangePreview, type MyBilling,
} from '@/lib/api';
import { closeCardCheckout, formatMoney, openCardCheckout, type PaddleEvent } from '@/lib/paddle';

// Merchant mobile-money accounts payments are sent to.
const MERCHANT = {
  mtn:    { label: 'MTN Mobile Money', number: '0762561930', ussd: '*115#', bg: '#ffcc00', fg: '#000' },
  airtel: { label: 'Airtel Money',     number: '0973759352', ussd: '*778#', bg: '#e40000', fg: '#fff' },
} as const;

type Network = keyof typeof MERCHANT;
type Method = 'mobile' | 'card';

// Checking a mobile money approval. People approve on their phone in their own
// time, and MTN and Airtel can take minutes to report back. The page used to
// give up after 60 seconds and offer "Try again", which started a SECOND
// charge while the first could still go through. Now it checks quickly for a
// few minutes, then keeps checking slowly for as long as the page is open, and
// never invites a second payment while the first is undecided.
const FAST_POLL_MS = 2_500;
const FAST_POLL_FOR_MS = 3 * 60_000;
const SLOW_POLL_MS = 15_000;
/** Consecutive "no such payment" answers before we say we lost track of it. */
const UNKNOWN_LIMIT = 4;

// After Paddle says a card payment is complete, the plan is switched on by
// Paddle's webhook to the API, not by this page. Wait for the API to agree.
// A sleeping API can take most of a minute to wake, so wait generously, and
// never offer to pay again: the money has already gone.
const CARD_CONFIRM_POLL_MS = 3_000;
const CARD_CONFIRM_FOR_MS = 3 * 60_000;

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Paddle statuses of a card plan that is still going (renews by itself). */
const LIVE_CARD = ['active', 'trialing', 'past_due', 'paused'];

function CheckoutInner() {
  const params = useSearchParams();
  const planParam = params.get('plan');
  // Billing is chosen here (audit #71): default from the URL, but the owner can
  // switch to annual — two months free — right at the point of payment.
  const [billing, setBilling] = useState<'monthly' | 'annual'>(params.get('billing') === 'annual' ? 'annual' : 'monthly');
  const setTier = useStore((s) => s.setTier);
  const { serverTier, paidUntil, ownPlan, planExpired, paidTier, isAdmin, loading: profileLoading, refresh } = useProfile();

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

  // ── How to pay: mobile money (Kwacha) or card (US dollars, through Paddle) ──
  const [method, setMethod] = useState<Method>(params.get('method') === 'card' ? 'card' : 'mobile');
  const [cards, setCards] = useState<CardConfig | null>(null);
  const [account, setAccount] = useState<MyBilling | null>(null);

  useEffect(() => {
    let alive = true;
    void getCardConfig().then((c) => { if (alive) setCards(c); });
    getMyBilling().then((b) => { if (alive) setAccount(b); }).catch(() => { /* card plan unknown: offer a new one */ });
    return () => { alive = false; };
  }, []);

  const [network, setNetwork] = useState<Network>('mtn');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle');
  const [slow, setSlow] = useState(false);       // past the quick-check window, still waiting
  const [lost, setLost] = useState(false);       // the server no longer knows this payment
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll the collection status until it resolves. See FAST_POLL_FOR_MS above.
  useEffect(() => {
    if (status !== 'pending' || !reference) return;
    let active = true;
    let unknown = 0;
    const started = Date.now();
    const tick = async () => {
      if (!active) return;
      try {
        const r = await checkPaymentStatus(reference);
        if (!active) return;
        if (r.status === 'successful') {
          // The backend already granted the tier server-side on confirmation;
          // reflect it locally for instant UX, then re-read the real answer
          // (and the new end date) from the server.
          if (isTier(planParam) && planParam !== 'free') cacheTier(planParam);
          setStatus('done');
          void refresh();
          return;
        }
        if (r.status === 'failed') {
          setStatus('failed');
          setError('The payment was declined or cancelled. No money was taken, so you can try again.');
          return;
        }
        unknown = r.status === 'unknown' ? unknown + 1 : 0;
        if (unknown >= UNKNOWN_LIMIT) {
          setLost(true);
          return;
        }
      } catch { /* a dropped connection: keep checking */ }
      const fast = Date.now() - started < FAST_POLL_FOR_MS;
      if (!fast) setSlow(true);
      pollRef.current = setTimeout(tick, fast ? FAST_POLL_MS : SLOW_POLL_MS);
    };
    pollRef.current = setTimeout(tick, FAST_POLL_MS);
    return () => { active = false; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [status, reference, planParam, cacheTier, refresh]);

  const startPayment = async () => {
    setError('');
    setSlow(false);
    setLost(false);
    setStatus('pending');
    try {
      const r = await initiatePayment({
        network,
        plan: planParam as PaidTier,
        billing,
        payer_phone: phone,
      });
      setReference(r.reference);
      // The polling effect takes over from here.
    } catch (e) {
      setStatus('failed');
      setError((e as Error).message || 'Could not start the payment. Please try again.');
    }
  };

  // ── Card: a new card plan through Paddle's checkout ─────────────────────────
  // idle → opening (asking the API for a transaction) → open (Paddle's form is
  // up) → confirming (Paddle took the money, waiting for the API) → done.
  const [cardState, setCardState] = useState<'idle' | 'opening' | 'open' | 'confirming' | 'slow' | 'done'>('idle');
  const [cardError, setCardError] = useState('');
  const cardPaid = useRef(false);
  const cardPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After "completed", wait for the API to have switched the plan on.
  useEffect(() => {
    if (cardState !== 'confirming' || !isTier(planParam)) return;
    let active = true;
    const started = Date.now();
    const tick = async () => {
      if (!active) return;
      try {
        const b = await getMyBilling();
        if (!active) return;
        if (b.own_plan && b.plan === planParam && b.state === 'active') {
          setAccount(b);
          if (planParam !== 'free') cacheTier(planParam);
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
  }, [cardState, planParam, cacheTier, refresh]);

  const onPaddle = useCallback((e: PaddleEvent) => {
    if (e.name === 'checkout.completed') {
      cardPaid.current = true;
      setCardState('confirming');
      // Let Paddle's own "thank you" show for a moment, then take over.
      setTimeout(() => closeCardCheckout(), 1_800);
    } else if (e.name === 'checkout.closed') {
      if (!cardPaid.current) setCardState('idle');
    } else if (e.name === 'checkout.error') {
      setCardError('The card checkout ran into a problem. No money was taken. Please try again.');
      setCardState('idle');
    }
  }, []);

  const startCard = async () => {
    if (!isTier(planParam) || planParam === 'free') return;
    setCardError('');
    cardPaid.current = false;
    setCardState('opening');
    try {
      const t = await startCardCheckout(planParam, billing);
      await openCardCheckout({ transactionId: t.transaction_id, token: t.client_token, environment: t.environment, onEvent: onPaddle });
      setCardState('open');
    } catch (e) {
      setCardState('idle');
      setCardError((e as Error).message || 'The card checkout could not start. Please try again.');
    }
  };

  // ── Card: moving an existing card plan to another plan ─────────────────────
  const [change, setChange] = useState<'idle' | 'previewing' | 'preview' | 'applying' | 'done'>('idle');
  const [preview, setPreview] = useState<CardChangePreview | null>(null);
  const [changeError, setChangeError] = useState('');

  // A different plan or period chosen: an old price no longer applies.
  useEffect(() => { setChange('idle'); setPreview(null); setChangeError(''); }, [billing, planParam]);

  const askChange = async () => {
    if (!isTier(planParam) || planParam === 'free') return;
    setChangeError('');
    setChange('previewing');
    try {
      setPreview(await previewCardChange(planParam, billing));
      setChange('preview');
    } catch (e) {
      setChange('idle');
      setChangeError((e as Error).message || 'Could not work out the price of the change. Please try again.');
    }
  };

  const applyChange = async () => {
    if (!isTier(planParam) || planParam === 'free') return;
    setChangeError('');
    setChange('applying');
    try {
      await confirmCardChange(planParam, billing);
      cacheTier(planParam);
      setChange('done');
      void refresh();
      getMyBilling().then(setAccount).catch(() => {});
    } catch (e) {
      setChange('preview');
      setChangeError((e as Error).message || 'The plan was not changed. Please try again.');
    }
  };

  if (!isTier(planParam) || planParam === 'free') {
    // Free needs no payment. Someone still on a paid plan of their own is told
    // what they would give up before anything changes.
    const giving = planParam === 'free' && ownPlan && serverTier && serverTier !== 'free' ? TIERS[serverTier].name : null;
    const byCard = account?.card && LIVE_CARD.includes(account.card.status) && !account.card.cancel_at;
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 12px' }}>
          {planParam !== 'free' ? 'Choose a plan first'
            : freeState === 'done' || (!giving && serverTier === 'free') ? 'You’re on the Free plan'
            : giving ? `Switch from ${giving} to Free?` : 'The Free plan'}
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.55 }}>
          {planParam !== 'free'
            ? 'Head back to pricing to pick a plan.'
            : freeState === 'done'
            ? 'Your records are all still here. You can move to a paid plan again whenever you like.'
            : giving && byCard
            ? `${giving} renews by itself on your card. To stop paying, cancel the renewal on Plan & billing: ${giving} then stays on until the end of what you paid. Your records stay.`
            : giving
            ? `${giving} switches off straight away${paidUntil ? `, even though it is paid until ${longDate(paidUntil)}` : ''}. Money already paid is not refunded. Your records stay.`
            : 'Financial engine, last 30 days, full P&L and cashflow. No payment needed.'}
        </p>
        {freeState === 'failed' && (
          <p role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: '0 0 16px', lineHeight: 1.5 }}>
            The plan could not be changed just now. Nothing was changed, so please try again.
          </p>
        )}
        {planParam === 'free' && giving && byCard ? (
          <Link href="/dashboard/billing" style={btnPrimary}>Go to Plan &amp; billing</Link>
        ) : planParam === 'free' && freeState !== 'done' && !profileLoading && (giving || serverTier !== 'free') && (
          <button type="button" disabled={freeState === 'saving'} onClick={() => void selectFree()}
            style={{ ...btnPrimary, opacity: freeState === 'saving' ? 0.6 : 1, cursor: freeState === 'saving' ? 'default' : 'pointer' }}>
            {freeState === 'saving' ? 'Switching…' : giving ? 'Switch to Free' : 'Confirm Free plan'}
          </button>
        )}
        <div style={{ marginTop: 16 }}>
          {planParam === 'free' && (freeState === 'done' || serverTier === 'free')
            ? <Link href="/dashboard" style={linkMuted}>Go to dashboard →</Link>
            : giving
            ? <Link href="/dashboard" style={linkMuted}>Keep {giving}</Link>
            : <Link href="/pricing" style={linkMuted}>← Back to pricing</Link>}
        </div>
      </div>
    );
  }

  const meta = TIERS[planParam];
  const amount = billing === 'annual' ? meta.priceAnnual : meta.priceMonthly;
  const periodLabel = billing === 'annual' ? 'per year' : 'per month';
  const m = MERCHANT[network];
  // Paying for the plan already in force extends it from its current end date
  // (aibos-api paid_period_end), so say so rather than selling it as new.
  const renewing = ownPlan && serverTier === planParam && Boolean(paidUntil) && new Date(paidUntil ?? 0).getTime() > Date.now();
  const lapsedSame = ownPlan && planExpired && paidTier === planParam;
  // Paying for a smaller plan than the one in force switches the account DOWN
  // to it (the payment sets the plan). A Growth owner could land here from a
  // pricing link and pay to lose features, with nothing on the page saying so.
  const downgradeFrom = ownPlan && serverTier && !planExpired
    && TIER_ORDER.indexOf(serverTier) > TIER_ORDER.indexOf(planParam) ? TIERS[serverTier].name : null;
  const period = billing === 'annual' ? 'a year' : 'a month';

  // Card: offered when Paddle is set up. While it is being tested (a sandbox
  // key on the server) only an admin sees it: test cards work there.
  const cardPrice = cards?.prices?.[planParam]?.[billing] ?? null;
  const cardOffered = Boolean(cards?.enabled && cardPrice && (!cards.testers_only || isAdmin) && ownPlan);
  const payBy: Method = cardOffered ? method : 'mobile';
  const cardPlan = account?.card && LIVE_CARD.includes(account.card.status) ? account.card : null;
  const cardSame = Boolean(cardPlan && cardPlan.plan === planParam && cardPlan.billing === billing);
  const cardMonthly = cards?.prices?.[planParam]?.monthly ?? null;
  const cardAnnual = cards?.prices?.[planParam]?.annual ?? null;

  if (status === 'done' || cardState === 'done' || change === 'done') {
    const byCard = cardState === 'done' || change === 'done';
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="var(--good)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 10px' }}>
          {change === 'done' ? `You’re now on ${meta.name}` : renewing ? `${meta.name} renewed` : `Welcome to ${meta.name}`}
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.55 }}>
          {byCard ? (
            <>
              Payment confirmed. Everything in {meta.name} is switched on
              {account?.card?.renews_on ? ` and renews by itself on ${longDate(account.card.renews_on)}` : ''}.
              Paddle has emailed your receipt. You can cancel the renewal any time on Plan &amp; billing.
            </>
          ) : (
            <>
              Payment confirmed. Everything in {meta.name} is switched on
              {paidUntil && serverTier === planParam ? ` until ${longDate(paidUntil)}` : ''}.
              It renews on the same day each {billing === 'annual' ? 'year' : 'month'}. AIBOS reminds you before then and nothing is taken until you approve it.
            </>
          )}
        </p>
        <Link href="/dashboard" style={btnPrimary}>Go to dashboard →</Link>
      </div>
    );
  }

  const shownAmount = payBy === 'card' && cardPrice ? formatMoney(cardPrice.amount, cardPrice.currency) : `K${amount.toLocaleString()}`;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 64px' }}>
      <Link href="/pricing" style={{ ...linkMuted, display: 'inline-block', marginBottom: 16 }}>← Back to pricing</Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 20px', letterSpacing: '-0.02em' }}>
        {renewing || lapsedSame ? `Renew ${meta.name}` : 'Checkout'}
      </h1>

      {downgradeFrom && (
        <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', margin: '0 0 16px', lineHeight: 1.55, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)' }}>
          You are on {downgradeFrom}. Paying for {meta.name} switches this account to {meta.name} and everything {downgradeFrom} adds is switched off. <Link href="/pricing" style={{ color: 'var(--cyan)' }}>Compare plans</Link>
        </p>
      )}

      {payBy === 'mobile' && (renewing || lapsedSame || !ownPlan) && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '0 0 16px', lineHeight: 1.55 }}>
          {renewing
            ? `Your ${meta.name} plan runs until ${longDate(paidUntil as string)}. Paying now adds ${period} after that date, so you lose no days.`
            : lapsedSame
            ? `Your ${meta.name} plan has ended. Paying now switches it back on today for ${period}.`
            : 'This pays for your own account. The business that invited you has its own plan, which only its owner can pay for.'}
        </p>
      )}

      {/* Order summary — full price up front, no drip pricing. */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Order summary
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
            AIBOS {meta.name}
          </span>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-1)' }}>
            {shownAmount}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{meta.tagline}</span>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {payBy === 'card' ? `${periodLabel}, renews by itself` : `${periodLabel} · ≈ $${usdApprox(amount)}`}
          </span>
        </div>
        {/* Monthly / annual choice — annual is two months free (audit #71). */}
        <div role="radiogroup" aria-label="Billing period" style={{ display: 'flex', gap: 8, margin: '14px 0 0' }}>
          {(['monthly', 'annual'] as const).map((b) => {
            const on = billing === b;
            const byCard = payBy === 'card' && cardMonthly && cardAnnual;
            return (
              <button key={b} type="button" role="radio" aria-checked={on} onClick={() => setBilling(b)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${on ? 'var(--cyan)' : 'var(--border-md)'}`, background: on ? 'var(--cyan-dim)' : 'transparent' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-data)', fontWeight: 700, color: 'var(--text-1)' }}>
                  {b === 'monthly' ? 'Monthly' : 'Annual'}
                </span>
                <span style={{ fontSize: 'var(--fs-label)', color: on ? 'var(--cyan)' : 'var(--text-3)' }}>
                  {byCard
                    ? (b === 'monthly' ? `${formatMoney(cardMonthly!.amount, cardMonthly!.currency)}/mo` : `${formatMoney(cardAnnual!.amount, cardAnnual!.currency)}/yr · 2 months free`)
                    : (b === 'monthly' ? `K${meta.priceMonthly.toLocaleString()}/mo` : `K${meta.priceAnnual.toLocaleString()}/yr · 2 months free`)}
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '12px 0 0', lineHeight: 1.5 }}>
          {payBy === 'card'
            ? <>Total today: <strong style={{ color: 'var(--text-2)' }}>{shownAmount}</strong> for {period}, plus any sales tax where you live. Then the same on the same day each {billing === 'annual' ? 'year' : 'month'} until you cancel.</>
            : <>Total today: <strong style={{ color: 'var(--text-2)' }}>K{amount.toLocaleString()}</strong> for {period}. No setup fees or add-ons. Nothing is taken without your approval.</>}
        </p>
      </div>

      {/* How to pay. Mobile money first: it is how most owners here pay. */}
      {cardOffered && (
        <div role="radiogroup" aria-label="How to pay" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {([
            ['mobile', 'Mobile money', 'MTN or Airtel, in Kwacha'],
            ['card', 'Card', `Visa, Mastercard and more${cards?.stage === 'sandbox' ? ' · test mode' : cards?.testers_only ? ' · only admins see this yet' : ''}`],
          ] as const).map(([key, label, sub]) => {
            const on = payBy === key;
            return (
              <button key={key} type="button" role="radio" aria-checked={on}
                onClick={() => { setMethod(key); setCardError(''); }}
                style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${on ? 'var(--cyan)' : 'var(--border-md)'}`,
                  background: on ? 'color-mix(in srgb, var(--cyan) 8%, transparent)' : 'var(--bg-card)' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{label}</span>
                <span style={{ fontSize: 'var(--fs-label)', color: on ? 'var(--cyan)' : 'var(--text-3)' }}>{sub}</span>
              </button>
            );
          })}
        </div>
      )}

      {payBy === 'card' ? (
        cardPlan ? (
          // Already paying by card: a second card plan would charge twice. Move
          // the one there is instead.
          <div className="section-card" style={{ marginBottom: 16 }}>
            {cardPlan.status === 'past_due' || cardPlan.status === 'paused' ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                {cardPlan.status === 'past_due'
                  ? 'Your last card payment did not go through. Update your card on Plan & billing first, then you can change plan.'
                  : 'Your card plan is paused. Resume it on Plan & billing first, then you can change plan.'}{' '}
                <Link href="/dashboard/billing" style={{ color: 'var(--cyan)' }}>Go to Plan &amp; billing</Link>
              </p>
            ) : cardSame ? (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                You already pay for {meta.name} by card.{cardPlan.renews_on ? ` It renews by itself on ${longDate(cardPlan.renews_on)}.` : ''}
                {' '}There is nothing to pay here. <Link href="/dashboard/billing" style={{ color: 'var(--cyan)' }}>See Plan &amp; billing</Link>
              </p>
            ) : (
              <>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
                  You pay for {TIERS[isTier(cardPlan.plan) ? cardPlan.plan : 'pro'].name} by card. Switching moves that same card plan to {meta.name}{billing !== cardPlan.billing ? `, billed ${billing === 'annual' ? 'yearly' : 'monthly'}` : ''}. You are never charged for two plans.
                </p>
                {change === 'preview' && preview && (
                  <div role="status" style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-1)', margin: 0, lineHeight: 1.6 }}>
                      {preview.action === 'charge'
                        ? <>Your card is charged <strong>{formatMoney(preview.amount, preview.currency)}</strong> today: the difference for the rest of the time you have already paid for.</>
                        : <>You get <strong>{formatMoney(preview.amount, preview.currency)}</strong> of credit for the time you have already paid for. It comes off your next payments.</>}
                      {preview.next_amount != null && preview.next_billed_at
                        ? <> From {longDate(preview.next_billed_at)} it is {formatMoney(preview.next_amount, preview.currency)} each {billing === 'annual' ? 'year' : 'month'}.</>
                        : null}
                    </p>
                  </div>
                )}
                {changeError && (
                  <p role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: '0 0 12px', lineHeight: 1.5 }}>{changeError}</p>
                )}
                {change === 'preview' || change === 'applying' ? (
                  <button type="button" disabled={change === 'applying'} onClick={() => void applyChange()}
                    style={{ ...btnPrimary, width: '100%', opacity: change === 'applying' ? 0.6 : 1, cursor: change === 'applying' ? 'wait' : 'pointer' }}>
                    {change === 'applying' ? 'Switching…'
                      : preview?.action === 'charge' ? `Switch to ${meta.name} and pay ${formatMoney(preview.amount, preview.currency)}`
                      : `Switch to ${meta.name}`}
                  </button>
                ) : (
                  <button type="button" disabled={change === 'previewing'} onClick={() => void askChange()}
                    style={{ ...btnPrimary, width: '100%', opacity: change === 'previewing' ? 0.6 : 1, cursor: change === 'previewing' ? 'wait' : 'pointer' }}>
                    {change === 'previewing' ? 'Working out the price…' : `See the price to switch to ${meta.name}`}
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="section-card" style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                Pay by Visa, Mastercard, American Express, PayPal, Apple Pay or Google Pay. The card form is Paddle’s, our online reseller, so your card details never reach AIBOS. Your statement shows <strong>PADDLE.NET</strong>.
              </p>
              {(renewing || lapsedSame) && (
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '10px 0 0', lineHeight: 1.55 }}>
                  {renewing
                    ? `A card plan starts today and renews by itself. Days left on your current payment, to ${longDate(paidUntil as string)}, are not added on.`
                    : `Your ${meta.name} plan has ended. Paying now switches it back on today.`}
                </p>
              )}
            </div>

            {(cardState === 'confirming' || cardState === 'slow') && (
              <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)' }}>
                {cardState === 'confirming' && (
                  <span aria-hidden="true" style={{ width: 16, height: 16, marginTop: 3, borderRadius: '50%', border: '2px solid var(--cyan)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                )}
                <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                  {cardState === 'confirming'
                    ? `Paddle has taken the payment. Switching ${meta.name} on…`
                    : `Paddle has taken the payment and ${meta.name} will switch on within a few minutes. You get a note in the bell when it does. Please do not pay again.`}
                </p>
              </div>
            )}

            {cardError && (
              <p role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: '0 0 12px', lineHeight: 1.5 }}>{cardError}</p>
            )}

            {cardState !== 'confirming' && cardState !== 'slow' && (
              <button type="button" disabled={cardState === 'opening' || cardState === 'open'} onClick={() => void startCard()}
                style={{ ...btnPrimary, width: '100%', opacity: cardState === 'idle' ? 1 : 0.6, cursor: cardState === 'idle' ? 'pointer' : 'wait' }}>
                {cardState === 'opening' ? 'Opening the secure card form…'
                  : cardState === 'open' ? 'Finish in the card form'
                  : `Pay ${shownAmount} by card`}
              </button>
            )}
          </>
        )
      ) : (
        <>
          {/* Network selection */}
          <fieldset className="section-card" style={{ marginBottom: 16, border: '1px solid var(--border)' }}>
            <legend style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px' }}>
              Pay with mobile money
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              {(Object.keys(MERCHANT) as Network[]).map((net) => {
                const info = MERCHANT[net];
                const active = network === net;
                return (
                  <button
                    key={net}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setNetwork(net)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                      border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-md)'}`,
                      background: active ? 'color-mix(in srgb, var(--cyan) 8%, transparent)' : 'var(--bg-card)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: info.fg, background: info.bg, padding: '4px 8px', borderRadius: 6 }}>
                      {net === 'mtn' ? 'MTN' : 'Airtel'}
                    </span>
                    <span style={{ fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-2)' }}>
                      {info.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Payment instructions for the chosen network */}
            <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-badge)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                Enter your {m.label} number below and tap <strong>Pay</strong>. You’ll get a prompt
                on your phone to approve <strong>K{amount.toLocaleString()}</strong>.
              </p>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '8px 0 0' }}>
                Prefer manual? Dial {m.ussd} and send to {m.number} (AIBOS · {m.label}).
              </p>
            </div>

            {/* Payer's own number — the line that receives the approval prompt */}
            <div style={{ marginTop: 14 }}>
              <label htmlFor="payer-phone" style={{ display: 'block', fontSize: 'var(--fs-data)', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                Your {m.label} number <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(required)</span>
              </label>
              <input
                id="payer-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 097 123 4567"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  border: '1px solid var(--border-md)', background: 'var(--bg-input)',
                  color: 'var(--text-1)', fontSize: 'var(--fs-body)',
                  outline: 'none',
                }}
              />
            </div>
          </fieldset>

          {status === 'pending' && !lost && (
            <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--cyan-dim)', border: '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)' }}>
              <span aria-hidden="true" style={{ width: 16, height: 16, marginTop: 3, borderRadius: '50%', border: '2px solid var(--cyan)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-2)', margin: 0, lineHeight: 1.45 }}>
                  {slow
                    ? `Still waiting for ${m.label} to confirm. If you approved the prompt, it will show here on its own. Please do not pay again.`
                    : `Check your phone and approve the ${m.label} prompt for K${amount.toLocaleString()}.`}
                </p>
                {slow && reference && (
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '6px 0 0', lineHeight: 1.45 }}>
                    Payment reference {reference}. Keep this page open, or quote the reference to support.
                  </p>
                )}
              </div>
            </div>
          )}

          {lost && (
            <div role="alert" style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 12, border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)' }}>
              <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-1)', margin: 0, lineHeight: 1.5 }}>
                We lost track of this payment on our side. If money left your {m.label} account, do not pay again:
                contact support with reference <strong>{reference}</strong> and we will switch {meta.name} on.
              </p>
              <button type="button" onClick={() => { setLost(false); setSlow(false); setReference(''); setStatus('idle'); }}
                style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-data)', fontWeight: 600, cursor: 'pointer' }}>
                No money left my account, start again
              </button>
            </div>
          )}

          {status === 'failed' && error && (
            <p role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={phone.trim().length < 9 || status === 'pending'}
            onClick={startPayment}
            style={{
              ...btnPrimary,
              width: '100%',
              opacity: phone.trim().length < 9 || status === 'pending' ? 0.55 : 1,
              cursor: phone.trim().length < 9 || status === 'pending' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'pending'
              ? 'Waiting for confirmation…'
              : status === 'failed'
              ? 'Try again'
              : `Pay K${amount.toLocaleString()} with ${m.label}`}
          </button>
        </>
      )}

      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>
        {payBy === 'card'
          ? <>A card plan renews by itself until you cancel it on Plan &amp; billing. It then stays on until the end of what you paid. Every card payment has a 30-day money-back guarantee.</>
          : <>Each payment covers {period}. Nothing is taken automatically: when it ends you choose whether to pay again. Your records stay exportable on every plan.</>}
      </p>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textAlign: 'center', margin: '8px 0 0', lineHeight: 1.5 }}>
        By paying you agree to our <Link href="/terms" style={{ color: 'var(--text-3)' }}>Terms</Link> and <Link href="/refunds" style={{ color: 'var(--text-3)' }}>Refund policy</Link>.
      </p>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-block', textAlign: 'center',
  fontSize: 'var(--fs-body)', fontWeight: 700,
  color: '#fff', background: 'var(--cyan)', padding: '13px 22px',
  borderRadius: 10, border: 'none', textDecoration: 'none',
};

const linkMuted: React.CSSProperties = {
  fontSize: 'var(--fs-label)',
  color: 'var(--text-3)', textDecoration: 'none',
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading checkout…</div>}>
      <CheckoutInner />
    </Suspense>
  );
}
