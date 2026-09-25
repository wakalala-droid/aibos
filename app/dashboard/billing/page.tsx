'use client';
/**
 * AIBOS: Plan & billing (upgrades 1 and 2).
 *
 * Only the admin could see when a customer's plan ends and what they had paid.
 * An owner learned their plan was ending from a reminder, had nowhere to check
 * a payment and nothing to hand their accountant. This page is theirs: the
 * plan in plain words, when it renews and for how much, and every payment with
 * a receipt to download.
 *
 * Everything shown comes from GET /me/billing, which reads the same records
 * the renewal run and the admin page use. Staff working in someone else's
 * business are told the owner manages it, and see none of the payments.
 *
 * Every plan is paid by card (Paddle) and renews automatically (25 September
 * 2026): cancel the renewal (it stays on to the end of what is paid), keep it
 * after all, and Paddle's own page to change the card and download invoices.
 * Paddle sold the plan, so its invoice is the receipt for a card payment. A
 * plan paid for a fixed period before the switch (by mobile money, or recorded
 * by hand) gets one button instead: set up card payment.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import {
  getMyBilling, downloadPlanReceipt, cancelCardPlan, keepCardPlan, getCardPortalUrl, getCardInvoiceUrl,
  type MyBilling, type PlanPayment, type PlanState,
} from '@/lib/api';
import { formatMoney } from '@/lib/paddle';

const STATE: Record<PlanState, { label: string; colour: string }> = {
  active:   { label: 'Paid up',          colour: 'var(--good)' },
  grace:    { label: 'Payment due',      colour: 'var(--warn)' },
  expired:  { label: 'Ended',            colour: 'var(--crit)' },
  included: { label: 'Set up by AIBOS',  colour: 'var(--cyan)' },
  free:     { label: 'Free plan',        colour: 'var(--text-3)' },
};

const STATUS: Record<PlanPayment['status'], { label: string; colour: string }> = {
  successful: { label: 'Paid',             colour: 'var(--good)' },
  pending:    { label: 'Not completed',    colour: 'var(--warn)' },
  failed:     { label: 'Did not go through', colour: 'var(--text-4)' },
  refunded:   { label: 'Refunded',         colour: 'var(--text-3)' },
};

const day = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** The receipt number, as the API prints it on the receipt (billing.receipt_number). */
const receiptNumber = (id: string) => `AIBOS-${id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 9)}`;

const button: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '10px 18px', minHeight: 44, borderRadius: 8, border: 'none',
  background: 'var(--cyan)', color: '#fff', fontSize: 'var(--fs-body)', fontWeight: 700,
  textDecoration: 'none', cursor: 'pointer',
};
const quiet: React.CSSProperties = {
  ...button, background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-md)',
};

