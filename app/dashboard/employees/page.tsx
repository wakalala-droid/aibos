'use client';
/**
 * AIBOS — Employees & Payroll.
 * The company's people (a free register — master data, like the product catalog)
 * and a Zambian statutory payroll engine (Pro+). Running a period computes PAYE,
 * NAPSA, NHIMA and net pay for each active employee, decrements staff loans, and
 * posts one confirmed Salary business-event per person — so payroll and the
 * P&L/cashflow stay one story (the same record bridge the Scheduler uses).
 *
 * Rates are AIBOS-maintained and effective-dated server-side: the owner never
 * touches tax tables — they add people and press Run.
 *
 * Since 3 November 2026 the run takes each person's month as it really was
 * (a part month, overtime or a bonus, leave days paid out), PAYE follows
 * ZRA's cumulative tables, the gratuity each contract earns is kept and paid
 * tax-free with the final pay, and the page says what the law asks that is
 * not done yet (aibos-api payroll.py, payroll_papers.py; migration 0043).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmSheet } from '@/lib/confirm';
import Link from 'next/link';
import { Pencil, Trash2, FileText, Play, Eye, ShieldCheck, Send, SlidersHorizontal } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import Stat from '@/components/ui/Stat';
import PayslipSend from '@/components/payroll/PayslipSend';
import PayrollChecks from '@/components/payroll/PayrollChecks';
import GratuityCard from '@/components/payroll/GratuityCard';
import { Note } from '@/components/hospitality/kit';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess, requiredTier, TIERS } from '@/lib/tiers';
import { NOT_ON_PLAN_SHORT, useIosApp } from '@/lib/iosApp';
import PageHeader from '@/components/ui/PageHeader';
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  previewPayroll, runPayroll, listPayrollRuns, getPayrollRates, deletePayrollRun,
  downloadPayslipPdf, downloadCompliancePdf, downloadLeavingPapers, setPayrollSdl, recheckPayrollRun,
  payPayrollWages, draftPayrollCorrections, getGratuityBook, getPayrollChecks, getPayrollEmployer, ApiError,
  type Employee, type EmployeeInput, type EmploymentType,
  type PayrollPreview, type PayrollRun, type PayrollRates, type RemittanceDraft,
  type SdlStatus, type PayrollRecheck, type PayrollChange, type GratuityBook, type PayrollCheck,
  type PayrollEmployer, type Payslip,
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
  napsa_exempt: boolean; phone: string; email: string;
  start_date: string; contract_end: string; left_on: string;
  nrc: string; nhima_number: string; second_job: boolean; gratuity_opening: string;
  prior_source: 'none' | 'before_aibos' | 'p13'; prior_through: string; prior_pay: string; prior_paye: string;
}
const EMPTY: FormState = {
  name: '', position: '', employment_type: 'permanent',
  basic_pay: '', allowances: '', pay_day: '28', gratuity_eligible: false, gratuity_rate: '25',
  loan_balance: '', loan_monthly: '', napsa_number: '', tpin: '', notes: '', napsa_exempt: false,
  phone: '', email: '',
  start_date: '', contract_end: '', left_on: '',
  nrc: '', nhima_number: '', second_job: false, gratuity_opening: '',
  prior_source: 'none', prior_through: '', prior_pay: '', prior_paye: '',
};

/** One person's changes for the month, as typed (strings until sent). */
interface ChangeForm {
  basic: string; allowances: string; extra_pay: string; extra_note: string; leave_days: string; pay_gratuity: boolean;
}
const NO_CHANGE: ChangeForm = { basic: '', allowances: '', extra_pay: '', extra_note: '', leave_days: '', pay_gratuity: false };

/** The typed changes as the API takes them: only what was said. */
function changesOut(forms: Record<string, ChangeForm>): Record<string, PayrollChange> {
  const out: Record<string, PayrollChange> = {};
  for (const [id, f] of Object.entries(forms)) {
    const c: PayrollChange = {};
    if (f.basic.trim() !== '') c.basic = Number(f.basic);
    if (f.allowances.trim() !== '') c.allowances = Number(f.allowances);
    if (f.extra_pay.trim() !== '' && Number(f.extra_pay) > 0) c.extra_pay = Number(f.extra_pay);
    if (f.extra_note.trim()) c.extra_note = f.extra_note.trim();
    if (f.leave_days.trim() !== '' && Number(f.leave_days) > 0) c.leave_days = Number(f.leave_days);
    if (f.pay_gratuity) c.pay_gratuity = true;
    if (Object.keys(c).length) out[id] = c;
  }
  return out;
}

