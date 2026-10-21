'use client';
/**
 * AIBOS — Employees & Payroll.
 * The company's people (a free register — master data, like the product catalog)
 * and a Zambian statutory payroll engine (Pro). Running a period computes PAYE,
 * NAPSA, NHIMA and net pay for each active employee, decrements staff loans, and
 * posts one confirmed Salary business-event per person — so payroll and the
 * P&L/cashflow stay one story (the same record bridge the Scheduler uses).
 *
 * Rates are AIBOS-maintained and effective-dated server-side: the owner never
 * touches tax tables — they add people and press Run.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmSheet } from '@/lib/confirm';
import Link from 'next/link';
import { Pencil, Trash2, FileText, Play, Eye, ShieldCheck } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import Stat from '@/components/ui/Stat';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess, requiredTier, TIERS } from '@/lib/tiers';
import { NOT_ON_PLAN_SHORT, useIosApp } from '@/lib/iosApp';
import PageHeader from '@/components/ui/PageHeader';
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  previewPayroll, runPayroll, listPayrollRuns, getPayrollRates, deletePayrollRun,
  downloadPayslipPdf, downloadCompliancePdf, setPayrollSdl, recheckPayrollRun,
  payPayrollWages, draftPayrollCorrections, ApiError,
  type Employee, type EmployeeInput, type EmploymentType,
  type PayrollPreview, type PayrollRun, type PayrollRates, type RemittanceDraft,
  type SdlStatus, type PayrollRecheck,
} from '@/lib/api';

/** What each payment to the authorities is, in words. */
const REMIT_LABEL: Record<RemittanceDraft['tax_type'], string> = {
  PAYE: 'PAYE to ZRA',
  SDL: 'Skills Development Levy to ZRA',
  NAPSA: 'NAPSA',
  NHIMA: 'NHIMA',
};

// ── Shared field styles (mirrors the Scheduler's form vocabulary) ────────────
// Table heads in the quiet sentence case every table now uses (redesign 2026-10).
const th: React.CSSProperties = { fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--text-3)', textAlign: 'right', padding: '8px 8px 12px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
const td: React.CSSProperties = { fontSize: 'var(--fs-data)', color: 'var(--text-2)', textAlign: 'right', padding: '12px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/** "September 2026" for a YYYY-MM pay period. */
function periodWords(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

interface FormState {
  name: string; position: string; employment_type: EmploymentType;
  basic_pay: string; allowances: string; pay_day: string; gratuity_eligible: boolean; gratuity_rate: string;
  loan_balance: string; loan_monthly: string; napsa_number: string; tpin: string; notes: string;
  napsa_exempt: boolean;
}
const EMPTY: FormState = {
  name: '', position: '', employment_type: 'permanent',
  basic_pay: '', allowances: '', pay_day: '28', gratuity_eligible: false, gratuity_rate: '25',
  loan_balance: '', loan_monthly: '', napsa_number: '', tpin: '', notes: '', napsa_exempt: false,
};

/** A person's pay before deductions: basic plus allowances. */
const grossOf = (e: Employee) => (e.basic_pay || 0) + (e.allowances || 0);

// 'YYYY-MM' on the owner's own calendar: in UTC the first two hours of a month
// in Lusaka still belong to the month before.
const thisPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const fmtDue = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });

export default function EmployeesPage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const tier = useStore(s => s.tier);
  const { profile } = useProfile();
  const businessName = profile?.business_name || undefined;
  const pro = canAccess(tier, 'payroll');
  const needTier = TIERS[requiredTier('payroll')].name;
  // The iPhone app sells nothing (lib/iosApp.ts): a locked payroll says so and stops.
  const ios = useIosApp();

  // Full-precision money (payroll needs the cents PAYE/NAPSA produce).
  const money = (v: number | null | undefined) =>
    `${sym}${(v ?? 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [rates, setRates] = useState<PayrollRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState(thisPeriod());
  // The day the wages are actually paid. Left empty, the run waits for the
  // 28th; set to today, the wages leave the money figure today.
  const [payDate, setPayDate] = useState('');
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [sdlBusy, setSdlBusy] = useState(false);
  // A past run checked against today's rules, keyed by run id.
  const [recheck, setRecheck] = useState<Record<string, PayrollRecheck>>({});
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runOk, setRunOk] = useState<string | null>(null);

  // Payroll documents (audit #26/#66). The endpoints existed for a release with
  // nothing calling them, so the owner could never obtain a payslip PDF.
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  async function removeRun(runId: string, runPeriod: string) {
    if (!(await confirmSheet({
      title: `Delete the payroll run for ${runPeriod}?`,
      body: 'Only for a run made by mistake. Its wages come out of your books, tax payments it drafted that you '
        + 'have not paid are removed and any staff loan instalment it took is given back. If the wages were '
        + 'paid, keep the run: use Check against today\u2019s rules to put it right instead.',
      confirmLabel: 'Delete the run',
      danger: true,
    }))) return;
    setDocBusy(runId); setDocError(null); setRunOk(null);
    try {
      let out;
      try {
        out = await deletePayrollRun(runId);
      } catch (e) {
        // The wages are in the books as PAID: deleting would put that money
        // back in the money figure as if it never left. Ask once more, plainly.
        if (!(e instanceof ApiError) || e.code !== 'paid_wages') throw e;
        if (!(await confirmSheet({
          title: 'These wages were paid',
          body: e.message,
          confirmLabel: 'They were never paid: delete',
          danger: true,
        }))) return;
        out = await deletePayrollRun(runId, true);
      }
      setRuns(rs => rs.filter(r => r.id !== runId));
      setRunOk(`Deleted the ${out.period} run.` + (out.tax_payments_kept > 0
        ? ` ${out.tax_payments_kept} tax payment${out.tax_payments_kept === 1 ? ' was' : 's were'} already marked paid, so ${out.tax_payments_kept === 1 ? 'it stays' : 'they stay'} in your books. Void ${out.tax_payments_kept === 1 ? 'it' : 'them'} on Activity if that was a mistake too.`
        : ''));
      void useStore.getState().refreshTwin();
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'Could not delete that run.');
    } finally {
      setDocBusy(null);
    }
  }

  async function getDoc(runId: string, runPeriod: string, employeeId?: string) {
    const key = employeeId ? `${runId}:${employeeId}` : runId;
    setDocBusy(key); setDocError(null);
    try {
      if (employeeId) await downloadPayslipPdf(runId, employeeId, runPeriod, businessName);
      else await downloadCompliancePdf(runId, runPeriod, businessName);
    } catch (e) {
      setDocError((e as Error).message || 'Could not prepare that document.');
    } finally {
      setDocBusy(null);
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [emps, rs, rt] = await Promise.all([listEmployees(), listPayrollRuns(), getPayrollRates()]);
      setEmployees(emps); setRuns(rs); setRates(rt);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  // Read again whenever the books change anywhere (lib/booksSignal.ts).
  const booksVersion = useStore((s) => s.booksVersion);
  useEffect(() => { load(); }, [load, booksVersion]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  function editEmployee(e: Employee) {
    setEditId(e.id); setMoreOpen(true);
    setForm({
      name: e.name, position: e.position ?? '', employment_type: e.employment_type,
      basic_pay: String(e.basic_pay ?? ''), allowances: e.allowances ? String(e.allowances) : '',
      napsa_exempt: !!e.napsa_exempt, pay_day: String(e.pay_day ?? 28),
      gratuity_eligible: e.gratuity_eligible, gratuity_rate: String(Math.round((e.gratuity_rate ?? 0.25) * 100)),
      loan_balance: e.loan_balance ? String(e.loan_balance) : '',
      loan_monthly: e.loan_monthly ? String(e.loan_monthly) : '',
      napsa_number: e.napsa_number ?? '', tpin: e.tpin ?? '', notes: e.notes ?? '',
    });
  }
  function cancelEdit() { setEditId(null); setForm(EMPTY); setMoreOpen(false); }

  async function saveEmployee() {
    if (!form.name.trim()) { setError('Give the employee a name.'); return; }
    setSaving(true); setError(null);
    try {
      const body: EmployeeInput = {
        name: form.name.trim(),
        position: form.position.trim() || null,
        employment_type: form.employment_type,
        basic_pay: form.basic_pay ? Number(form.basic_pay) : 0,
        // Sent only when there is something to say, so a database that has
        // not had migration 0039 yet still saves everyone without allowances.
        ...(form.allowances || editId ? { allowances: form.allowances ? Number(form.allowances) : 0 } : {}),
        ...(form.napsa_exempt || editId ? { napsa_exempt: form.napsa_exempt } : {}),
        pay_day: Number(form.pay_day) || 28,
        gratuity_eligible: form.employment_type === 'contract' && form.gratuity_eligible,
        gratuity_rate: form.gratuity_rate ? Number(form.gratuity_rate) / 100 : 0.25,
        loan_balance: form.loan_balance ? Number(form.loan_balance) : 0,
        loan_monthly: form.loan_monthly ? Number(form.loan_monthly) : 0,
        napsa_number: form.napsa_number.trim() || null,
        tpin: form.tpin.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editId) await updateEmployee(editId, body);
      else await createEmployee(body);
      cancelEdit(); setPreview(null); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeEmployee(id: string) {
    // Deleting is permanent: the register entry, pay details and loan balance
    // go. Past payslips keep the name, but nothing can be run for them again.
    const who = employees.find(e => e.id === id)?.name || 'this employee';
    if (!(await confirmSheet({ title: `Delete ${who}?`, body: 'Their pay details and loan balance are removed for good. Past payslips stay.', confirmLabel: 'Delete', danger: true }))) return;
    try { await deleteEmployee(id); if (editId === id) cancelEdit(); setPreview(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  async function doPreview() {
    setBusy(true); setRunError(null); setRunOk(null);
    try { setPreview(await previewPayroll(period)); }
    catch (e) { setRunError((e as Error).message); setPreview(null); }
    finally { setBusy(false); }
  }

  async function doRun() {
    setBusy(true); setRunError(null); setRunOk(null);
    try {
      const run = await runPayroll(period, payDate || undefined);
      const rem = (run.remittances ?? []).filter(r => r.amount > 0);
      const remLine = rem.length
        ? ` ${rem.map(r => `${REMIT_LABEL[r.tax_type] ?? r.tax_type} ${money(r.amount)}`).join(', ')} drafted as payments waiting for you${rem[0]?.due_date ? ` (due ${fmtDue(rem[0].due_date)})` : ''}.`
        : '';
      // Run before payday, the wages wait for it (payroll.confirm_due_wages).
      const payday = run.pay_date ? new Date(`${run.pay_date}T00:00:00`) : null;
      const ahead = payday && payday > new Date();
      setRunOk(`Payroll for ${period} run: ${run.totals.headcount} paid, ${money(run.totals.net)} net to staff.` +
        (ahead ? ` The wages leave your cash on payday, ${payday.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.` : '') +
        remLine);
      setPreview(null); await load();
    } catch (e) { setRunError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function changeSdl(setting: SdlStatus['setting']) {
    setSdlBusy(true); setRunError(null);
    try {
      await setPayrollSdl(setting);
      setPreview(await previewPayroll(period));     // the figures follow the answer
    } catch (e) { setRunError((e as Error).message); }
    finally { setSdlBusy(false); }
  }

  /** A run whose wages still wait for payday (they are not in the money figure yet). */
  const waiting = (r: PayrollRun) => !!r.pay_date && r.pay_date > new Date().toISOString().slice(0, 10);

  async function payNow(r: PayrollRun) {
    if (!(await confirmSheet({
      title: `Mark ${periodWords(r.period)}'s wages as paid today?`,
      body: `They are waiting for payday (${r.pay_date}). Paid today, ${money(r.totals.net)} leaves your money figure now.`,
      confirmLabel: 'Paid today',
    }))) return;
    setDocBusy(`pay:${r.id}`); setDocError(null); setRunOk(null);
    try {
      const out = await payPayrollWages(r.id);
      setRunOk(out.paid ? `${money(out.amount)} of wages for ${periodWords(r.period)} are in your books as paid on ${out.paid_on}.`
        : 'Those wages were already in your books as paid.');
      void useStore.getState().refreshTwin();
      await load();
    } catch (e) { setDocError((e as Error).message || 'Could not mark those wages paid.'); }
    finally { setDocBusy(null); }
  }

  async function draftFixes(runId: string) {
    setDocBusy(`fix:${runId}`); setDocError(null);
    try {
      const out = await draftPayrollCorrections(runId);
      setRunOk(out.summary);
      setRecheck(rc => rc[runId] ? { ...rc, [runId]: { ...rc[runId], to_settle: (rc[runId].to_settle ?? []).map(row =>
        ({ ...row, drafted: row.drafted || out.drafted.some(d => d.tax_type === row.tax_type) })) } } : rc);
    } catch (e) { setDocError((e as Error).message || 'Could not draft the corrections.'); }
    finally { setDocBusy(null); }
  }

  async function doRecheck(runId: string) {
    setDocBusy(`check:${runId}`); setDocError(null);
    try {
      const out = await recheckPayrollRun(runId);
      setRecheck(r => ({ ...r, [runId]: out }));
    } catch (e) { setDocError((e as Error).message || 'Could not check that run.'); }
    finally { setDocBusy(null); }
  }

  const active = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const periodRun = useMemo(() => runs.find(r => r.period === period), [runs, period]);
  const alreadyRun = !!periodRun;
  const monthlyWages = active.reduce((a, e) => a + grossOf(e), 0);
  // The next payday anyone on staff is due, on the owner's own calendar.
  const nextPayday = useMemo(() => {
    if (!active.length) return null;
    const today = new Date();
    const dates = active.map((e) => {
      const d = new Date(today.getFullYear(), today.getMonth(), Math.min(28, Math.max(1, e.pay_day || 28)));
      if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) d.setMonth(d.getMonth() + 1);
      return d;
    });
    return dates.sort((a, b) => a.getTime() - b.getTime())[0];
  }, [active]);
  const lastRun = runs[0];

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Your people and their pay, with PAYE, NAPSA and take-home pay worked out for you."
      />

      <div className="home-trio" style={{ marginBottom: 16 }}>
        <Stat label="On staff" count={active.length} loading={loading}
          sub={employees.length > active.length ? `${employees.length - active.length} have left` : active.length === 1 ? 'person' : 'people'} />
        <Stat label="Wages a month" money={monthlyWages} sym={sym} loading={loading}
          sub="Before PAYE, NAPSA and NHIMA" />
        <Stat label="Next payday" loading={loading}
          text={nextPayday ? nextPayday.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'None yet'}
          sub={lastRun ? `Last run was ${periodWords(lastRun.period)}` : 'No payroll run yet'} />
      </div>

      <div className="grid-main">
        {/* ── People (register — free) ─────────────────────────────────────── */}
        <SectionCard title="Your people" explainId="employees.register"
          >
          {error && <div role="alert" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}</div>
          ) : employees.length === 0 ? (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '4px 0 0' }}>
              No employees yet. Add your first person below: name and monthly pay is enough to start.
            </p>
          ) : (
            <div>
              {employees.map(e => (
                <div key={e.id} className="row" style={{ opacity: e.status === 'left' ? 0.55 : 1 }}>
                  <span className="avatar avatar-brand" aria-hidden="true">{initials(e.name)}</span>
                  <span className="row-main">
                    <span className="row-title">
                      {e.name}
                      {e.position && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> · {e.position}</span>}
                    </span>
                    <span className="row-sub" style={{ whiteSpace: 'normal' }}>
                      Paid on the {e.pay_day}{e.pay_day === 1 ? 'st' : e.pay_day === 2 ? 'nd' : e.pay_day === 3 ? 'rd' : 'th'}
                      {e.employment_type === 'contract' ? ' · contract' : ''}
                      {e.gratuity_eligible ? ` · gratuity ${Math.round(e.gratuity_rate * 100)}%` : ''}
                      {(e.allowances || 0) > 0 ? ` · ${money(e.basic_pay)} basic + ${money(e.allowances)} allowances` : ''}
                      {e.napsa_exempt ? ' · no NAPSA (60 or over)' : ''}
                      {e.loan_balance > 0 ? ` · owes ${money(e.loan_balance)} on a loan` : ''}
                      {e.status === 'left' ? ' · has left' : ''}
                    </span>
                  </span>
                  <span className="row-amount">{money(grossOf(e))}<span style={{ color: 'var(--text-3)', fontWeight: 400 }}> a month</span></span>
                  <span className="row-actions">
                    <button type="button" className="icon-pill" onClick={() => editEmployee(e)} aria-label={`Change ${e.name}`}><Pencil aria-hidden="true" /></button>
                    <button type="button" className="icon-pill danger" onClick={() => removeEmployee(e.id)} aria-label={`Remove ${e.name}`}><Trash2 aria-hidden="true" /></button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Add / edit form */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <h3 className="panel-title" style={{ marginBottom: 12 }}>
              {editId ? 'Change a person' : 'Add a person'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Grace Banda" className="field" /></div>
              <div><label className="field-label">Role</label><input value={form.position} onChange={e => set('position', e.target.value)} placeholder="Cashier" className="field" /></div>
              <div><label className="field-label">Basic pay a month ({sym})</label><input type="number" min="0" step="0.01" value={form.basic_pay} onChange={e => set('basic_pay', e.target.value)} placeholder="8000" className="field" /></div>
              <div>
                <label className="field-label">Allowances a month ({sym})</label>
                <input type="number" min="0" step="0.01" value={form.allowances} onChange={e => set('allowances', e.target.value)} placeholder="0" className="field" />
              </div>
              <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                Allowances are housing, transport and any other cash paid on top every month. PAYE and NAPSA count them; NHIMA is 1% of basic pay only.
              </p>
              <div>
                <label className="field-label">Type</label>
                <select value={form.employment_type} onChange={e => set('employment_type', e.target.value as EmploymentType)} className="field">
                  <option value="permanent">Permanent</option>
                  <option value="contract">Fixed-term contract</option>
                </select>
              </div>
              <div><label className="field-label">Pay day</label><input type="number" min="1" max="28" value={form.pay_day} onChange={e => set('pay_day', e.target.value)} className="field" /></div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="pill pill-quiet" aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>
                  {moreOpen ? 'Fewer options' : 'Loan, gratuity and IDs'}
                </button>
              </div>

              {moreOpen && (
                <>
                  <div><label className="field-label">Staff loan balance ({sym})</label><input type="number" min="0" value={form.loan_balance} onChange={e => set('loan_balance', e.target.value)} placeholder="0" className="field" /></div>
                  <div><label className="field-label">Deduct per month ({sym})</label><input type="number" min="0" value={form.loan_monthly} onChange={e => set('loan_monthly', e.target.value)} placeholder="0" className="field" /></div>
                  {form.employment_type === 'contract' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', paddingBottom: 8 }}>
                        <input id="emp-grat" type="checkbox" checked={form.gratuity_eligible} onChange={e => set('gratuity_eligible', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
                        <label htmlFor="emp-grat" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', cursor: 'pointer' }}>Earns gratuity</label>
                      </div>
                      <div><label className="field-label">Gratuity rate (%)</label><input type="number" min="25" value={form.gratuity_rate} onChange={e => set('gratuity_rate', e.target.value)} disabled={!form.gratuity_eligible} className="field" style={{ opacity: form.gratuity_eligible ? 1 : 0.5 }} /></div>
                    </>
                  )}
                  <div><label className="field-label">NAPSA number</label><input value={form.napsa_number} onChange={e => set('napsa_number', e.target.value)} className="field" /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', paddingBottom: 8 }}>
                    <input id="emp-napsa-exempt" type="checkbox" checked={form.napsa_exempt} onChange={e => set('napsa_exempt', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
                    <label htmlFor="emp-napsa-exempt" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', cursor: 'pointer' }}>Aged 60 or over: no NAPSA</label>
                  </div>
                  <div><label className="field-label">TPIN</label><input value={form.tpin} onChange={e => set('tpin', e.target.value)} className="field" /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className="field" /></div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={saveEmployee} disabled={saving} className="pill pill-primary">
                {saving ? 'Saving…' : editId ? 'Save changes' : 'Add this person'}
              </button>
              {editId && <button type="button" onClick={cancelEdit} className="pill pill-quiet">Cancel</button>}
            </div>
          </div>
        </SectionCard>

        {/* ── Run payroll ──────────────────────────────────────────────────── */}
        <SectionCard title="Run payroll" explainId="payroll.run"
          subtitle="Preview is free. Running records each salary; the wages leave your cash on payday."
          action={pro ? undefined : (
            <span className="badge" style={{ background: 'color-mix(in srgb, var(--cyan) 12%, transparent)', color: 'var(--cyan)' }}>{ios ? NOT_ON_PLAN_SHORT : needTier}</span>
          )}>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <label className="field-label">Pay period</label>
              <input type="month" value={period} onChange={e => { setPeriod(e.target.value); setPreview(null); setRunOk(null); setRunError(null); }} className="field" style={{ width: 'auto' }} />
            </div>
            <div>
              <label className="field-label" htmlFor="pay-date">Paid on</label>
              <input id="pay-date" type="date" value={payDate} max={new Date().toISOString().slice(0, 10)}
                onChange={e => setPayDate(e.target.value)} className="field" style={{ width: 'auto' }} />
            </div>
            <button type="button" onClick={doPreview} disabled={busy || active.length === 0} className="pill">
              <Eye aria-hidden="true" />{busy ? 'Working it out…' : 'Preview'}
            </button>
          </div>

          {active.length === 0 && (
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Add a person first, then preview a month.</p>
          )}
          {runError && <div role="alert" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>{runError}</div>}
          {runOk && <div role="status" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--green-dim)', color: 'var(--green)', fontSize: 'var(--fs-body)' }}>{runOk}</div>}

          {/* A pay date in a year whose rates nobody has checked yet. */}
          {preview?.rates_note && (
            <div role="alert" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--amber-dim)', color: 'var(--amber)', fontSize: 'var(--fs-body)' }}>{preview.rates_note}</div>
          )}

          {/* Preview: what comes out of the pay, then what the employer adds.
              The NAPSA column used to be the staff 5% alone with nothing
              beside it, so its total read as the NAPSA bill when that bill is
              twice it. Both halves now stand side by side. */}
          {preview && preview.payslips.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="day-label">Taken from their pay</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="card-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>Employee</th>
                      <th style={th}>Gross</th><th style={th}>NAPSA 5%</th><th style={th}>NHIMA 1%</th>
                      <th style={th}>PAYE</th><th style={th}>Loan</th><th style={{ ...th, color: 'var(--text-2)' }}>Take-home</th>
                      {periodRun && <th style={th} aria-label="Payslip" />}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.payslips.map((s, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ ...td, textAlign: 'left', color: 'var(--text-1)', fontWeight: 600 }}>{s.employee_name}</td>
                        <td style={td}>{money(s.gross)}</td>
                        <td style={td}>{s.napsa_exempt ? 'none' : money(s.napsa_employee)}</td>
                        <td style={td}>{money(s.nhima_employee)}</td>
                        <td style={td}>{money(s.paye)}</td>
                        <td style={td}>{money(s.loan_deduction)}</td>
                        <td style={{ ...td, color: 'var(--text-1)', fontWeight: 700 }}>{money(s.net)}</td>
                        {/* Payslip PDF (audit #26) — only once the period has
                            actually been run, because a payslip is a record of
                            payment, not of a preview. */}
                        {periodRun && (
                          <td style={td}>
                            {s.employee_id && (
                              <button type="button" onClick={() => void getDoc(periodRun.id, periodRun.period, s.employee_id!)}
                                disabled={docBusy === `${periodRun.id}:${s.employee_id}`} className="pill pill-quiet">
                                <FileText aria-hidden="true" />{docBusy === `${periodRun.id}:${s.employee_id}` ? 'Preparing…' : 'Payslip'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border-md)' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: 'var(--text-2)' }}>Total for {preview.totals.headcount}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.gross)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.napsa_employee)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.nhima_employee)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.paye)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.loan_deduction)}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--text-1)' }}>{money(preview.totals.net)}</td>
                      {periodRun && <td style={td} />}
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="day-label" style={{ marginTop: 16 }}>Paid by you on top of their pay</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="card-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>Employee</th>
                      <th style={th}>NAPSA 5%</th><th style={th}>NHIMA 1%</th>
                      {preview.sdl?.due && <th style={th}>Levy 0.5%</th>}
                      <th style={{ ...th, color: 'var(--text-2)' }}>Cost to you</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.payslips.map((s, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ ...td, textAlign: 'left', color: 'var(--text-1)', fontWeight: 600 }}>{s.employee_name}</td>
                        <td style={td}>{s.napsa_exempt ? 'none' : money(s.napsa_employer)}</td>
                        <td style={td}>{money(s.nhima_employer ?? s.nhima_employee)}</td>
                        {preview.sdl?.due && <td style={td}>{money(s.sdl ?? 0)}</td>}
                        <td style={{ ...td, color: 'var(--text-1)', fontWeight: 700 }}>{money(s.employer_cost ?? s.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border-md)' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: 'var(--text-2)' }}>Total</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.napsa_employer)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.nhima_employer ?? preview.totals.nhima_employee)}</td>
                      {preview.sdl?.due && <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.sdl ?? 0)}</td>}
                      <td style={{ ...td, fontWeight: 600, color: 'var(--text-1)' }}>{money(preview.totals.employer_cost ?? preview.totals.gross)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Skills Development Levy: whether it is due, why, and the owner's own say. */}
              {preview.sdl && (
                <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.55 }}>
                  <strong style={{ color: 'var(--text-1)' }}>Skills Development Levy</strong>{' '}
                  {preview.sdl.due
                    ? <>is 0.5% of gross pay, paid by you and never taken from staff: {money(preview.totals.sdl ?? 0)} this month.</>
                    : <>is not added this month.</>}{' '}
                  {preview.sdl.why}
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label htmlFor="sdl-setting" className="field-label" style={{ margin: 0 }}>Does your business pay it?</label>
                    <select id="sdl-setting" value={preview.sdl.setting} disabled={sdlBusy}
                      onChange={e => void changeSdl(e.target.value as SdlStatus['setting'])} className="field" style={{ width: 'auto' }}>
                      <option value="auto">Work it out from my sales</option>
                      <option value="pays">Yes, we pay it</option>
                      <option value="exempt">No, we are exempt</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {alreadyRun ? (
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--amber)' }}>Payroll for {period} has already been run.</span>
                ) : pro ? (
                  <button type="button" onClick={doRun} disabled={busy} className="pill pill-primary">
                    <Play aria-hidden="true" />{busy ? 'Running…' : 'Run payroll and record the wages'}
                  </button>
                ) : ios ? (
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>Running payroll is not part of your plan.</span>
                ) : (
                  <Link href="/pricing" className="pill pill-primary">
                    Unlock payroll: upgrade to {needTier}
                  </Link>
                )}
                {preview.payslips.some(s => s.gratuity_accrued > 0) && (
                  <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                    Plus {money(preview.totals.gratuity_accrued)} gratuity set aside (your cost)
                  </span>
                )}
              </div>

              {/* What goes to each authority by the 10th: the whole amount, and
                  how much of it came from the pay and how much from you. */}
              {preview.remittances.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 className="panel-title" style={{ marginBottom: 8 }}>
                    To pay{preview.remittances[0]?.due_date ? ` by ${fmtDue(preview.remittances[0].due_date)}` : ''}: {money(preview.remittances.reduce((a, r) => a + r.amount, 0))}
                  </h3>
                  <div className="mini-stats">
                    {preview.remittances.map((r: RemittanceDraft) => (
                      <div key={r.tax_type} className="mini-stat">
                        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{REMIT_LABEL[r.tax_type] ?? `${r.tax_type} to ${r.authority}`}</span>
                        <span className="money money-md">{money(r.amount)}</span>
                        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                          {(r.employee_share ?? 0) > 0 && (r.employer_share ?? 0) > 0
                            ? `${money(r.employee_share)} from their pay + ${money(r.employer_share)} from you`
                            : (r.employer_share ?? 0) > 0 ? 'Paid by you' : 'Taken from their pay'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginTop: 8 }}>
                    Running payroll posts these as payments waiting for you: confirm each when you pay ZRA, NAPSA and NHIMA.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past runs */}
          {runs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <p className="day-label">Past runs</p>
              {runs.map(r => (
                <div key={r.id} className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="avatar avatar-out" aria-hidden="true"><FileText /></span>
                  <span className="row-main">
                    <span className="row-title">{periodWords(r.period)}</span>
                    <span className="row-sub">{r.totals.headcount} paid, {money(r.totals.net)} take-home{waiting(r) ? ` · waiting for payday, ${r.pay_date}` : ""}</span>
                  </span>
                  <span className="row-actions">
                    {/* Audit #66 — the statutory pack the server has always been
                        able to render, now actually reachable. */}
                    {/* Paid before payday: the wages leave the money figure now. */}
                    {waiting(r) && (
                      <button type="button" onClick={() => void payNow(r)} disabled={docBusy === `pay:${r.id}`} className="pill pill-primary">
                        {docBusy === `pay:${r.id}` ? "Saving…" : "Paid them today"}
                      </button>
                    )}
                    <button type="button" onClick={() => void getDoc(r.id, r.period)} disabled={docBusy === r.id} className="pill pill-quiet">
                      <FileText aria-hidden="true" />{docBusy === r.id ? 'Preparing…' : 'Tax pack PDF'}
                    </button>
                    {/* A run is a record of what was paid. This works it out again
                        with today's rules and says what, if anything, to put right. */}
                    <button type="button" onClick={() => void doRecheck(r.id)} disabled={docBusy === `check:${r.id}`} className="pill pill-quiet">
                      <ShieldCheck aria-hidden="true" />{docBusy === `check:${r.id}` ? 'Checking…' : 'Check against today’s rules'}
                    </button>
                    {/* A run can only be made once a month, so one made by
                        mistake (the wrong month, a test) used to stay for good
                        with its wages in the books. */}
                    <button type="button" onClick={() => void removeRun(r.id, r.period)} disabled={docBusy === r.id} className="pill pill-quiet" style={{ color: 'var(--red)' }}>
                      <Trash2 aria-hidden="true" />{docBusy === r.id ? 'Working…' : 'Delete run'}
                    </button>
                  </span>
                  {recheck[r.id] && (
                    <div role="status" style={{ flexBasis: '100%', marginTop: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)',
                      background: recheck[r.id].changed ? 'var(--amber-dim)' : 'var(--green-dim)',
                      color: recheck[r.id].changed ? 'var(--amber)' : 'var(--green)', fontSize: 'var(--fs-body)', lineHeight: 1.55 }}>
                      {recheck[r.id].summary}
                      {recheck[r.id].changed && (
                        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-2)', fontSize: 'var(--fs-data)' }}>
                          {recheck[r.id].people.filter(p => p.changed).map((p, i) => (
                            <li key={p.employee_id ?? i}>
                              {p.employee_name}: PAYE {money(p.was.paye)} → {money(p.now.paye)}, take-home {money(p.was.net)} → {money(p.now.net)}
                              {Math.abs(p.difference.net) >= 0.005 && (p.difference.net < 0
                                ? ` (${money(-p.difference.net)} too little deducted)`
                                : ` (${money(p.difference.net)} owed back to them)`)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {recheck[r.id].changed && (
                        <p style={{ margin: '8px 0 0', color: 'var(--text-3)', fontSize: 'var(--fs-label)' }}>
                          Nothing has been changed. Keep this run: it is the record of what was paid. Draft the
                          corrections to add what is still owed as payments waiting for you, and ask your
                          accountant about any penalty. Delete a run only if it was made by mistake and its
                          wages were never paid.
                        </p>
                      )}
                      {(recheck[r.id].to_settle ?? []).some(row => row.owed && !row.drafted) && (
                        <button type="button" onClick={() => void draftFixes(r.id)} disabled={docBusy === `fix:${r.id}`}
                          className="pill pill-primary" style={{ marginTop: 8 }}>
                          {docBusy === `fix:${r.id}` ? 'Drafting…' : 'Draft the corrections'}
                        </button>
                      )}
                      {(recheck[r.id].to_settle ?? []).some(row => row.owed && row.drafted) && (
                        <p style={{ margin: '8px 0 0', color: 'var(--text-3)', fontSize: 'var(--fs-label)' }}>
                          Drafted: {(recheck[r.id].to_settle ?? []).filter(row => row.owed && row.drafted)
                            .map(row => `${row.tax_type} ${money(row.amount)} to ${row.authority}`).join(', ')}. Confirm each on Activity when you pay it.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {docError && (
                <p style={{ fontSize: 'var(--fs-label)', color: 'var(--red)', marginTop: 6 }}>{docError}</p>
              )}
            </div>
          )}

          {/* Rate transparency — AIBOS-maintained, the owner never edits these. */}
          {rates && (
            <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginTop: 16, lineHeight: 1.6 }}>
              Using {rates.currency} statutory rates effective {rates.effective_from}: PAYE on gross pay, up to {Math.round((rates.paye_bands.at(-1)?.rate ?? 0) * 100)}%; NAPSA {Math.round(rates.napsa_rate * 100)}% from staff and {Math.round(rates.napsa_rate * 100)}% from you, on gross pay up to {money(rates.napsa_ceiling)}; NHIMA {Math.round(rates.nhima_rate * 100)}% from staff and {Math.round(rates.nhima_rate * 100)}% from you, on basic pay{rates.sdl_rate ? `; Skills Development Levy ${(rates.sdl_rate * 100).toFixed(1)}% from you` : ''}. Kept current for you: no tax tables to manage.
            </p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