export default function BillingPage() {
  const [data, setData] = useState<MyBilling | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState('');
  // The card plan's own buttons: cancel the renewal (asked twice), keep it, and
  // Paddle's page for the card and invoices.
  const [cardBusy, setCardBusy] = useState<'cancel' | 'keep' | 'portal' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cardError, setCardError] = useState('');

  const load = () => getMyBilling().then(setData);

  useEffect(() => {
    let alive = true;
    getMyBilling()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your plan.'); });
    return () => { alive = false; };
  }, []);

  /** Open a Paddle page in a new tab. The tab is opened before the wait, so the
   *  browser treats it as the click's own window and does not block it. */
  const openPaddle = async (getUrl: () => Promise<string>) => {
    const tab = window.open('', '_blank');
    try {
      const url = await getUrl();
      if (tab) { tab.opener = null; tab.location.href = url; } else window.location.href = url;
    } catch (e) {
      tab?.close();
      throw e;
    }
  };

  const cardAction = async (what: 'cancel' | 'keep' | 'portal') => {
    setCardBusy(what); setCardError('');
    try {
      if (what === 'portal') {
        await openPaddle(getCardPortalUrl);
      } else {
        if (what === 'cancel') await cancelCardPlan(); else await keepCardPlan();
        setConfirmCancel(false);
        await load();
      }
    } catch (e) {
      setCardError(e instanceof Error ? e.message : 'That did not go through. Please try again.');
    } finally {
      setCardBusy(null);
    }
  };

  const invoice = async (p: PlanPayment) => {
    setBusy(p.id); setReceiptError('');
    try {
      await openPaddle(() => getCardInvoiceUrl(p.id));
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : 'Could not open that invoice.');
    } finally {
      setBusy(null);
    }
  };

  const receipt = async (p: PlanPayment) => {
    setBusy(p.id); setReceiptError('');
    try {
      await downloadPlanReceipt(p.id, receiptNumber(p.id));
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : 'Could not prepare that receipt.');
    } finally {
      setBusy(null);
    }
  };

  const state = data?.state ? STATE[data.state] : null;
  const payments = data?.payments ?? [];
  const period = data?.billing === 'annual' ? 'year' : 'month';
  // A card plan that is still going renews automatically: nothing to pay here.
  const card = data?.card ?? null;
  const cardPeriod = card?.billing === 'annual' ? 'year' : 'month';
  const price = data?.price != null ? formatMoney(data.price, data.currency) : '';

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Plan & billing"
        subtitle="Your plan, when it renews and every payment with its receipt."
      />

      {error && (
        <div role="alert" style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--crit)', color: 'var(--crit)', fontSize: 'var(--fs-body)', lineHeight: 1.6 }}>
          {error}
        </div>
      )}

      {!data && !error && (
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Loading your plan…</p>
      )}

      {data && !data.own_plan && (
        <SectionCard title="Plan & billing">
          <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-2)', margin: 0 }}>
            {data.note || 'The owner of this business manages its plan and payments.'}
          </p>
        </SectionCard>
      )}

      {data?.own_plan && state && (
        <>
          <SectionCard
            title={`${data.plan_name} plan`}
            action={
              <span style={{ fontSize: 'var(--fs-label)', fontWeight: 700, color: state.colour, border: `1px solid ${state.colour}`, borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>
                {state.label}
              </span>
            }
            style={{ marginBottom: 20 }}
          >
            <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.7, color: 'var(--text-1)', margin: '0 0 16px' }}>
              {data.sentence}
            </p>

            {card ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                <Fact label="Price" value={price ? `${price} a ${cardPeriod}` : ''} />
                <Fact label="Paid by" value="Card, through Paddle" />
                {card.cancel_at
                  ? <Fact label="Ends on" value={day(card.cancel_at)} />
                  : card.status === 'past_due'
                  ? <Fact label="Switches off if unpaid" value={day(data.switches_off_on)} />
                  : <Fact label="Renews automatically on" value={day(card.renews_on)} />}
              </div>
            ) : (data.state === 'active' || data.state === 'grace' || data.state === 'expired') && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                <Fact label="Price by card" value={price ? `${price} a ${period}` : ''} />
                <Fact label={data.state === 'active' ? 'Paid up to' : 'Was due on'} value={day(data.renews_on)} />
                <Fact label={data.state === 'expired' ? 'Switched off on' : 'Switches off without a card'} value={day(data.switches_off_on)} />
              </div>
            )}

            {cardError && (
              <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--crit)', margin: '0 0 12px', lineHeight: 1.6 }}>{cardError}</p>
            )}

            {card && confirmCancel && (
              <div role="alertdialog" aria-label="Cancel the card renewal" style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--warn)', background: 'color-mix(in srgb, var(--warn) 8%, transparent)', marginBottom: 14 }}>
                <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-1)', margin: '0 0 12px' }}>
                  Cancel the renewal? Your card is not charged again. {data.plan_name} stays on until {day(card.renews_on) || 'the end of what you paid'}, then the account moves to Free. Your records all stay.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button type="button" onClick={() => void cardAction('cancel')} disabled={cardBusy !== null}
                    style={{ ...button, background: 'var(--crit)', cursor: cardBusy ? 'wait' : 'pointer' }}>
                    {cardBusy === 'cancel' ? 'Cancelling…' : 'Yes, cancel the renewal'}
                  </button>
                  <button type="button" onClick={() => setConfirmCancel(false)} disabled={cardBusy !== null} style={quiet}>
                    Keep {data.plan_name}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {card ? (
                <>
                  {card.status === 'past_due' && data.card_manageable && (
                    <button type="button" onClick={() => void cardAction('portal')} disabled={cardBusy !== null} style={button}>
                      {cardBusy === 'portal' ? 'Opening…' : 'Update your card'}
                    </button>
                  )}
                  {card.cancel_at ? (
                    <button type="button" onClick={() => void cardAction('keep')} disabled={cardBusy !== null} style={button}>
                      {cardBusy === 'keep' ? 'Keeping it…' : `Keep ${data.plan_name}`}
                    </button>
                  ) : (
                    <Link href="/pricing" style={card.status === 'past_due' ? quiet : button}>Change plan</Link>
                  )}
                  {data.card_manageable && card.status !== 'past_due' && (
                    <button type="button" onClick={() => void cardAction('portal')} disabled={cardBusy !== null} style={quiet}>
                      {cardBusy === 'portal' ? 'Opening…' : 'Manage card and invoices'}
                    </button>
                  )}
                  {!card.cancel_at && !confirmCancel && (card.status === 'active' || card.status === 'trialing') && (
                    <button type="button" onClick={() => setConfirmCancel(true)} disabled={cardBusy !== null} style={quiet}>
                      Cancel renewal
                    </button>
                  )}
                </>
              ) : data.state === 'free' ? (
                <Link href="/pricing" style={button}>See the plans</Link>
              ) : data.state === 'included' ? (
                <Link href="/pricing" style={quiet}>See the plans</Link>
              ) : (
                <>
                  <Link href={data.pay_link || '/pricing'} style={button}>
                    Set up card payment
                  </Link>
                  <Link href="/pricing" style={quiet}>Change plan</Link>
                </>
              )}
            </div>

            {card ? (
              <p style={{ fontSize: 'var(--fs-label)', lineHeight: 1.6, color: 'var(--text-4)', margin: '14px 0 0' }}>
                Paddle, our online reseller, charges your card and emails the receipt. Your statement shows PADDLE.NET. Every card payment has a <Link href="/refunds" style={{ color: 'var(--text-3)' }}>30-day money-back guarantee</Link>.
              </p>
            ) : (data.state === 'active' || data.state === 'grace') && (
              <p style={{ fontSize: 'var(--fs-label)', lineHeight: 1.6, color: 'var(--text-4)', margin: '14px 0 0' }}>
                Plans are now paid by card and renew automatically, so you never have to remember a renewal day.
                Set it up on or just before the day your plan is paid up to. Every card payment has a{' '}
                <Link href="/refunds" style={{ color: 'var(--text-3)' }}>30-day money-back guarantee</Link>.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Payments" subtitle="Every payment for your plan, newest first.">
            {receiptError && (
              <p role="alert" style={{ fontSize: 'var(--fs-body)', color: 'var(--crit)', margin: '0 0 12px' }}>{receiptError}</p>
            )}
            {payments.length === 0 ? (
              <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-3)', margin: 0 }}>
                No payments yet. When you pay for a plan it appears here with a receipt.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Plan</th><th>Amount</th><th>How</th><th>Status</th><th>Receipt</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const st = STATUS[p.status] ?? STATUS.pending;
                      return (
                        <tr key={p.id}>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text-1)', fontWeight: 600 }}>{day(p.date)}</td>
                          <td>{p.plan_name}{p.billing === 'annual' ? ', 1 year' : ', 1 month'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatMoney(p.amount, p.currency)}</td>
                          <td>{p.method}{p.phone_tail ? ` (…${p.phone_tail})` : ''}</td>
                          <td style={{ color: st.colour, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</td>
                          <td>
                            {p.invoice ? (
                              <button type="button" onClick={() => void invoice(p)} disabled={busy === p.id}
                                style={{ ...quiet, minHeight: 36, padding: '6px 12px', fontSize: 'var(--fs-label)', cursor: busy === p.id ? 'wait' : 'pointer' }}>
                                {busy === p.id ? 'Opening…' : 'Invoice'}
                              </button>
                            ) : p.receipt ? (
                              <button type="button" onClick={() => void receipt(p)} disabled={busy === p.id}
                                style={{ ...quiet, minHeight: 36, padding: '6px 12px', fontSize: 'var(--fs-label)', cursor: busy === p.id ? 'wait' : 'pointer' }}>
                                {busy === p.id ? 'Preparing…' : 'Download'}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-4)' }}>None</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-badge)' }}>
      <div style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
