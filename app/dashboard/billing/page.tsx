'use client';
/**
 * AIBOS: Plan & billing (upgrades 1 and 2).
 *
 * Only the admin could see when a customer's plan ends and what they had paid.
 * An owner learned their plan was ending from a reminder, had nowhere to check
 * a payment and nothing to hand their accountant. This page is theirs: the
 * plan in plain words, when it renews and for how much, a Pay now button, and
 * every payment with a receipt to download.
 *
 * Everything shown comes from GET /me/billing, which reads the same records
 * the renewal run and the admin page use. Staff working in someone else's
 * business are told the owner manages it, and see none of the payments.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { fmt } from '@/lib/utils';
import { getMyBilling, downloadPlanReceipt, type MyBilling, type PlanPayment, type PlanState } from '@/lib/api';

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

  useEffect(() => {
    let alive = true;
    getMyBilling()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load your plan.'); });
    return () => { alive = false; };
  }, []);

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

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Plan & billing"
        subtitle="Your plan, when it renews, and every payment with its receipt."
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

            {(data.state === 'active' || data.state === 'grace' || data.state === 'expired') && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                <Fact label="Price" value={data.price != null ? `${fmt(data.price, false, 'K')} a ${period}` : ''} />
                <Fact label={data.state === 'active' ? 'Renews on' : 'Was due on'} value={day(data.renews_on)} />
                <Fact label={data.state === 'expired' ? 'Switched off on' : 'Switches off if unpaid'} value={day(data.switches_off_on)} />
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {data.state === 'free' ? (
                <Link href="/pricing" style={button}>See the plans</Link>
              ) : data.state === 'included' ? (
                <Link href="/pricing" style={quiet}>See the plans</Link>
              ) : (
                <>
                  <Link href={data.pay_link || '/pricing'} style={button}>
                    Pay {data.price != null ? fmt(data.price, false, 'K') : 'now'}
                  </Link>
                  <Link href="/pricing" style={quiet}>Change plan</Link>
                </>
              )}
            </div>

            {(data.state === 'active' || data.state === 'grace') && (
              <p style={{ fontSize: 'var(--fs-label)', lineHeight: 1.6, color: 'var(--text-4)', margin: '14px 0 0' }}>
                {data.collections_live
                  ? 'Pay with MTN Mobile Money or Airtel Money. You approve it on your phone with your PIN.'
                  : 'On renewal day we remind you here and by email. Pay from this page any time before then.'}
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
                          <td style={{ whiteSpace: 'nowrap' }}>{fmt(p.amount, false, 'K')}</td>
                          <td>{p.method}{p.phone_tail ? ` (…${p.phone_tail})` : ''}</td>
                          <td style={{ color: st.colour, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</td>
                          <td>
                            {p.receipt ? (
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
