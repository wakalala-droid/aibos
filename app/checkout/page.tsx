'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { TIERS, isTier, usdApprox, type PaidTier, type Tier } from '@/lib/tiers';
import { initiatePayment, checkPaymentStatus } from '@/lib/api';

// Merchant mobile-money accounts payments are sent to.
const MERCHANT = {
  mtn:    { label: 'MTN Mobile Money', number: '0762561930', ussd: '*115#', bg: '#ffcc00', fg: '#000' },
  airtel: { label: 'Airtel Money',     number: '0973759352', ussd: '*778#', bg: '#e40000', fg: '#fff' },
} as const;

type Network = keyof typeof MERCHANT;

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

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function CheckoutInner() {
  const params = useSearchParams();
  const planParam = params.get('plan');
  // Billing is chosen here (audit #71): default from the URL, but the owner can
  // switch to annual — two months free — right at the point of payment.
  const [billing, setBilling] = useState<'monthly' | 'annual'>(params.get('billing') === 'annual' ? 'annual' : 'monthly');
  const setTier = useStore((s) => s.setTier);
  const { serverTier, paidUntil, ownPlan, planExpired, paidTier, loading: profileLoading, refresh } = useProfile();

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

  if (!isTier(planParam) || planParam === 'free') {
    // Free needs no payment. Someone still on a paid plan of their own is told
    // what they would give up before anything changes.
    const giving = planParam === 'free' && ownPlan && serverTier && serverTier !== 'free' ? TIERS[serverTier].name : null;
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
            : giving
            ? `${giving} switches off straight away${paidUntil ? `, even though it is paid until ${longDate(paidUntil)}` : ''}. Money already paid is not refunded. Your records stay.`
            : 'Financial engine, last 30 days, full P&L and cashflow. No payment needed.'}
        </p>
        {freeState === 'failed' && (
          <p role="alert" style={{ fontSize: 'var(--fs-data)', color: 'var(--crit)', margin: '0 0 16px', lineHeight: 1.5 }}>
            The plan could not be changed just now. Nothing was changed, so please try again.
          </p>
        )}
        {planParam === 'free' && freeState !== 'done' && !profileLoading && (giving || serverTier !== 'free') && (
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
  const period = billing === 'annual' ? 'a year' : 'a month';

  if (status === 'done') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="var(--good)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 10px' }}>
          {renewing ? `${meta.name} renewed` : `Welcome to ${meta.name}`}
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.55 }}>
          Payment confirmed. Everything in {meta.name} is switched on
          {paidUntil && serverTier === planParam ? ` until ${longDate(paidUntil)}` : ''}.
          Nothing renews by itself, and the app reminds you a few days before it ends.
        </p>
        <Link href="/dashboard" style={btnPrimary}>Go to dashboard →</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 64px' }}>
      <Link href="/pricing" style={{ ...linkMuted, display: 'inline-block', marginBottom: 16 }}>← Back to pricing</Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: '0 0 20px', letterSpacing: '-0.02em' }}>
        {renewing || lapsedSame ? `Renew ${meta.name}` : 'Checkout'}
      </h1>

      {(renewing || lapsedSame || !ownPlan) && (
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
            K{amount.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{meta.tagline}</span>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            {periodLabel} · ≈ ${usdApprox(amount)}
          </span>
        </div>
        {/* Monthly / annual choice — annual is two months free (audit #71). */}
        <div role="radiogroup" aria-label="Billing period" style={{ display: 'flex', gap: 8, margin: '14px 0 0' }}>
          {(['monthly', 'annual'] as const).map((b) => {
            const on = billing === b;
            return (
              <button key={b} type="button" role="radio" aria-checked={on} onClick={() => setBilling(b)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${on ? 'var(--cyan)' : 'var(--border-md)'}`, background: on ? 'var(--cyan-dim)' : 'transparent' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-data)', fontWeight: 700, color: 'var(--text-1)' }}>
                  {b === 'monthly' ? 'Monthly' : 'Annual'}
                </span>
                <span style={{ fontSize: 'var(--fs-label)', color: on ? 'var(--cyan)' : 'var(--text-3)' }}>
                  {b === 'monthly' ? `K${meta.priceMonthly.toLocaleString()}/mo` : `K${meta.priceAnnual.toLocaleString()}/yr · 2 months free`}
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Total today: <strong style={{ color: 'var(--text-2)' }}>K{amount.toLocaleString()}</strong> for {period}. No setup fees or add-ons. Nothing renews by itself.
        </p>
      </div>

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

      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>
        Each payment covers {period}. Nothing is taken automatically: when it ends you choose whether to pay again. Your records stay exportable on every plan.
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
