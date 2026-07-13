'use client';
/**
 * Invoices — the get-paid loop (audit #7). Issue → share on WhatsApp (the
 * owner sends from their OWN phone — AIBOS never messages a customer) →
 * mark paid. The accounting rides the spine: send posts a confirmed credit
 * Sale (+receivables), mark-paid posts the CustomerPayment (cash). Free on
 * every plan, like recording.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listInvoices, createInvoice, sendInvoice, markInvoicePaid, cancelInvoice,
  deleteInvoice, invoiceShareText, type Invoice, type InvoiceLine,
} from '@/lib/api';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { logUsage } from '@/lib/usage';
import { fmt } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import KPICard from '@/components/ui/KPICard';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';

const STATUS_COLOUR: Record<Invoice['status'], string> = {
  draft: 'var(--text-3)', sent: 'var(--warn)', paid: 'var(--good)', cancelled: 'var(--text-4)',
};

const lbl: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 };
const input: React.CSSProperties = { width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 'var(--fs-body)' };
const btn: React.CSSProperties = { minHeight: 36, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-card)', color: 'var(--text-2)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--fs-data)' };

const EMPTY_LINE: InvoiceLine = { description: '', qty: 1, unit_price: 0 };

export default function InvoicesPage() {
  const currencySymbol = useStore((s) => s.currencySymbol);
  const sym = currencySymbol || 'K';
  const { profile } = useProfile();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setInvoices(await listInvoices()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const outstanding = useMemo(
    () => invoices.filter(i => i.status === 'sent').reduce((a, i) => a + i.total, 0),
    [invoices]);
  const overdue = useMemo(() => {
    const now = new Date().toISOString();
    return invoices.filter(i => i.status === 'sent' && i.due_at && i.due_at < now).length;
  }, [invoices]);
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
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      setCustomer(''); setDueAt(''); setLines([{ ...EMPTY_LINE }]); setShowForm(false);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function act(id: string, fn: (id: string) => Promise<unknown>) {
    setBusyId(id); setError(null);
    try { await fn(id); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function share(inv: Invoice) {
    setBusyId(inv.id); setError(null);
    try {
      const text = await invoiceShareText(
        inv.id,
        (profile?.business_name as string | null) ?? null,
        (profile?.whatsapp as string | null) ? `Mobile money to ${profile?.whatsapp}` : null,
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'number', label: 'Invoice', sortValue: i => i.number,
      render: i => <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{i.number}</span> },
    { key: 'customer_name', label: 'Customer', sortValue: i => i.customer_name,
      render: i => i.customer_name },
    { key: 'total', label: 'Total', sortValue: i => i.total,
      render: i => <span style={{ fontWeight: 600 }}>{fmt(i.total, false, sym)}</span> },
    { key: 'due_at', label: 'Due', sortValue: i => i.due_at ?? '',
      render: i => i.due_at ? i.due_at.slice(0, 10) : '—' },
    { key: 'status', label: 'Status', sortValue: i => i.status,
      render: i => (
        <span className="badge" style={{ color: STATUS_COLOUR[i.status], borderColor: 'var(--border)', textTransform: 'capitalize' }}>
          {i.status}
        </span>
      ) },
    { key: 'actions', label: '', sortValue: () => 0,
      render: i => {
        const busy = busyId === i.id;
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {i.status === 'draft' && (
              <>
                <button type="button" style={{ ...btn, color: 'var(--cyan)' }} disabled={busy}
                  onClick={() => { void act(i.id, sendInvoice); logUsage('event_recorded', { meta: { event_type: 'Sale', via: 'invoice_send' } }); }}>
                  Send
                </button>
                <button type="button" style={btn} disabled={busy} onClick={() => void act(i.id, deleteInvoice)}>Delete</button>
              </>
            )}
            {i.status === 'sent' && (
              <>
                <button type="button" style={btn} disabled={busy} onClick={() => void share(i)}>Share on WhatsApp</button>
                <button type="button" style={{ ...btn, color: 'var(--good)' }} disabled={busy}
                  onClick={() => { void act(i.id, markInvoicePaid); logUsage('event_recorded', { meta: { event_type: 'CustomerPayment', via: 'invoice_paid' } }); }}>
                  Mark paid
                </button>
                <button type="button" style={btn} disabled={busy} onClick={() => void act(i.id, cancelInvoice)}>Cancel</button>
              </>
            )}
            {i.status === 'paid' && i.paid_at && (
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>paid {i.paid_at.slice(0, 10)}</span>
            )}
          </div>
        );
      } },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Record & Plan · Invoices"
        eyebrowColour="var(--cyan)"
        title="Invoices"
        subtitle="Issue, share on WhatsApp, get paid — receivables and cash stay one story"
      />

      {error && (
        <p role="alert" style={{ color: 'var(--crit)', fontSize: 'var(--fs-body)', margin: '0 0 14px' }}>{error}</p>
      )}

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <KPICard label="OUTSTANDING" value={fmt(outstanding, false, sym)} sub="sent, awaiting payment" sparkColor="var(--warn)" delay={0} />
        <KPICard label="OVERDUE" value={String(overdue)} sub="past due date" sparkColor="var(--crit)" delay={0.06} />
        <KPICard label="COLLECTED" value={fmt(paidTotal, false, sym)} sub="paid invoices, all time" sparkColor="var(--good)" delay={0.12} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <button type="button" style={{ ...btn, color: 'var(--cyan)', borderColor: 'var(--cyan)' }} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Close' : '+ New invoice'}
        </button>
      </div>

      {showForm && (
        <SectionCard title="New invoice" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 12 }}>
            <div>
              <label htmlFor="inv-customer" style={lbl}>Customer</label>
              <input id="inv-customer" style={input} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Chanda's Grill" />
            </div>
            <div>
              <label htmlFor="inv-due" style={lbl}>Due date (optional)</label>
              <input id="inv-due" type="date" style={input} value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </div>
          </div>

          <p style={{ ...lbl, marginBottom: 8 }}>Line items</p>
          {lines.map((l, idx) => (
            <div key={idx} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 90px 130px 36px', marginBottom: 8 }}>
              <input aria-label={`Line ${idx + 1} description`} style={input} value={l.description} placeholder="What was sold / done"
                onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
              <input aria-label={`Line ${idx + 1} quantity`} type="number" min={0} style={input} value={l.qty}
                onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x))} />
              <input aria-label={`Line ${idx + 1} unit price`} type="number" min={0} style={input} value={l.unit_price}
                onChange={e => setLines(ls => ls.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) } : x))} />
              <button type="button" aria-label={`Remove line ${idx + 1}`} style={{ ...btn, padding: 0 }} disabled={lines.length === 1}
                onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <button type="button" style={btn} onClick={() => setLines(ls => [...ls, { ...EMPTY_LINE }])}>+ Add line</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                Total: {fmt(formTotal, false, sym)}
              </span>
              <button type="button" style={{ ...btn, background: 'var(--cyan)', color: '#08111a', borderColor: 'var(--cyan)' }}
                disabled={saving || !customer.trim() || !lines.some(l => l.description.trim())}
                onClick={() => void submitDraft()}>
                {saving ? 'Saving…' : 'Save draft'}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="All invoices" subtitle="Send a draft to raise the receivable; mark paid when the money lands">
        {loading ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : (
          <DataTable
            ariaLabel="Invoices"
            columns={columns}
            rows={invoices}
            rowKey={i => i.id}
            defaultSort={{ key: 'number', dir: 'desc' }}
            emptyMessage="No invoices yet — create one and share it on WhatsApp. Sent invoices appear in your receivables automatically."
          />
        )}
      </SectionCard>
    </>
  );
}