/** What made this month's payslip different, in a few words. */
function slipExtras(s: Payslip, money: (v: number) => string): string {
  const parts: string[] = [];
  if (s.kind === 'final') parts.push(`final pay${s.ends_on ? `, left ${s.ends_on}` : ''}`);
  if (s.kind === 'gratuity_only') parts.push('gratuity still owed');
  if (s.kind !== 'gratuity_only' && (s.basic_full ?? 0) > 0 && (s.basic ?? 0) < (s.basic_full ?? 0)) parts.push(`${money(s.basic ?? 0)} basic for part of the month`);
  if ((s.extra_pay ?? 0) > 0) parts.push(`${s.extra_note || 'extra pay'} ${money(s.extra_pay ?? 0)}`);
  if ((s.leave_pay ?? 0) > 0) parts.push(`${s.leave_days} leave days ${money(s.leave_pay ?? 0)}`);
  if ((s.gratuity_paid ?? 0) > 0) parts.push(`gratuity ${money(s.gratuity_paid ?? 0)} tax-free`);
  if (s.paye_basis === 'second job') parts.push('second job: PAYE at 37%');
  return parts.join(' · ');
}

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
  const { profile, kept } = useProfile();
  const businessName = profile?.business_name || undefined;
  // A Pro account that ran payroll before the 22 October re-cut keeps it.
  const pro = canAccess(tier, 'payroll') || kept.includes('payroll');
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
  // The run whose payslips are open to send, by id.
  const [sendOpen, setSendOpen] = useState<string | null>(null);

  // What the law asks that is not done yet, the gratuity owed, the employer's
  // own numbers. Each reads on its own: one failing never blanks the page.
  const [checks, setChecks] = useState<PayrollCheck[]>([]);
  const [gratuity, setGratuity] = useState<GratuityBook>({ people: [], total_owed: 0, overdue: 0, due_soon: 0 });
  const [employer, setEmployer] = useState<PayrollEmployer>({});
  const [lawLoading, setLawLoading] = useState(true);
  // This month's changes per person (a part month, extra pay, leave days,
  // the gratuity paid), and whose are open to type into.
  const [changes, setChanges] = useState<Record<string, ChangeForm>>({});
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null);

  async function getPapers(employeeId: string, name: string) {
    setDocBusy(employeeId); setDocError(null);
    try { await downloadLeavingPapers(employeeId, name); }
    catch (e) { setDocError((e as Error).message || 'Could not prepare the leaving papers.'); }
    finally { setDocBusy(null); }
  }

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

  const loadLaw = useCallback(async () => {
    setLawLoading(true);
    const [c, g, er] = await Promise.allSettled([getPayrollChecks(), getGratuityBook(), getPayrollEmployer()]);
    if (c.status === 'fulfilled') setChecks(c.value);
    if (g.status === 'fulfilled') setGratuity(g.value);
    if (er.status === 'fulfilled') setEmployer(er.value);
    setLawLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [emps, rs, rt] = await Promise.all([listEmployees(), listPayrollRuns(), getPayrollRates()]);
      setEmployees(emps); setRuns(rs); setRates(rt);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
    void loadLaw();
  }, [loadLaw]);
  // Read again whenever the books change anywhere (lib/booksSignal.ts).
  const booksVersion = useStore((s) => s.booksVersion);
  useEffect(() => { load(); }, [load, booksVersion]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  function editEmployee(e: Employee) {
    setEditId(e.id); setMoreOpen(true);
    const prior = e.paye_prior;
    setForm({
      name: e.name, position: e.position ?? '', employment_type: e.employment_type,
      basic_pay: String(e.basic_pay ?? ''), allowances: e.allowances ? String(e.allowances) : '',
      napsa_exempt: !!e.napsa_exempt, pay_day: String(e.pay_day ?? 28),
      gratuity_eligible: e.gratuity_eligible, gratuity_rate: String(Math.round((e.gratuity_rate ?? 0.25) * 100)),
      loan_balance: e.loan_balance ? String(e.loan_balance) : '',
      loan_monthly: e.loan_monthly ? String(e.loan_monthly) : '',
      napsa_number: e.napsa_number ?? '', tpin: e.tpin ?? '', notes: e.notes ?? '',
      phone: e.phone ?? '', email: e.email ?? '',
      start_date: e.start_date ?? '', contract_end: e.contract_end ?? '',
      left_on: e.status === 'left' ? (e.end_date ?? '') : '',
      nrc: e.nrc ?? '', nhima_number: e.nhima_number ?? '', second_job: !!e.second_job,
      gratuity_opening: e.gratuity_opening ? String(e.gratuity_opening) : '',
      prior_source: prior ? prior.source : 'none', prior_through: prior?.through ?? '',
      prior_pay: prior ? String(prior.pay) : '', prior_paye: prior ? String(prior.paye) : '',
    });
  }
  function editById(id: string) {
    const e = employees.find(x => x.id === id);
    if (e) {
      editEmployee(e);
      document.getElementById('person-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function cancelEdit() { setEditId(null); setForm(EMPTY); setMoreOpen(false); }

  async function saveEmployee() {
    if (!form.name.trim()) { setError('Give the employee a name.'); return; }
    if (form.prior_source !== 'none' && !/^\d{4}-\d{2}$/.test(form.prior_through)) {
      setError('Say the last month the earlier pay covers.'); return;
    }
    setSaving(true); setError(null);
    try {
      const contract = form.employment_type === 'contract';
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
        gratuity_eligible: contract && form.gratuity_eligible,
        gratuity_rate: form.gratuity_rate ? Number(form.gratuity_rate) / 100 : 0.25,
        loan_balance: form.loan_balance ? Number(form.loan_balance) : 0,
        loan_monthly: form.loan_monthly ? Number(form.loan_monthly) : 0,
        napsa_number: form.napsa_number.trim() || null,
        tpin: form.tpin.trim() || null,
        notes: form.notes.trim() || null,
        start_date: form.start_date || null,
        contract_end: contract ? (form.contract_end || null) : null,
        // Left on a day: their last month is paid as their final pay.
        ...(editId ? { status: form.left_on ? 'left' : 'active', end_date: form.left_on || null } : {}),
        // Sent only when there is something to say, so a database without
        // migration 0042 still saves everyone without a phone or email.
        ...(form.phone.trim() || editId ? { phone: form.phone.trim() || null } : {}),
        ...(form.email.trim() || editId ? { email: form.email.trim() || null } : {}),
        // The same for migration 0043's numbers and figures.
        ...(form.nrc.trim() || editId ? { nrc: form.nrc.trim() || null } : {}),
        ...(form.nhima_number.trim() || editId ? { nhima_number: form.nhima_number.trim() || null } : {}),
        ...(form.second_job || editId ? { second_job: form.second_job } : {}),
        ...(form.gratuity_opening || editId ? { gratuity_opening: form.gratuity_opening ? Number(form.gratuity_opening) : 0 } : {}),
        ...(form.prior_source !== 'none'
          ? { paye_prior: { through: form.prior_through, pay: Number(form.prior_pay) || 0, paye: Number(form.prior_paye) || 0, source: form.prior_source } }
          : editId ? { paye_prior: null } : {}),
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

  async function doPreview(forms: Record<string, ChangeForm> = changes) {
    setBusy(true); setRunError(null); setRunOk(null);
    try {
      let out = await previewPayroll(period, payDate || undefined, changesOut(forms));
      // A contract that ends this month, or someone who left in it: their
      // gratuity is due with this pay (Employment Code Act s.73). Ticked for
      // the owner, who can untick it; never ticked twice over their answer.
      const due = out.payslips.filter(s => s.employee_id && s.gratuity_due && !(s.employee_id in forms));
      if (due.length) {
        const next = { ...forms };
        for (const s of due) next[s.employee_id!] = { ...NO_CHANGE, pay_gratuity: true };
        setChanges(next);
        out = await previewPayroll(period, payDate || undefined, changesOut(next));
      }
      setPreview(out);
    }
    catch (e) { setRunError((e as Error).message); setPreview(null); }
    finally { setBusy(false); }
  }

  function setChange(id: string, patch: Partial<ChangeForm>) {
    setChanges(c => ({ ...c, [id]: { ...(c[id] ?? NO_CHANGE), ...patch } }));
  }

  /** Pay a leaver's gratuity still owed with this run, and show it. */
  function payLeaverGratuity(id: string) {
    const next = { ...changes, [id]: { ...(changes[id] ?? NO_CHANGE), pay_gratuity: true } };
    setChanges(next);
    void doPreview(next);
  }

  async function doRun() {
    setBusy(true); setRunError(null); setRunOk(null);
    try {
      const run = await runPayroll(period, payDate || undefined, changesOut(changes));
      const rem = (run.remittances ?? []).filter(r => r.amount > 0);
      const remLine = rem.length
        ? ` ${rem.map(r => `${REMIT_LABEL[r.tax_type] ?? r.tax_type} ${money(r.amount)}`).join(', ')} drafted as payments waiting for you${rem[0]?.due_date ? ` (due ${fmtDue(rem[0].due_date)})` : ''}.`
        : '';
      // Run before payday, the wages wait for it (payroll.confirm_due_wages).
      const payday = run.pay_date ? new Date(`${run.pay_date}T00:00:00`) : null;
      const ahead = payday && payday > new Date();
      // The account's first run sets the statutory reminders by itself.
      const remindersLine = (run.reminders_set ?? []).length
        ? ' AIBOS also put PAYE, NAPSA and NHIMA on your Schedule for the 10th of every month.'
        : '';
      const grat = run.totals.gratuity_paid ?? 0;
      setRunOk(`Payroll for ${period} run: ${run.totals.headcount} paid, ${money(run.totals.net)} net to staff.` +
        (grat > 0 ? ` That includes ${money(grat)} of gratuity, tax-free.` : '') +
        (ahead ? ` The wages leave your cash on payday, ${payday.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.` : '') +
        remLine + remindersLine + ' Send everyone their payslip below.');
      setPreview(null); setChanges({}); setAdjustOpen(null); await load();
      setSendOpen(run.id);
    } catch (e) { setRunError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function changeSdl(setting: SdlStatus['setting']) {
    setSdlBusy(true); setRunError(null);
    try {
      await setPayrollSdl(setting);
      // The figures follow the answer.
      setPreview(await previewPayroll(period, payDate || undefined, changesOut(changes)));
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
  // What each person is owed in gratuity, by id.
  const owedBy = useMemo<Record<string, number>>(
    () => Object.fromEntries(gratuity.people.map(p => [p.employee_id, p.owed])), [gratuity]);
  const periodRun = useMemo(() => runs.find(r => r.period === period), [runs, period]);
  const alreadyRun = !!periodRun;
  const anyGratuityPaid = !!preview?.payslips.some(s => (s.gratuity_paid ?? 0) > 0);
  const anyGratuitySetAside = !!preview?.payslips.some(s => (s.gratuity_accrued ?? 0) > 0);
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

      {/* What the law asks that is not done yet, and the gratuity owed. */}
      {employees.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <SectionCard title="Statutory checks" explainId="payroll.checks"
            subtitle="Gratuity, contracts and the numbers every return needs, checked against the law.">
            <PayrollChecks checks={checks} employer={employer} loading={lawLoading}
              onChange={() => void loadLaw()} onEdit={editById} />
          </SectionCard>
          <SectionCard title="Gratuity" explainId="payroll.gratuity"
            subtitle="At least 25% of the basic pay a contract earns, kept for each person and paid tax-free when it ends.">
            {gratuity.people.length > 0 ? (
              <GratuityCard book={gratuity} money={money} papersBusy={docBusy}
                onPapers={pro ? (id, name) => void getPapers(id, name) : undefined} />
            ) : (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: 0, lineHeight: 1.55 }}>
                No one earns gratuity yet. Someone on a fixed-term contract does: set them as a fixed-term
                contract and AIBOS sets it aside with every run.
              </p>
            )}
          </SectionCard>
        </div>
      )}

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
                      {e.employment_type === 'contract' ? ` · contract${e.contract_end ? ` to ${e.contract_end}` : ''}` : ''}
                      {e.gratuity_eligible ? ` · gratuity ${Math.round(e.gratuity_rate * 100)}%` : ''}
                      {owedBy[e.id] > 0 ? `, ${money(owedBy[e.id])} owed` : ''}
                      {(e.allowances || 0) > 0 ? ` · ${money(e.basic_pay)} basic + ${money(e.allowances)} allowances` : ''}
                      {e.napsa_exempt ? ' · no NAPSA (60 or over)' : ''}
                      {e.second_job ? ' · second job' : ''}
                      {e.loan_balance > 0 ? ` · owes ${money(e.loan_balance)} on a loan` : ''}
                      {e.status === 'left' ? ` · left${e.end_date ? ` on ${e.end_date}` : ''}` : ''}
                    </span>
                  </span>
                  <span className="row-amount">{money(grossOf(e))}<span style={{ color: 'var(--text-3)', fontWeight: 400 }}> a month</span></span>
                  <span className="row-actions">
                    {/* Leaving papers: the certificate of service (s.59), the
                        year's pay and tax for ITF/P13, the gratuity statement. */}
                    {pro && (e.status === 'left' || (e.contract_end && e.contract_end <= new Date().toISOString().slice(0, 10))) && (
                      <button type="button" className="icon-pill" onClick={() => void getPapers(e.id, e.name)}
                        disabled={docBusy === e.id} aria-label={`Leaving papers for ${e.name}`}><FileText aria-hidden="true" /></button>
                    )}
                    <button type="button" className="icon-pill" onClick={() => editEmployee(e)} aria-label={`Change ${e.name}`}><Pencil aria-hidden="true" /></button>
                    <button type="button" className="icon-pill danger" onClick={() => removeEmployee(e.id)} aria-label={`Remove ${e.name}`}><Trash2 aria-hidden="true" /></button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Add / edit form */}
          <div id="person-form" style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16, scrollMarginTop: 80 }}>
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
                <select value={form.employment_type} onChange={e => {
                  const type = e.target.value as EmploymentType;
                  // A fixed-term contract earns gratuity by law (Employment
                  // Code Act s.54 and s.73): on unless the owner turns it off.
                  setForm(p => ({ ...p, employment_type: type, gratuity_eligible: type === 'contract' ? true : p.gratuity_eligible }));
                  if (type === 'contract') setMoreOpen(true);
                }} className="field">
                  <option value="permanent">Permanent</option>
                  <option value="contract">Fixed-term contract</option>
                </select>
              </div>
              <div><label className="field-label">Pay day</label><input type="number" min="1" max="28" value={form.pay_day} onChange={e => set('pay_day', e.target.value)} className="field" /></div>
              <div><label className="field-label" htmlFor="emp-phone">Phone (WhatsApp)</label><input id="emp-phone" type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="097 712 3456" className="field" /></div>
              <div><label className="field-label" htmlFor="emp-email">Email</label><input id="emp-email" type="email" autoComplete="off" value={form.email} onChange={e => set('email', e.target.value)} placeholder="grace@example.com" className="field" /></div>
              <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                Their payslip goes here every month: by email from AIBOS, or on WhatsApp from your phone.
              </p>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="pill pill-quiet" aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>
                  {moreOpen ? 'Fewer options' : 'Dates, gratuity, IDs and loan'}
                </button>
              </div>

              {moreOpen && (
                <>
                  <div><label className="field-label" htmlFor="emp-start">Started on</label><input id="emp-start" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="field" /></div>
                  {form.employment_type === 'contract' ? (
                    <div><label className="field-label" htmlFor="emp-cend">Contract ends</label><input id="emp-cend" type="date" value={form.contract_end} onChange={e => set('contract_end', e.target.value)} className="field" /></div>
                  ) : <div />}
                  {form.employment_type === 'contract' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', paddingBottom: 8 }}>
                        <input id="emp-grat" type="checkbox" checked={form.gratuity_eligible} onChange={e => set('gratuity_eligible', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
                        <label htmlFor="emp-grat" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', cursor: 'pointer' }}>Earns gratuity</label>
                      </div>
                      <div><label className="field-label" htmlFor="emp-grate">Gratuity rate (%)</label><input id="emp-grate" type="number" min="0" max="100" value={form.gratuity_rate} onChange={e => set('gratuity_rate', e.target.value)} disabled={!form.gratuity_eligible} className="field" style={{ opacity: form.gratuity_eligible ? 1 : 0.5 }} /></div>
                      <div><label className="field-label" htmlFor="emp-gopen">Gratuity owed before AIBOS ({sym})</label><input id="emp-gopen" type="number" min="0" step="0.01" value={form.gratuity_opening} onChange={e => set('gratuity_opening', e.target.value)} placeholder="0" disabled={!form.gratuity_eligible} className="field" style={{ opacity: form.gratuity_eligible ? 1 : 0.5 }} /></div>
                      <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 'var(--fs-label)', color: form.gratuity_eligible && Number(form.gratuity_rate) < 25 ? 'var(--amber)' : 'var(--text-3)', lineHeight: 1.5 }}>
                        {form.gratuity_eligible
                          ? Number(form.gratuity_rate) < 25
                            ? 'The Employment Code Act sets at least 25% of basic pay. Less is only for staff SI 48 of 2020 exempts: expatriates, management with a written gratuity contract, domestic and farm workers.'
                            : 'At least 25% of the basic pay earned over the contract (Employment Code Act s.73), set aside every run and paid tax-free when the contract ends.'
                          : 'Turned off: only for staff SI 48 of 2020 exempts (expatriates, management with a written gratuity contract, domestic and farm workers).'}
                      </p>
                    </>
                  )}
                  <div><label className="field-label" htmlFor="emp-nrc">NRC number</label><input id="emp-nrc" value={form.nrc} onChange={e => set('nrc', e.target.value)} placeholder="123456/78/9" className="field" /></div>
                  <div><label className="field-label" htmlFor="emp-tpin">TPIN</label><input id="emp-tpin" inputMode="numeric" value={form.tpin} onChange={e => set('tpin', e.target.value)} className="field" /></div>
                  <div><label className="field-label" htmlFor="emp-napsa">NAPSA number</label><input id="emp-napsa" value={form.napsa_number} onChange={e => set('napsa_number', e.target.value)} className="field" /></div>
                  <div><label className="field-label" htmlFor="emp-nhima">NHIMA number</label><input id="emp-nhima" value={form.nhima_number} onChange={e => set('nhima_number', e.target.value)} className="field" /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / -1' }}>
                    <input id="emp-napsa-exempt" type="checkbox" checked={form.napsa_exempt} onChange={e => set('napsa_exempt', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
                    <label htmlFor="emp-napsa-exempt" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', cursor: 'pointer' }}>Aged 60 or over: no NAPSA</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / -1' }}>
                    <input id="emp-second" type="checkbox" checked={form.second_job} onChange={e => set('second_job', e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
                    <label htmlFor="emp-second" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', cursor: 'pointer' }}>This is a second job for them: PAYE at 37% on all of it</label>
                  </div>
                  <div><label className="field-label">Staff loan balance ({sym})</label><input type="number" min="0" value={form.loan_balance} onChange={e => set('loan_balance', e.target.value)} placeholder="0" className="field" /></div>
                  <div><label className="field-label">Deduct per month ({sym})</label><input type="number" min="0" value={form.loan_monthly} onChange={e => set('loan_monthly', e.target.value)} placeholder="0" className="field" /></div>

                  {/* Pay and PAYE earlier this year: the cumulative tables
                      need the whole year (ZRA Employer's Guide 5.1 and 6.1). */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="field-label" htmlFor="emp-prior">Pay earlier this year</label>
                    <select id="emp-prior" value={form.prior_source} onChange={e => set('prior_source', e.target.value as FormState['prior_source'])} className="field">
                      <option value="none">None, or all of it is in AIBOS</option>
                      <option value="before_aibos">Paid by us before we used AIBOS</option>
                      <option value="p13">From a previous employer (their ITF/P13)</option>
                    </select>
                  </div>
                  {form.prior_source !== 'none' && (
                    <>
                      <div><label className="field-label" htmlFor="emp-pthrough">Up to the end of</label><input id="emp-pthrough" type="month" value={form.prior_through} onChange={e => set('prior_through', e.target.value)} className="field" /></div>
                      <div><label className="field-label" htmlFor="emp-ppay">Pay in those months ({sym})</label><input id="emp-ppay" type="number" min="0" step="0.01" value={form.prior_pay} onChange={e => set('prior_pay', e.target.value)} className="field" /></div>
                      <div><label className="field-label" htmlFor="emp-ppaye">PAYE taken ({sym})</label><input id="emp-ppaye" type="number" min="0" step="0.01" value={form.prior_paye} onChange={e => set('prior_paye', e.target.value)} className="field" /></div>
                      <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                        With these, PAYE uses ZRA&rsquo;s cumulative tables, so the year is taxed right. Without them each month is taxed on its own (the month 1 basis), which never takes too little.
                      </p>
                    </>
                  )}

                  {editId && (
                    <div><label className="field-label" htmlFor="emp-left">Left on</label><input id="emp-left" type="date" value={form.left_on} onChange={e => set('left_on', e.target.value)} className="field" /></div>
                  )}
                  {editId && form.left_on && (
                    <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                      Their last month is paid as their final pay: type the basic for the days worked and any leave days owed when you run it. Their leaving papers (certificate of service and ITF/P13 figures) are on the list above.
                    </p>
                  )}
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
              <input type="month" value={period} onChange={e => { setPeriod(e.target.value); setPreview(null); setChanges({}); setAdjustOpen(null); setRunOk(null); setRunError(null); }} className="field" style={{ width: 'auto' }} />
            </div>
            <div>
              <label className="field-label" htmlFor="pay-date">Paid on</label>
              <input id="pay-date" type="date" value={payDate} max={new Date().toISOString().slice(0, 10)}
                onChange={e => setPayDate(e.target.value)} className="field" style={{ width: 'auto' }} />
            </div>
            <button type="button" onClick={() => void doPreview()} disabled={busy || employees.length === 0} className="pill">
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
          {/* Someone who left before this month and is still owed gratuity:
              not on the run until the owner says to pay it with it. */}
          {preview && !alreadyRun && (preview.gratuity_leavers ?? []).map(l => (
            <Note key={l.employee_id} tone="warn">
              {l.name} left{l.end_date ? ` on ${l.end_date}` : ''} and is still owed {money(l.owed)} gratuity (Employment Code Act s.73).
              <div style={{ marginTop: 6 }}>
                <button type="button" className="pill pill-quiet" disabled={busy} onClick={() => payLeaverGratuity(l.employee_id)}>
                  Pay it with this run
                </button>
              </div>
            </Note>
          ))}

          {preview && preview.payslips.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="day-label">Taken from their pay</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="card-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>Employee</th>
                      <th style={th}>Gross</th><th style={th}>NAPSA 5%</th><th style={th}>NHIMA 1%</th>
                      <th style={th}>PAYE</th><th style={th}>Loan</th>
                      {anyGratuityPaid && <th style={th}>Gratuity</th>}
                      <th style={{ ...th, color: 'var(--text-2)' }}>Take-home</th>
                      {!alreadyRun && <th style={th} aria-label="This month" />}
                      {periodRun && <th style={th} aria-label="Payslip" />}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.payslips.map((s, i) => {
                      const id = s.employee_id ?? '';
                      const extras = slipExtras(s, money);
                      const open = adjustOpen === id;
                      const ch = changes[id] ?? NO_CHANGE;
                      return [
                        <tr key={`r${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ ...td, textAlign: 'left', color: 'var(--text-1)', fontWeight: 600, whiteSpace: 'normal' }}>
                            {s.employee_name}
                            {extras && <div style={{ fontWeight: 400, fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{extras}</div>}
                          </td>
                          <td style={td}>{money(s.gross)}</td>
                          <td style={td}>{s.napsa_exempt ? 'none' : money(s.napsa_employee)}</td>
                          <td style={td}>{money(s.nhima_employee)}</td>
                          <td style={td}>{s.paye < 0 ? `refund ${money(-s.paye)}` : money(s.paye)}</td>
                          <td style={td}>{money(s.loan_deduction)}</td>
                          {anyGratuityPaid && <td style={td}>{money(s.gratuity_paid ?? 0)}</td>}
                          <td style={{ ...td, color: 'var(--text-1)', fontWeight: 700 }}>{money(s.net)}</td>
                          {/* This month as it really was: a part month, extra
                              pay, leave days paid out, the gratuity paid. */}
                          {!alreadyRun && (
                            <td style={td}>
                              {id && (
                                <button type="button" className="icon-pill" aria-expanded={open}
                                  aria-label={`This month for ${s.employee_name}`} onClick={() => setAdjustOpen(open ? null : id)}>
                                  <SlidersHorizontal aria-hidden="true" />
                                </button>
                              )}
                            </td>
                          )}
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
                        </tr>,
                        open && (
                          <tr key={`a${i}`}>
                            <td colSpan={9} style={{ padding: '8px 4px 16px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                                <div><label className="field-label" htmlFor={`ch-basic-${id}`}>Basic this month ({sym})</label>
                                  <input id={`ch-basic-${id}`} type="number" min="0" step="0.01" className="field" value={ch.basic}
                                    placeholder={String(s.basic_full ?? s.basic ?? '')} onChange={e => setChange(id, { basic: e.target.value })} /></div>
                                <div><label className="field-label" htmlFor={`ch-allow-${id}`}>Allowances this month ({sym})</label>
                                  <input id={`ch-allow-${id}`} type="number" min="0" step="0.01" className="field" value={ch.allowances}
                                    placeholder={String(s.allowances ?? 0)} onChange={e => setChange(id, { allowances: e.target.value })} /></div>
                                <div><label className="field-label" htmlFor={`ch-extra-${id}`}>Extra pay ({sym})</label>
                                  <input id={`ch-extra-${id}`} type="number" min="0" step="0.01" className="field" value={ch.extra_pay}
                                    placeholder="0" onChange={e => setChange(id, { extra_pay: e.target.value })} /></div>
                                <div><label className="field-label" htmlFor={`ch-note-${id}`}>What for</label>
                                  <input id={`ch-note-${id}`} className="field" value={ch.extra_note} maxLength={120}
                                    placeholder="Overtime, bonus" onChange={e => setChange(id, { extra_note: e.target.value })} /></div>
                                <div><label className="field-label" htmlFor={`ch-leave-${id}`}>Leave days paid out</label>
                                  <input id={`ch-leave-${id}`} type="number" min="0" step="0.5" className="field" value={ch.leave_days}
                                    placeholder="0" onChange={e => setChange(id, { leave_days: e.target.value })} /></div>
                              </div>
                              {((s.gratuity_owed_before ?? 0) + (s.gratuity_accrued ?? 0) > 0) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                                  <input id={`ch-grat-${id}`} type="checkbox" checked={ch.pay_gratuity}
                                    onChange={e => setChange(id, { pay_gratuity: e.target.checked })} style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
                                  <label htmlFor={`ch-grat-${id}`} style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', cursor: 'pointer' }}>
                                    Pay their gratuity with this pay: {money((s.gratuity_owed_before ?? 0) + (s.gratuity_accrued ?? 0))}, tax-free
                                  </label>
                                </div>
                              )}
                              <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                                {s.started_on ? `Started on ${s.started_on}: type the basic for the days worked. ` : ''}
                                {s.ends_on ? `${s.kind === 'pay' ? 'Contract ends' : 'Left'} on ${s.ends_on}: type the basic for the days worked and any leave days owed. ` : ''}
                                Extra pay and leave days are taxed and count for NAPSA; NHIMA and the gratuity are on basic pay only. Leave days are full pay × days ÷ 26.
                              </p>
                              <button type="button" className="pill" style={{ marginTop: 8 }} disabled={busy} onClick={() => void doPreview()}>
                                {busy ? 'Working it out…' : 'Work it out again'}
                              </button>
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border-md)' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: 'var(--text-2)' }}>Total for {preview.totals.headcount}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.gross)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.napsa_employee)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.nhima_employee)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.paye)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.loan_deduction)}</td>
                      {anyGratuityPaid && <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.gratuity_paid ?? 0)}</td>}
                      <td style={{ ...td, fontWeight: 600, color: 'var(--text-1)' }}>{money(preview.totals.net)}</td>
                      {!alreadyRun && <td style={td} />}
                      {periodRun && <td style={td} />}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {(preview.notes ?? []).map((n, i) => <Note key={i} tone="info">{n}</Note>)}

              <p className="day-label" style={{ marginTop: 16 }}>Paid by you on top of their pay</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="card-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}>Employee</th>
                      <th style={th}>NAPSA 5%</th><th style={th}>NHIMA 1%</th>
                      {preview.sdl?.due && <th style={th}>Levy 0.5%</th>}
                      {anyGratuitySetAside && <th style={th}>Gratuity set aside</th>}
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
                        {anyGratuitySetAside && <td style={td}>{money(s.gratuity_accrued ?? 0)}</td>}
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
                      {anyGratuitySetAside && <td style={{ ...td, fontWeight: 700 }}>{money(preview.totals.gratuity_accrued)}</td>}
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
                {anyGratuitySetAside && (
                  <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
                    Cost to you includes {money(preview.totals.gratuity_accrued)} of gratuity set aside: owed to staff, paid when their contracts end
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
                    {/* Payslips to the staff themselves: email from AIBOS or
                        WhatsApp from the owner's phone, and who has theirs. */}
                    {pro && (
                      <button type="button" onClick={() => setSendOpen(o => o === r.id ? null : r.id)}
                        aria-expanded={sendOpen === r.id} className={sendOpen === r.id ? 'pill' : 'pill pill-quiet'}>
                        <Send aria-hidden="true" />Send payslips
                      </button>
                    )}
                    <button type="button" onClick={() => void getDoc(r.id, r.period)} disabled={docBusy === r.id} className="pill pill-quiet">
                      <FileText aria-hidden="true" />{docBusy === r.id ? 'Preparing…' : 'Tax pack'}
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
                  {pro && sendOpen === r.id && <PayslipSend runId={r.id} money={money} />}
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
              Using {rates.currency} statutory rates effective {rates.effective_from}: PAYE on gross pay on ZRA&rsquo;s cumulative tables, up to {Math.round((rates.paye_bands.at(-1)?.rate ?? 0) * 100)}%; NAPSA {Math.round(rates.napsa_rate * 100)}% from staff and {Math.round(rates.napsa_rate * 100)}% from you, on gross pay up to {money(rates.napsa_ceiling)}; NHIMA {Math.round(rates.nhima_rate * 100)}% from staff and {Math.round(rates.nhima_rate * 100)}% from you, on basic pay{rates.sdl_rate ? `; Skills Development Levy ${(rates.sdl_rate * 100).toFixed(1)}% from you` : ''}; gratuity at least 25% of basic pay on contracts, tax-free. Kept current for you: no tax tables to manage.
            </p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
