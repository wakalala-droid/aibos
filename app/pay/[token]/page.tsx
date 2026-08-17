'use client';
/**
 * Public invoice payment page — the customer's half of the get-paid loop.
 *
 * The person here is NOT an AIBOS user. They followed a link from a WhatsApp
 * message, on a phone, probably on mobile data, and they are about to be asked
 * for money. So this page:
 *   · needs no account, no login, no cookie — the token in the URL is all of it
 *   · says who is asking and what for BEFORE it asks for a number
 *   · never touches the product store or profile (there is no session to read)
 *   · states plainly when mobile money isn't switched on, instead of failing
 *     at the last step after the customer has already typed their number
 *
 * Rendered bare (AppShell BARE_ROUTES) — no sidebar, no app chrome.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getPublicInvoice, initiatePublicPayment, checkPublicPaymentStatus, PublicApiError,
  type PublicInvoice, type PayNetwork,
} from '@/lib/api';
import { symbolForToken } from '@/lib/currency';

// 'invalid'     — the link itself is wrong; a retry will never help.
// 'unavailable' — we couldn't load it; a retry probably will.
// Keeping these apart matters because the advice differs, and because raw
// server text ("fetch failed cause=AggregateError") must never reach a
// customer who is deciding whether this page is safe to pay on.
type Phase = 'loading' | 'invalid' | 'unavailable' | 'ready' | 'waiting' | 'paid' | 'failed';

const NETWORKS: { id: PayNetwork; label: string }[] = [
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'airtel', label: 'Airtel Money' },
];

// Poll while the customer approves the prompt on their handset. MTN/Airtel
// prompts commonly sit for a minute or more, so this waits ~3 minutes before
// telling them to check their phone rather than declaring failure.
const POLL_MS = 3000;
const POLL_LIMIT = 60;

const card: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 24,
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)',
  marginBottom: 4, fontWeight: 600,
};
const input: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border-md)', background: 'var(--bg-input)',
  color: 'var(--text-1)', fontSize: 'var(--fs-body)',
};

export default function PayInvoicePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [networks, setNetworks] = useState<Record<PayNetwork, boolean>>({ mtn: false, airtel: false });
  const [network, setNetwork] = useState<PayNetwork>('mtn');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Cleared on unmount so a resolved payment can't keep polling in the background.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!token) { setPhase('invalid'); return; }
    let cancelled = false;
    (async () => {
      try {
        const { invoice: inv, networks: nets } = await getPublicInvoice(token);
        if (cancelled) return;
        setInvoice(inv);
        setNetworks(nets);
        setNetwork(nets.mtn ? 'mtn' : nets.airtel ? 'airtel' : 'mtn');
        setPhase(inv.status === 'paid' ? 'paid' : 'ready');
      } catch (e) {
        if (cancelled) return;
        // 404 is the only status that means "this link is wrong".
        setPhase(e instanceof PublicApiError && e.status === 404 ? 'invalid' : 'unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const sym = symbolForToken(invoice?.currency ?? 'ZMW');
  const money = (n: number) =>
    `${sym}${n.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const poll = useCallback((reference: string, attempt: number) => {
    timer.current = setTimeout(async () => {
      try {
        const status = await checkPublicPaymentStatus(token, reference);
        if (status === 'successful') { setPhase('paid'); return; }
        if (status === 'failed') {
          setPhase('failed');
          setError('The payment was not completed. You can try again.');
          return;
        }
        if (attempt >= POLL_LIMIT) {
          // Deliberately NOT 'failed': the collection may still complete. Saying
          // "it failed" when the money later leaves their wallet is the worst
          // possible outcome for trust.
          setNotice('Still waiting for confirmation. If you approved the prompt, the payment may still go through — check your phone.');
          return;
        }
        poll(reference, attempt + 1);
      } catch (e) {
        setPhase('failed');
        setError((e as Error).message);
      }
    }, POLL_MS);
  }, [token]);

  async function pay() {
    setError(null); setNotice(null); setPhase('waiting');
    try {
      const { reference } = await initiatePublicPayment(token, network, phone.trim());
      poll(reference, 0);
    } catch (e) {
      setPhase('failed');
      setError((e as Error).message);
    }
  }

  const anyNetworkLive = networks.mtn || networks.airtel;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        <p style={{
          fontSize: 'var(--fs-label)', letterSpacing: '0.08em', textTransform: 'uppercase',
          fontWeight: 700, color: 'var(--text-3)', margin: '0 0 16px', textAlign: 'center',
        }}>
          Secure payment
        </p>

        {phase === 'loading' && <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />}

        {phase === 'invalid' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--fs-h2)', color: 'var(--text-1)', margin: '0 0 8px' }}>
              This link isn’t valid
            </h1>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
              It may have been mistyped or replaced. Please ask the business to send it again.
            </p>
          </div>
        )}

        {phase === 'unavailable' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--fs-h2)', color: 'var(--text-1)', margin: '0 0 8px' }}>
              We can’t load this invoice right now
            </h1>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 16px' }}>
              This is a problem on our side, not with your link. Please try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                minHeight: 44, padding: '0 20px', borderRadius: 10,
                border: '1px solid var(--border-md)', background: 'var(--bg-card)',
                color: 'var(--text-2)', fontWeight: 600, cursor: 'pointer',
                fontSize: 'var(--fs-body)',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {invoice && phase !== 'invalid' && phase !== 'unavailable' && (
          <>
            <div style={{ ...card, marginBottom: 16 }}>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '0 0 4px' }}>
                {invoice.business_name ? `${invoice.business_name} · ` : ''}Invoice {invoice.number}
              </p>
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: '0 0 20px' }}>
                Billed to {invoice.customer_name}
              </p>

              <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                {invoice.lines.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 'var(--fs-body)' }}>
                    <span style={{ color: 'var(--text-2)', minWidth: 0 }}>
                      {l.description}
                      {l.qty !== 1 && <span style={{ color: 'var(--text-4)' }}> × {l.qty}</span>}
                    </span>
                    <span style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {money(l.qty * l.unit_price)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                borderTop: '2px solid var(--border-md)', paddingTop: 16,
              }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)' }}>
                  {phase === 'paid' ? 'Paid' : 'Total due'}
                </span>
                <span style={{
                  fontSize: 'var(--fs-h2)', fontWeight: 700,
                  color: phase === 'paid' ? 'var(--good)' : 'var(--text-1)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {money(invoice.total)}
                </span>
              </div>
              {invoice.due_at && phase !== 'paid' && (
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '8px 0 0', textAlign: 'right' }}>
                  Due {invoice.due_at.slice(0, 10)}
                </p>
              )}
            </div>

            {phase === 'paid' && (
              <div style={{ ...card, textAlign: 'center', borderColor: 'var(--good)' }}>
                <h1 style={{ fontSize: 'var(--fs-h3)', color: 'var(--good)', margin: '0 0 8px' }}>
                  Payment received
                </h1>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
                  Thank you. {invoice.business_name ?? 'The business'} has been notified — this
                  invoice is settled. Keep this page as your reference.
                </p>
              </div>
            )}

            {!invoice.payable && phase !== 'paid' && (
              <div style={{ ...card, textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0 }}>
                  This invoice isn’t awaiting payment. Please check with{' '}
                  {invoice.business_name ?? 'the business'}.
                </p>
              </div>
            )}

            {invoice.payable && phase !== 'paid' && (
              <div style={card}>
                {!anyNetworkLive ? (
                  // Honest, and BEFORE they type a number — not a 503 at the end.
                  <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', margin: 0 }}>
                    Paying by mobile money isn’t switched on for this business yet. Please pay
                    {invoice.business_name ? ` ${invoice.business_name}` : ' them'} the way you
                    normally do — they can mark this invoice as paid.
                  </p>
                ) : (
                  <>
                    <p style={{ ...label, marginBottom: 8 }}>Pay with</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      {NETWORKS.filter(n => networks[n.id]).map(n => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => setNetwork(n.id)}
                          aria-pressed={network === n.id}
                          disabled={phase === 'waiting'}
                          style={{
                            flex: 1, minHeight: 48, borderRadius: 10, cursor: 'pointer',
                            fontSize: 'var(--fs-body)', fontWeight: 600,
                            border: network === n.id ? '2px solid var(--cyan)' : '1px solid var(--border-md)',
                            background: network === n.id ? 'var(--bg-badge)' : 'var(--bg-card)',
                            color: network === n.id ? 'var(--cyan)' : 'var(--text-2)',
                          }}
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>

                    <label htmlFor="payer-phone" style={label}>Your mobile money number</label>
                    <input
                      id="payer-phone"
                      style={input}
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. 0977 123 456"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      disabled={phase === 'waiting'}
                    />

                    {error && (
                      <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-body)', margin: '12px 0 0' }}>
                        {error}
                      </p>
                    )}
                    {notice && (
                      <p role="status" style={{ color: 'var(--warn)', fontSize: 'var(--fs-body)', margin: '12px 0 0' }}>
                        {notice}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => void pay()}
                      disabled={phase === 'waiting' || phone.trim().length < 9}
                      style={{
                        width: '100%', minHeight: 52, marginTop: 16, borderRadius: 10,
                        border: 'none', background: 'var(--cyan)', color: '#08111a',
                        fontSize: 'var(--fs-body)', fontWeight: 700,
                        cursor: phase === 'waiting' ? 'default' : 'pointer',
                        opacity: phase === 'waiting' || phone.trim().length < 9 ? 0.6 : 1,
                      }}
                    >
                      {phase === 'waiting' ? 'Waiting for your approval…' : `Pay ${money(invoice.total)}`}
                    </button>

                    <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '12px 0 0', textAlign: 'center' }}>
                      {phase === 'waiting'
                        ? 'Check your phone and approve the payment prompt. Keep this page open.'
                        : 'You’ll get a prompt on your phone to approve the payment.'}
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '24px 0 0', textAlign: 'center' }}>
          Invoice sent with AIBOS
        </p>
      </div>
    </main>
  );
}
