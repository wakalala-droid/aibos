'use client';
/**
 * AIBOS — send a payroll run's payslips to the staff themselves.
 *
 * A payslip used to be a PDF the owner downloaded one person at a time, so
 * nobody on staff ever heard from AIBOS. This lists everyone on the run with
 * where their payslip can go: AIBOS emails it (the PDF attached, replies going
 * to the owner), or the owner sends it on WhatsApp from their own phone with
 * the payslip already written. It says who has theirs and who is waiting.
 * aibos-api payslip_delivery.py; the record needs migration 0042.
 */
import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import {
  getPayslipDelivery, emailPayslips, markPayslipShared,
  type PayslipDelivery, type PayslipRecipient,
} from '@/lib/api';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

function dayWords(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "Grace", "Grace and Moses", "Grace, Moses and Ruth". */
function names(list: string[]): string {
  const first = list.map((n) => n.split(/\s+/)[0]);
  return first.length <= 1 ? (first[0] ?? '') : `${first.slice(0, -1).join(', ')} and ${first.at(-1)}`;
}

function status(p: PayslipRecipient): string {
  if (p.sent_at && p.sent_via === 'email') return `Emailed ${dayWords(p.sent_at)}`;
  if (p.sent_at) return `Opened in WhatsApp ${dayWords(p.sent_at)}`;
  if (!p.email && !p.whatsapp_url) return 'No phone or email yet: add one with Change above';
  return 'Not sent yet';
}

export default function PayslipSend({ runId, money }: { runId: string; money: (v: number) => string }) {
  const [data, setData] = useState<PayslipDelivery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await getPayslipDelivery(runId)); setError(null); }
    catch (e) { setError((e as Error).message || 'Could not read who has their payslip.'); }
  }, [runId]);
  useEffect(() => { void load(); }, [load]);

  const toEmail = (data?.people ?? []).filter((p) => p.email && !p.sent_at);
  const live = data?.email_channel === 'live';

  async function emailAll() {
    setBusy(true); setError(null); setDone(null);
    try {
      const out = await emailPayslips(runId);
      const parts: string[] = [];
      if (out.sent.length) parts.push(`Emailed ${names(out.sent)}.`);
      if (out.failed.length) parts.push(`${names(out.failed)}: the email did not go. Try again, or send on WhatsApp.`);
      if (out.note) parts.push(out.note);
      setDone(parts.join(' ') || 'Everyone with an email already has theirs.');
      await load();
    } catch (e) { setError((e as Error).message || 'Could not send the payslips.'); }
    finally { setBusy(false); }
  }

  async function shared(p: PayslipRecipient) {
    if (!p.employee_id) return;
    try { await markPayslipShared(runId, p.employee_id); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  if (!data && !error) {
    return <div className="skeleton" style={{ height: 96, flexBasis: '100%', marginTop: 8 }} />;
  }

  return (
    <div style={{ flexBasis: '100%', marginTop: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-input)', fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.55 }}>
      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text-1)' }}>
              {data.sent === data.total
                ? 'Everyone on this run has their payslip.'
                : `${data.sent} of ${data.total} ${data.total === 1 ? 'has' : 'have'} their payslip.`}
            </strong>
            {live && toEmail.length > 0 && (
              <button type="button" onClick={() => void emailAll()} disabled={busy} className="pill pill-primary">
                <Send aria-hidden="true" />{busy ? 'Sending…' : `Email ${toEmail.length} payslip${toEmail.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
          {!live && data.people.some((p) => p.email) && (
            <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
              Email from AIBOS is not switched on yet, so send these on WhatsApp for now.
            </p>
          )}
          <div style={{ marginTop: 8 }}>
            {data.people.map((p, i) => (
              <div key={p.employee_id ?? i} className="row">
                <span className="avatar avatar-brand" aria-hidden="true">{initials(p.employee_name ?? '')}</span>
                <span className="row-main">
                  <span className="row-title">{p.employee_name}</span>
                  <span className="row-sub" style={{ whiteSpace: 'normal' }}>
                    {status(p)}{p.net != null ? ` · ${money(p.net)} take-home` : ''}
                  </span>
                </span>
                <span className="row-actions">
                  {p.whatsapp_url && (
                    <a href={p.whatsapp_url} target="_blank" rel="noopener noreferrer" className="pill pill-quiet"
                      onClick={() => void shared(p)} aria-label={`Send ${p.employee_name}'s payslip on WhatsApp`}>
                      <MessageCircle aria-hidden="true" />WhatsApp
                    </a>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            Email goes from AIBOS with the PDF attached and replies come to you. WhatsApp opens on your
            phone with the payslip already written: press send there.
          </p>
        </>
      )}
      {done && <p role="status" style={{ margin: '8px 0 0', color: 'var(--green)' }}>{done}</p>}
      {error && <p role="alert" style={{ margin: '8px 0 0', color: 'var(--red)' }}>{error}</p>}
    </div>
  );
}
