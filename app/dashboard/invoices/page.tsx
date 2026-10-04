'use client';
/**
 * Invoices — the get-paid loop (audit #7). Issue → share on WhatsApp (the
 * owner sends from their OWN phone — AIBOS never messages a customer) →
 * get paid. The accounting rides the spine: send posts a confirmed credit
 * Sale (+receivables), settlement posts the CustomerPayment (cash). Free on
 * every plan, like recording.
 *
 * Two ways an invoice settles, one accounting path (invoices.mark_paid):
 *   · "Mark paid"    — the owner saw the money arrive some other way
 *   · payment link   — the customer paid by mobile money on /pay/<token>,
 *                      and the backend settled it (migration 0025)
 * The shared WhatsApp message carries that link, so the common case needs no
 * extra step from the owner. "Payment link" copies it for SMS, email or a QR.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmSheet, showCopyText } from '@/lib/confirm';
import {
  listInvoices, createInvoice, sendInvoice, markInvoicePaid, cancelInvoice,
  deleteInvoice, invoiceShareText, invoicePayLink, getDebtors,
  type Invoice, type InvoiceLine, type AgingReport,
} from '@/lib/api';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { logUsage } from '@/lib/usage';
import { fmt } from '@/lib/utils';
import { Plus, X, MessageCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import Stat from '@/components/ui/Stat';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';

const STATUS_COLOUR: Record<Invoice['status'], string> = {
  draft: 'var(--text-3)', sent: 'var(--warn)', paid: 'var(--good)', cancelled: 'var(--text-4)',
};

const STATUS_WORD: Record<Invoice['status'], string> = {
  draft: 'Draft', sent: 'Waiting', paid: 'Paid', cancelled: 'Cancelled',
};

/** "12 Oct" for a stored YYYY-MM-DD date. */
function dateWords(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

const EMPTY_LINE: InvoiceLine = { description: '', qty: 1, unit_price: 0 };

/** Today on the owner's own calendar, as YYYY-MM-DD. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Past due means the due DATE has gone by. Comparing timestamps counted an
 *  invoice due today as overdue from two in the morning. */
function isOverdue(i: Invoice): boolean {
  return i.status === 'sent' && !!i.due_at && i.due_at.slice(0, 10) < localToday();
}

export default function InvoicesPage() {
  const currencySymbol = useStore((s) => s.currencySymbol);
  const sym = currencySymbol || 'K';
  const { profile } = useProfile();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // "New invoice" from the search box or the app icon lands on ?new=1.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('new') !== '1') return;
    url.searchParams.delete('new');
    window.history.replaceState(null, '', url.pathname + url.search);
    setShowForm(true);
  }, []);
  const [customer, setCustomer] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  const [aging, setAging] = useState<AgingReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setInvoices(await listInvoices()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
    // The ledger refreshes with every action; failures stay silent — the
    // invoice list stands on its own.
    getDebtors(profile?.business_name as string | null).then(setAging).catch(() => {});
  }, [profile?.business_name]);
  useEffect(() => { void load(); }, [load]);

  const outstanding = useMemo(
    () => invoices.filter(i => i.status === 'sent').reduce((a, i) => a + i.total, 0),
    [invoices]);
  const overdue = useMemo(() => invoices.filter(isOverdue).length, [invoices]);
  const paidTotal = useMemo(
    () => invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.total, 0),
    [invoices]);

  const formTotal = useMemo(
    () => lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0),
    [lines]);

  async function submitDraft() {
    setSaving(true); setError(null);
    try {
      const clean = lines.filter(l => l.description.trim());
      await createInvoice({
        customer_name: customer.trim(),
        lines: clean.map(l => ({ ...l, qty: Number(l.qty), unit_price: Number(l.unit_price) })),
        // Noon, not midnight UTC, so the date survives the trip in any timezone.
        due_at: dueAt ? `${dueAt}T12:00:00Z` : null,
      });
      setCustomer(''); setDueAt(''); setLines([{ ...EMPTY_LINE }]); setShowForm(false);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  /** Run an invoice action. `confirmText` asks first: sending, marking paid,
   *  cancelling and deleting all change the books or the customer's view, and
   *  a paid invoice has no undo on this screen. `onDone` runs only when the
   *  action went through, so usage is not logged for a refusal. */
  async function act(id: string, fn: (id: string) => Promise<unknown>, ask?: { title: string; body: string; label: string; danger?: boolean }, onDone?: () => void) {
    if (ask && !(await confirmSheet({ title: ask.title, body: ask.body, confirmLabel: ask.label, danger: ask.danger }))) return;
    setBusyId(id); setError(null);
    try { await fn(id); onDone?.(); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function share(inv: Invoice) {
    // Open the tab while the tap still counts as the owner's own action.
    // Opened after waiting on the server, Safari and most phone browsers
    // treat it as a popup and silently block it.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    setBusyId(inv.id); setError(null);
    try {
      // The message carries the tap-to-pay link; the manual momo number stays
      // in it as the fallback for customers who'd rather send money as usual.
      const { text } = await invoiceShareText(
        inv.id,
        (profile?.business_name as string | null) ?? null,
        (profile?.whatsapp as string | null) ? `Mobile money to ${profile?.whatsapp}` : null,
      );
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
    }
    finally { setBusyId(null); }
  }

  /** Copy the public payment link for pasting anywhere — SMS, email, a printed QR. */
  async function copyLink(inv: Invoice) {
    setBusyId(inv.id); setError(null); setCopiedId(null);
    try {
      const url = await invoicePayLink(inv.id);
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(inv.id);
        setTimeout(() => setCopiedId(c => (c === inv.id ? null : c)), 2500);
      } catch {
        // Clipboard is blocked on insecure origins and in some mobile webviews.
        // Show the link instead of silently doing nothing.
        void showCopyText('Copy this payment link', url);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'number', label: 'Invoice', sortValue: i => i.number,
      render: i => <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{i.number}</span> },
    { key: 'customer_name', label: 'Customer', sortValue: i => i.customer_name,
      render: i => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span className="avatar" aria-hidden="true">{initials(i.customer_name)}</span>
          <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{i.customer_name}</span>
        </span>
      ) },
    { key: 'total', label: 'Amount', sortValue: i => i.total, align: 'right',
      render: i => <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{fmt(i.total, false, sym)}</span> },
    { key: 'due_at', label: 'Due', sortValue: i => i.due_at ?? '',
      render: i => i.due_at
        ? <span style={{ color: isOverdue(i) ? 'var(--crit)' : undefined, fontWeight: isOverdue(i) ? 600 : undefined }}>{isOverdue(i) ? `Overdue since ${dateWords(i.due_at)}` : dateWords(i.due_at)}</span>
        : <span style={{ color: 'var(--text-4)' }}>No date</span> },
    { key: 'status', label: 'Status', sortValue: i => i.status,
      render: i => (
        <span className="badge" style={{ color: STATUS_COLOUR[i.status], background: `color-mix(in srgb, ${STATUS_COLOUR[i.status]} 12%, transparent)` }}>
          {STATUS_WORD[i.status]}
        </span>
      ) },
    { key: 'actions', label: '', sortValue: () => 0,
      render: i => {
        const busy = busyId === i.id;
        return (
          <div className="row-actions">
            {i.status === 'draft' && (
              <>
                <button type="button" className="pill pill-primary" disabled={busy}
                  onClick={() => void act(i.id, sendInvoice,
                    { title: `Send ${i.number}?`, body: `${fmt(i.total, false, sym)} is recorded as a sale owed by ${i.customer_name} and the invoice can no longer be edited.`, label: 'Send it' },
                    () => logUsage('event_recorded', { meta: { event_type: 'Sale', via: 'invoice_send' } }))}>
                  Send
                </button>
                <button type="button" className="pill pill-quiet" disabled={busy} onClick={() => void act(i.id, deleteInvoice, { title: `Delete draft ${i.number}?`, body: 'This cannot be undone.', label: 'Delete', danger: true })}>Delete</button>
              </>
            )}
            {i.status === 'sent' && (
              <>
                <button type="button" className="pill" disabled={busy} onClick={() => void share(i)}><MessageCircle aria-hidden="true" />WhatsApp</button>
                <button type="button" className="pill" disabled={busy} onClick={() => void copyLink(i)}>
                  {copiedId === i.id ? 'Link copied' : 'Payment link'}
                </button>
                <button type="button" className="pill" style={{ color: 'var(--good)' }} disabled={busy}
                  onClick={() => void act(i.id, markInvoicePaid,
                    { title: `Mark ${i.number} as paid?`, body: `${fmt(i.total, false, sym)} from ${i.customer_name} is recorded as money received today.`, label: 'Mark paid' },
                    () => logUsage('event_recorded', { meta: { event_type: 'CustomerPayment', via: 'invoice_paid' } }))}>
                  Mark paid
                </button>
                <button type="button" className="pill pill-quiet" disabled={busy}
                  onClick={() => void act(i.id, cancelInvoice, { title: `Cancel ${i.number}?`, body: 'The sale is taken back out of your books and the payment link stops working.', label: 'Cancel the invoice', danger: true })}>
                  Cancel
                </button>
              </>
            )}
            {i.status === 'paid' && i.paid_at && (
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Paid {dateWords(i.paid_at)}</span>
            )}
          </div>
        );
      } },
  ];

  return (
    <>
      <PageHeader
        title="Get paid"
        subtitle="Send an invoice on WhatsApp and see who still owes you."
        actions={
          <button type="button" className={showForm ? 'pill' : 'pill pill-primary'} aria-expanded={showForm} onClick={() => setShowForm(v => !v)}>
            {showForm ? <><X aria-hidden="true" />Close</> : <><Plus aria-hidden="true" />New invoice</>}
          </button>
        }
      />

      {error && (
        <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-body)', margin: '0 0 14px' }}>{error}</p>
      )}

      <div className="home-trio" style={{ marginBottom: 16 }}>
        <Stat label="Waiting to be paid" money={outstanding} sym={sym} loading={loading}
          sub={outstanding > 0 ? 'Sent and not paid yet' : 'Nobody owes you on an invoice'} />
        <Stat label="Overdue" count={overdue} loading={loading} valueTone={overdue > 0 ? 'bad' : undefined}
          sub={overdue > 0 ? `invoice${overdue === 1 ? '' : 's'} past the due date` : 'Nothing past its due date'}
          tone={overdue > 0 ? 'bad' : undefined} />
        <Stat label="Collected" money={paidTotal} sym={sym} loading={loading} sub="Paid invoices, all time" />
      </div>

      {showForm && (
        <SectionCard title="New invoice" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 12 }}>
            <div>
              <label htmlFor="inv-customer" className="field-label">Customer</label>
              <input id="inv-customer" className="field" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Chanda's Grill" />
            </div>
            <div>
              <label htmlFor="inv-due" className="field-label">Due date (optional)</label>
              <input id="inv-due" type="date" className="field" value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </div>
          </div>

          <p className="field-label" style={{ marginBottom: 8 }}>What you are charging for</p>
          {lines.map((l, idx) => (
            <div key={idx} className="line-grid">
              <input aria-label={`Line ${idx + 1} description`} className="field" value={l.description} placeholder="What was sold / done"
                onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
              <input aria-label={`Line ${idx + 1} quantity`} type="number" min={0} className="field" value={l.qty}
                onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x))} />
              <input aria-label={`Line ${idx + 1} unit price`} type="number" min={0} className="field" value={l.unit_price}
                onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) } : x))} />
              <button type="button" aria-label={`Remove line ${idx + 1}`} className="icon-pill danger" disabled={lines.length === 1}
                onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))}><X aria-hidden="true" /></button>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="pill pill-quiet" onClick={() => setLines(ls => [...ls, { ...EMPTY_LINE }])}><Plus aria-hidden="true" />Add a line</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>
                Total <span className="money money-md" style={{ marginLeft: 6 }}>{fmt(formTotal, false, sym)}</span>
              </span>
              <button type="button" className="pill pill-primary"
                disabled={saving || !customer.trim() || !lines.some(l => l.description.trim())}
                onClick={() => void submitDraft()}>
                {saving ? 'Saving…' : 'Save draft'}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {aging && aging.customers.length > 0 && (
        <SectionCard
          title="Who owes you"
          subtitle={`Invoices and the credit book, oldest debt first`}
          style={{ marginBottom: 16 }}
        >
          <div className="mini-stats" role="list" aria-label="Money owed by how late it is" style={{ marginBottom: 16 }}>
            {(['current', '1-30', '31-60', '60+'] as const).map((b) => (
              <div key={b} role="listitem" className="mini-stat">
                <span style={{ fontSize: 'var(--fs-label)', color: b === '60+' ? 'var(--crit)' : b === '31-60' ? 'var(--warn)' : 'var(--text-3)', fontWeight: b === '60+' || b === '31-60' ? 600 : 400 }}>
                  {b === 'current' ? 'Not yet due' : b === '60+' ? 'Over 60 days' : `${b.replace('-', ' to ')} days`}
                </span>
                <span className="money money-md">{fmt(aging.totals[b] ?? 0, false, sym)}</span>
              </div>
            ))}
          </div>
          <div>
            {aging.customers.slice(0, 8).map((d) => (
              <div key={d.key} className="row" style={{ flexWrap: 'wrap' }}>
                <span className={`avatar${d.oldest_days > 30 ? ' avatar-out' : ''}`} aria-hidden="true">{initials(d.name)}</span>
                <span className="row-main">
                  <span className="row-title">{d.name}</span>
                  <span className="row-sub" style={{ color: d.oldest_days > 60 ? 'var(--crit)' : d.oldest_days > 30 ? 'var(--warn)' : undefined, fontWeight: d.oldest_days > 30 ? 600 : undefined }}>
                    {d.oldest_days > 0 ? `Oldest is ${d.oldest_days} day${d.oldest_days === 1 ? '' : 's'} late` : 'Not yet due'}
                    {d.credit_total > 0 && ', includes the credit book'}
                  </span>
                </span>
                <span className="row-amount">{fmt(d.total, false, sym)}</span>
                <button type="button" className="pill"
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(d.nudge)}`, '_blank', 'noopener')}>
                  <MessageCircle aria-hidden="true" />Nudge
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="All invoices" subtitle="A sent invoice counts as money owed to you. Mark it paid when the money arrives.">
        {loading ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : (
          <DataTable
            ariaLabel="Invoices"
            columns={columns}
            rows={invoices}
            rowKey={i => i.id}
            defaultSort={{ key: 'number', dir: 'desc' }}
            emptyMessage="No invoices yet: create one and share it on WhatsApp. Sent invoices appear in your receivables automatically."
          />
        )}
      </SectionCard>
    </>
  );
}
