'use client';
/**
 * Public stay payment page (upgrade 3): the guest's half of a booking's
 * payment link.
 *
 * The person here is a guest, not an AI-BOS user, on a phone, probably on
 * mobile data, following a link the property sent on WhatsApp or the email
 * that came with a website booking. So, like the invoice page it is modelled
 * on (app/pay/[token]):
 *   · no account and no login: the token in the address is all of it
 *   · it says whose place, which dates and how much BEFORE asking for a number
 *   · it says plainly when paying online is not switched on yet, before the
 *     guest types anything
 *   · a forwarded link shows the guest's first name only
 *
 * Two ways to pay: a mobile money prompt (MTN, Airtel or Zamtel) or a bank
 * card in Lenco's own secure card window (migration 0049). A website request
 * that is paid in full confirms itself, so the page says which happened.
 *
 * Rendered bare (AppShell BARE_ROUTES covers /pay).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import UrlImage, { LOGO_FIT } from '@/components/ui/UrlImage';
import {
  getPublicStay, initiateStayPayment, checkStayPayment, startStayCardPayment, PublicApiError,
  type PublicStay, type PayNetwork,
} from '@/lib/api';
import { openLencoCardWindow, looksLikeEmail } from '@/lib/lencoPay';
import { symbolForToken } from '@/lib/currency';

type Phase = 'loading' | 'invalid' | 'unavailable' | 'ready' | 'waiting' | 'paid' | 'failed';
type Method = 'momo' | 'card';

const NETWORKS: { id: PayNetwork; label: string }[] = [
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'airtel', label: 'Airtel Money' },
  { id: 'zamtel', label: 'Zamtel Kwacha' },
];
const POLL_MS = 3000;
const POLL_LIMIT = 60;

const card: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24,
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginBottom: 4, fontWeight: 600,
};
const input: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border-md)', background: 'var(--bg-input)',
  color: 'var(--text-1)', fontSize: 'var(--fs-body)',
};
const choice = (on: boolean): React.CSSProperties => ({
  flex: '1 1 120px', minHeight: 48, borderRadius: 10, cursor: 'pointer', fontSize: 'var(--fs-body)', fontWeight: 600,
  border: on ? '2px solid var(--cyan)' : '1px solid var(--border-md)',
  background: on ? 'var(--bg-badge)' : 'var(--bg-card)',
  color: on ? 'var(--cyan)' : 'var(--text-2)',
});

const longDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function PayStayPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [stay, setStay] = useState<PublicStay | null>(null);
  const [networks, setNetworks] = useState<Record<PayNetwork, boolean>>({ mtn: false, airtel: false, zamtel: false });
  const [cardLive, setCardLive] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [method, setMethod] = useState<Method>('momo');
  const [network, setNetwork] = useState<PayNetwork>('mtn');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cardStep, setCardStep] = useState<'window' | 'checking'>('window');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!token) { setPhase('invalid'); return; }
    let cancelled = false;
    (async () => {
      try {
        const { stay: s, networks: nets, card: c, testMode: t } = await getPublicStay(token);
        if (cancelled) return;
        setStay(s);
        setNetworks(nets);
        setCardLive(c);
        setTestMode(t);
        setNetwork(nets.mtn ? 'mtn' : nets.airtel ? 'airtel' : nets.zamtel ? 'zamtel' : 'mtn');
        setMethod(nets.mtn || nets.airtel || nets.zamtel || !c ? 'momo' : 'card');
        setPhase(s.paid_in_full ? 'paid' : 'ready');
      } catch (e) {
        if (cancelled) return;
        setPhase(e instanceof PublicApiError && e.status === 404 ? 'invalid' : 'unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const sym = symbolForToken(stay?.currency ?? 'ZMW') || 'K';
  const money = (n: number) =>
    `${sym}${n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const poll = useCallback((reference: string, attempt: number) => {
    const delay = attempt < POLL_LIMIT ? POLL_MS : POLL_MS * 5;
    timer.current = setTimeout(async () => {
      try {
        const check = await checkStayPayment(token, reference);
        if (check.status === 'successful') {
          setNotice(null); setConfirmed(check.confirmed); setPhase('paid'); return;
        }
        if (check.status === 'failed') {
          setPhase('failed');
          setError('The payment was not completed. You can try again.');
          return;
        }
        if (attempt === POLL_LIMIT) {
          setNotice('Still waiting for confirmation. If you approved the payment, it may still go through. Keep this page open and it will update by itself.');
        }
        poll(reference, attempt + 1);
      } catch (e) {
        const status = e instanceof PublicApiError ? e.status : 0;
        if (status === 404 || status === 403 || status === 400) {
          setPhase('failed');
          setError((e as Error).message);
          return;
        }
        poll(reference, attempt + 1);
      }
    }, delay);
  }, [token]);

  async function payByPhone() {
    setError(null); setNotice(null); setPhase('waiting');
    try {
      const { reference, amount } = await initiateStayPayment(token, network, phone.trim());
      setPaidAmount(amount);
      poll(reference, 0);
    } catch (e) {
      setPhase('failed');
      setError((e as Error).message);
    }
  }

  async function payByCard() {
    if (!stay) return;
    setError(null); setNotice(null); setCardStep('window'); setPhase('waiting');
    try {
      const start = await startStayCardPayment(token);
      setPaidAmount(start.amount);
      const outcome = await openLencoCardWindow(start.script, {
        key: start.public_key, reference: start.reference, email: email.trim(),
        amount: start.amount, currency: start.currency, label: start.label,
        customer: stay.guest_first_name ? { firstName: stay.guest_first_name } : undefined,
      });
      if (outcome === 'closed') {
        // Closed before paying, most of the time. One look, in case the
        // payment finished just as the window shut.
        const check = await checkStayPayment(token, start.reference).catch(() => null);
        if (check?.status === 'successful') { setConfirmed(check.confirmed); setPhase('paid'); return; }
        setPhase('ready');
        setNotice('The card window was closed before the payment finished. You can try again.');
        return;
      }
      setCardStep('checking');
      poll(start.reference, 0);
    } catch (e) {
      setPhase('failed');
      setError((e as Error).message);
    }
  }

  const anyNetworkLive = networks.mtn || networks.airtel || networks.zamtel;
  const anyWayLive = anyNetworkLive || cardLive;
  const place = stay?.business_name ?? 'the property';
  const request = Boolean(stay?.awaiting_confirmation);
  const waiting = phase === 'waiting';
  const phoneReady = phone.trim().length >= 9;
  const emailReady = looksLikeEmail(email);

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <p style={{
          fontSize: 'var(--fs-caps)', letterSpacing: '0.08em', textTransform: 'uppercase',
          fontWeight: 700, color: 'var(--text-3)', margin: '0 0 16px', textAlign: 'center',
        }}>
          {request && phase !== 'paid' ? 'Pay now to confirm your booking' : 'Pay for your stay'}
        </p>

        {phase === 'loading' && <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />}

        {phase === 'invalid' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--fs-h2)', color: 'var(--text-1)', margin: '0 0 8px' }}>This link isn’t valid</h1>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
              It may have been mistyped or replaced. Please ask the property to send it again.
            </p>
          </div>
        )}

        {phase === 'unavailable' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--fs-h2)', color: 'var(--text-1)', margin: '0 0 8px' }}>We can’t load this right now</h1>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 16px' }}>
              This is a problem on our side, not with your link. Please try again in a moment.
            </p>
            <button type="button" onClick={() => window.location.reload()}
              style={{ minHeight: 44, padding: '0 20px', borderRadius: 10, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-2)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-body)' }}>
              Try again
            </button>
          </div>
        )}

        {stay && phase !== 'invalid' && phase !== 'unavailable' && (
          <>
            <div style={{ ...card, marginBottom: 16 }}>
              {stay.business_logo_url && (
                /* Whole and undistorted, on a white plate — same treatment as
                   the invoice page and the dashboard header. */
                <span style={{ height: 48, maxWidth: 180, padding: 8, borderRadius: 10, background: '#fff', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <UrlImage src={stay.business_logo_url} alt={stay.business_name ?? ''} width={180} height={48}
                    onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                    style={LOGO_FIT} />
                </span>
              )}
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 4px' }}>
                {stay.business_name ?? 'Your stay'}{stay.reference ? ` · Ref ${stay.reference}` : ''}
              </p>
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '0 0 16px' }}>
                {stay.guest_first_name ? `For ${stay.guest_first_name}` : 'Your booking'}{stay.unit ? `, ${stay.unit}` : ''}
              </p>

              <div style={{ display: 'grid', gap: 8, marginBottom: 16, fontSize: 'var(--fs-body)' }}>
                <Row k="Arrive" v={longDay(stay.check_in)} />
                <Row k="Leave" v={longDay(stay.check_out)} />
                {stay.nights != null && <Row k="Nights" v={String(stay.nights)} />}
                <Row k="Stay total" v={money(stay.total)} />
                {stay.paid > 0 && <Row k="Paid so far" v={money(stay.paid)} />}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px solid var(--border-md)', paddingTop: 16 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)' }}>
                  {phase === 'paid' ? 'Paid' : stay.is_deposit ? 'Deposit due now' : 'Due now'}
                </span>
                <span style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, color: phase === 'paid' ? 'var(--good)' : 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {money(phase === 'paid' && paidAmount != null ? paidAmount : stay.amount_due)}
                </span>
              </div>
              {request && phase !== 'paid' && (
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '12px 0 0' }}>
                  Your dates are held while you pay. Your booking is confirmed the moment the payment arrives.
                </p>
              )}
            </div>

            {phase === 'paid' && (
              <div style={{ ...card, textAlign: 'center', borderColor: 'var(--good)' }}>
                <h1 style={{ fontSize: 'var(--fs-h3)', color: 'var(--good)', margin: '0 0 8px' }}>
                  {request && confirmed !== false ? 'Paid. Your booking is confirmed' : 'Payment received'}
                </h1>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
                  {request && confirmed === false
                    ? `Thank you. ${place} has your payment and will be in touch shortly about your booking.`
                    : request
                      ? `Thank you. Your dates at ${place} are yours. Keep this page as your reference.`
                      : `Thank you. ${place} can see it on your booking already. Keep this page as your reference.`}
                </p>
              </div>
            )}

            {!stay.payable && phase !== 'paid' && (
              <div style={{ ...card, textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
                  Nothing is due on this booking right now. Please check with {place}.
                </p>
              </div>
            )}

            {stay.payable && phase !== 'paid' && (
              <div style={card}>
                {!anyWayLive ? (
                  <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: 0 }}>
                    Paying online isn’t switched on here yet. Please pay {place} the way you
                    agreed and they will mark your booking paid.
                  </p>
                ) : (
                  <>
                    {testMode && (
                      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--warn)', margin: '0 0 12px' }}>
                        Test mode: no real money moves.
                      </p>
                    )}
                    {anyNetworkLive && cardLive && (
                      <div role="group" aria-label="How to pay" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        <button type="button" onClick={() => { setMethod('momo'); setError(null); setNotice(null); }}
                          aria-pressed={method === 'momo'} disabled={waiting} style={choice(method === 'momo')}>
                          Mobile money
                        </button>
                        <button type="button" onClick={() => { setMethod('card'); setError(null); setNotice(null); }}
                          aria-pressed={method === 'card'} disabled={waiting} style={choice(method === 'card')}>
                          Bank card
                        </button>
                      </div>
                    )}

                    {method === 'momo' && anyNetworkLive && (
                      <>
                        <p style={{ ...label, marginBottom: 8 }}>Pay with</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                          {NETWORKS.filter(n => networks[n.id]).map(n => (
                            <button key={n.id} type="button" onClick={() => setNetwork(n.id)} aria-pressed={network === n.id}
                              disabled={waiting} style={choice(network === n.id)}>
                              {n.label}
                            </button>
                          ))}
                        </div>

                        <label htmlFor="payer-phone" style={label}>Your mobile money number</label>
                        <input id="payer-phone" style={input} value={phone} onChange={e => setPhone(e.target.value)}
                          placeholder="e.g. 0977 123 456" type="tel" inputMode="tel" autoComplete="tel" disabled={waiting} />
                      </>
                    )}

                    {method === 'card' && cardLive && (
                      <>
                        <label htmlFor="payer-email" style={label}>Your email, for the card receipt</label>
                        <input id="payer-email" style={input} value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" disabled={waiting} />
                      </>
                    )}

                    {error && <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-body)', margin: '12px 0 0' }}>{error}</p>}
                    {notice && <p role="status" style={{ color: 'var(--warn)', fontSize: 'var(--fs-body)', margin: '12px 0 0' }}>{notice}</p>}

                    {method === 'momo' ? (
                      <button type="button" onClick={() => void payByPhone()} disabled={waiting || !phoneReady}
                        style={{
                          width: '100%', minHeight: 52, marginTop: 16, borderRadius: 10, border: 'none',
                          background: 'var(--brand-fill)', color: 'var(--on-brand)', fontSize: 'var(--fs-body)', fontWeight: 700,
                          cursor: waiting ? 'default' : 'pointer', opacity: waiting || !phoneReady ? 0.6 : 1,
                        }}>
                        {waiting ? 'Waiting for your approval…' : `Pay ${money(stay.amount_due)}`}
                      </button>
                    ) : (
                      <button type="button" onClick={() => void payByCard()} disabled={waiting || !emailReady}
                        style={{
                          width: '100%', minHeight: 52, marginTop: 16, borderRadius: 10, border: 'none',
                          background: 'var(--brand-fill)', color: 'var(--on-brand)', fontSize: 'var(--fs-body)', fontWeight: 700,
                          cursor: waiting ? 'default' : 'pointer', opacity: waiting || !emailReady ? 0.6 : 1,
                        }}>
                        {waiting ? (cardStep === 'window' ? 'Finish in the card window…' : 'Checking your payment…')
                          : `Pay ${money(stay.amount_due)} by card`}
                      </button>
                    )}

                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '12px 0 0', textAlign: 'center' }}>
                      {method === 'momo'
                        ? (waiting
                          ? 'Check your phone and approve the payment prompt. Keep this page open.'
                          : 'You’ll get a prompt on your phone to approve the payment.')
                        : 'Any bank’s Visa or Mastercard. You type your card in Lenco’s secure window, so your card details never reach this page.'}
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '24px 0 0', textAlign: 'center' }}>
          Payment page by AI-BOS
        </p>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-3)' }}>{k}</span>
      <span style={{ color: 'var(--text-1)', textAlign: 'right' }}>{v}</span>
    </div>
  );
}
