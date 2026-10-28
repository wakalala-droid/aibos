'use client';
/**
 * AIBOS — Teach AIBOS your business.
 *
 * A new owner's books are empty, and empty books tell AIBOS nothing about the
 * business behind them: how old it is, what sells, which months are busy, what
 * the owner is aiming for. So AIBOS asks, the way a good accountant does on the
 * first visit: one question at a time, in five short chapters, every one of
 * them skippable, and says back what it took from each answer.
 *
 * What the answers do (aibos-api interview.py): the AI chat reads them on every
 * question; the money goals become a target for each coming month when the
 * owner presses the button, never over one they set by hand; the morning
 * brief paces the month against it; the cash plan keeps their cushion and
 * counts the loan repayment they named; Unusual spending, Month by month and
 * the Forecast read their busy and quiet months (seasons.py); and the AIBOS
 * workbook offers their own ways of being paid and biggest costs first.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, FileSpreadsheet, Target } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { BentoCard, Notice } from '@/components/kit';
import {
  ApiError, answerInterview, applyInterviewPlan, downloadWorkbook, getInterview, getInterviewPlan,
  type InterviewAnswer, type InterviewPlan, type InterviewQuestion, type InterviewState,
} from '@/lib/api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** 'a', 'a and b', 'a, b and c': never a comma before "and" (house style). */
function joinWords(items: string[]): string {
  const xs = items.filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

function money(n: number, sym: string): string {
  const body = n.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
  return sym.length > 1 ? `${sym} ${body}` : `${sym}${body}`;
}

function monthName(ym: string): string {
  const [y, m] = ym.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : ym;
}

/** An answer the way a person would say it back. */
function shown(q: InterviewQuestion, a: InterviewAnswer | undefined, sym: string): string {
  if (!a) return '';
  if (a.skipped) return 'Skipped';
  const v = a.value;
  switch (q.kind) {
    case 'money': return money(Number(v), sym);
    case 'month': return monthName(String(v));
    case 'months': return joinWords(((v as number[]) ?? []).map(m => MONTHS[m - 1]));
    // A dot between picks: "Rent and Electricity and water" reads as one thing.
    case 'multi': return ((v as string[]) ?? []).join(' · ');
    default: return String(v ?? '');
  }
}

/** What the owner said, in their own words when they used some. */
function theirWords(q: InterviewQuestion, a: InterviewAnswer, sym: string): string {
  return a.skipped ? 'Skip this one' : a.text || shown(q, a, sym);
}

/** The text box's starting value when an answer is being changed. */
function draftOf(q: InterviewQuestion, a: InterviewAnswer | undefined): string {
  if (!a || a.skipped || a.value == null) return '';
  if (q.kind === 'money' || q.kind === 'number') return a.text || String(a.value);
  if (q.kind === 'month') return monthName(String(a.value));
  if (q.kind === 'text') return String(a.value);
  return '';
}

const bubbleAibos: React.CSSProperties = {
  maxWidth: '88%', alignSelf: 'flex-start', background: 'var(--bg-card)',
  border: '1px solid var(--border-md)', borderRadius: '16px 16px 16px 6px', padding: '12px 16px',
};
const bubbleOwner: React.CSSProperties = {
  maxWidth: '88%', alignSelf: 'flex-end', background: 'var(--text-1)', color: 'var(--bg-card)',
  borderRadius: '16px 16px 6px 16px', padding: '12px 16px',
};
const bubbleText: React.CSSProperties = { margin: 0, fontSize: 'var(--fs-body)', lineHeight: 1.6 };

export default function TeachPage() {
  const [state, setState] = useState<InterviewState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [picks, setPicks] = useState<string[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  // What AIBOS said back about each answer this visit.
  const [said, setSaid] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planDone, setPlanDone] = useState<{ written: number; kept: number; first_month?: string } | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  /** Open an answer to change it. On a phone the list sits under the
   *  question, so the question is brought into view as well. */
  function change(id: string) {
    setCurrentId(id);
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    getInterview()
      .then(s => { setState(s); setCurrentId(s.next); })
      .catch(e => setLoadError((e as Error).message || 'Could not load the interview.'));
  }, []);

  const sym = state?.symbol ?? 'K';
  const questions = useMemo(() => state?.questions ?? [], [state]);
  const answers = useMemo(() => state?.answers ?? {}, [state]);
  const chapters = state?.chapters ?? [];
  const byId = useMemo(() => Object.fromEntries(questions.map(q => [q.id, q])), [questions]);
  const current = currentId ? byId[currentId] : undefined;
  const chapterIdx = current ? chapters.findIndex(c => c.id === current.chapter) : chapters.length;
  const chapter = chapters[chapterIdx];

  // A fresh box for each question, holding the answer when it is being changed.
  useEffect(() => {
    if (!current) return;
    const a = answers[current.id];
    setDraft(draftOf(current, a));
    const v = a && !a.skipped ? a.value : undefined;
    const known = current.options ?? [];
    setPicks(current.kind === 'multi' && Array.isArray(v) ? (v as string[]).filter(x => known.includes(x)) : []);
    setOther(current.kind === 'multi' && Array.isArray(v) ? (v as string[]).filter(x => !known.includes(x)).join(', ') : '');
    setMonths(current.kind === 'months' && Array.isArray(v) ? (v as number[]) : []);
    setAnswerError(null);
    // Only a typing box takes the focus: chips are tapped, not typed into.
    if (['text', 'money', 'number', 'month'].includes(current.kind)) {
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }), 0);
  }, [current, answers]);

  // The goals as monthly targets, once there are goals to plan from.
  const goalKey = ['sales_goal', 'sales_goal_by', 'profit_goal', 'normal_sales', 'normal_costs']
    .map(k => JSON.stringify(answers[k]?.value ?? null)).join('|');
  const hasGoal = ['sales_goal', 'profit_goal'].some(k => answers[k] && !answers[k].skipped);
  useEffect(() => {
    if (!hasGoal) { setPlan(null); return; }
    getInterviewPlan().then(setPlan).catch(() => setPlan(null));
  }, [hasGoal, goalKey]);

  const send = useCallback(async (q: InterviewQuestion, value: unknown, skip = false) => {
    setSaving(true); setAnswerError(null);
    try {
      const next = await answerInterview(q.id, value, { skip });
      setState(next);
      setSaid(s => {
        const out = { ...s };
        if (next.said) out[q.id] = next.said; else delete out[q.id];
        return out;
      });
      setCurrentId(next.next);
    } catch (e) {
      setAnswerError(e instanceof ApiError || e instanceof Error ? e.message : 'That answer was not saved.');
    } finally {
      setSaving(false);
    }
  }, []);

  function submit() {
    if (!current || saving) return;
    if (current.kind === 'multi') {
      const extra = other.split(',').map(s => s.trim()).filter(Boolean);
      return void send(current, [...picks, ...extra]);
    }
    if (current.kind === 'months') return void send(current, months);
    return void send(current, draft);
  }

  function back() {
    if (!current) {
      const last = [...questions].reverse().find(q => answers[q.id]);
      if (last) change(last.id);
      return;
    }
    const i = questions.findIndex(q => q.id === current.id);
    if (i > 0) setCurrentId(questions[i - 1].id);
  }

  async function applyPlan() {
    setPlanBusy(true); setPlanError(null);
    try {
      setPlanDone(await applyInterviewPlan());
      setPlan(await getInterviewPlan());
    } catch (e) {
      setPlanError((e as Error).message || 'The targets were not set.');
    } finally {
      setPlanBusy(false);
    }
  }

  async function download() {
    setDownloading(true); setDownloadError(null);
    try { await downloadWorkbook(); }
    catch (e) { setDownloadError((e as Error).message || 'The workbook did not download.'); }
    finally { setDownloading(false); }
  }

  const header = (
    <PageHeader
      title="Teach AIBOS your business"
      subtitle="AIBOS asks and you answer, one question at a time. Skip any you like. The AI chat, your cash plan and your reports use what you say."
      actions={
        <button type="button" className="pill pill-quiet" onClick={() => void download()} disabled={downloading}>
          <FileSpreadsheet aria-hidden="true" /> {downloading ? 'Making your workbook…' : 'Download your AIBOS workbook'}
        </button>
      }
    />
  );

  if (loadError) {
    return (
      <>
        {header}
        <Notice icon={BookOpen} bad title="The interview could not open" tag="Not ready" role="alert">
          {loadError}
        </Notice>
      </>
    );
  }
  if (!state) {
    return (
      <>
        {header}
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Opening your interview…</p>
      </>
    );
  }

  const { progress } = state;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const thread = current
    ? questions.filter(q => q.chapter === current.chapter && answers[q.id] && q.id !== current.id
        && questions.indexOf(q) < questions.indexOf(current))
    : [];
  const goalsDone = !current || chapterIdx > chapters.findIndex(c => c.id === 'money_goals');
  const typing = current && ['text', 'money', 'number', 'month'].includes(current.kind);

  return (
    <>
      {header}

      <div className="bento-grid">
        {/* The conversation ------------------------------------------------ */}
        {/* Its own height: the answer list beside it grows, and stretching
            to match it left a tall empty card under the question. */}
        <section ref={panelRef} className="ai-panel span-4" aria-label="The interview"
          style={{ boxShadow: 'var(--shadow-card)', alignSelf: 'start', scrollMarginTop: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <span className="bento-icon" aria-hidden="true"><BookOpen /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bento-titlerow">
                <h2 className="bento-title">{chapter ? chapter.title : 'All done'}</h2>
                <span className="bento-tag">
                  {chapter ? `Part ${chapterIdx + 1} of ${chapters.length}` : `${progress.answered} answered`}
                </span>
              </div>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', margin: '4px 0 0' }}>
                {chapter ? chapter.intro : 'AIBOS has what it needs. Change any answer at any time.'}
              </p>
            </div>
          </div>

          <div style={{ padding: '14px 24px 0' }}>
            <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total}
              aria-valuenow={progress.done} aria-label="How far through the interview">
              <div className="meter-fill" style={{ width: `${pct}%` }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>
              {progress.finished
                ? `All ${progress.total} questions done`
                : `${progress.done} of ${progress.total} questions · about ${Math.max(1, Math.ceil((progress.total - progress.done) / 6))} minute${progress.total - progress.done > 6 ? 's' : ''} left`}
            </p>
          </div>

          <div ref={logRef} role="log" aria-live="polite" aria-label="Questions and answers"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 24px', maxHeight: 520, overflowY: 'auto' }}>
            {thread.map(q => (
              <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={bubbleAibos}><p style={{ ...bubbleText, color: 'var(--text-1)' }}>{q.ask}</p></div>
                <div style={bubbleOwner}><p style={bubbleText}>{theirWords(q, answers[q.id], sym)}</p></div>
                {said[q.id] && (
                  <div style={bubbleAibos}><p style={{ ...bubbleText, color: 'var(--text-2)' }}>{said[q.id]}</p></div>
                )}
              </div>
            ))}

            {current ? (
              <div style={bubbleAibos}>
                <p style={{ ...bubbleText, color: 'var(--text-1)', fontWeight: 600 }}>{current.ask}</p>
                <p style={{ ...bubbleText, marginTop: 4, color: 'var(--text-3)', fontSize: 'var(--fs-data)' }}>{current.why}</p>
              </div>
            ) : (
              <Notice brand art title={`AIBOS knows ${state.business || 'your business'}`} tag="Done">
                The AI chat now answers with all of this in mind: your normal month, your goals,
                your busy and quiet months and what worries you. Your cash plan keeps your cushion
                and your reports know your seasons. Change any answer from the list.
              </Notice>
            )}
          </div>

          {current && (
            <div style={{ padding: '4px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {current.kind === 'choice' && (
                <div className="chips" role="group" aria-label={current.ask}>
                  {(current.options ?? []).map(o => (
                    <button key={o} type="button" className="chip" disabled={saving}
                      aria-pressed={!answers[current.id]?.skipped && answers[current.id]?.value === o}
                      onClick={() => void send(current, o)}>
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {current.kind === 'multi' && (
                <>
                  <div className="chips" role="group" aria-label={current.ask}>
                    {(current.options ?? []).map(o => (
                      <button key={o} type="button" className="chip" aria-pressed={picks.includes(o)}
                        onClick={() => setPicks(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o])}>
                        {picks.includes(o) && <Check size={16} aria-hidden="true" />}{o}
                      </button>
                    ))}
                  </div>
                  <label style={{ display: 'block' }}>
                    <span className="field-label">Something else? Type it, with commas between</span>
                    <input className="field" value={other} onChange={e => setOther(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
                  </label>
                </>
              )}

              {current.kind === 'months' && (
                <div className="chips" role="group" aria-label={current.ask}>
                  {MONTHS.map((m, i) => (
                    <button key={m} type="button" className="chip" aria-pressed={months.includes(i + 1)}
                      onClick={() => setMonths(ms => ms.includes(i + 1) ? ms.filter(x => x !== i + 1) : [...ms, i + 1])}>
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}

              {current.kind === 'text' && (
                <label style={{ display: 'block' }}>
                  <span className="sr-only">{current.ask}</span>
                  <textarea ref={inputRef} className="field" rows={3} value={draft} placeholder={current.placeholder}
                    onChange={e => setDraft(e.target.value)} maxLength={600}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    style={{ resize: 'vertical', lineHeight: 1.5, paddingTop: 10 }} />
                </label>
              )}

              {(current.kind === 'money' || current.kind === 'number' || current.kind === 'month') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 360 }}>
                  <span className="sr-only">{current.ask}</span>
                  {current.kind === 'money' && (
                    <span aria-hidden="true" style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-2)' }}>{sym}</span>
                  )}
                  <input ref={inputRef} className="field" value={draft} placeholder={current.placeholder}
                    inputMode={current.kind === 'month' ? 'text' : current.kind === 'number' ? 'numeric' : 'decimal'}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
                </label>
              )}

              {answerError && (
                <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--red)' }}>{answerError}</p>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {current.kind !== 'choice' && (
                  <button type="button" className="pill pill-primary" onClick={submit}
                    disabled={saving || (typing ? !draft.trim()
                      : current.kind === 'multi' ? picks.length === 0 && !other.trim()
                      : months.length === 0)}>
                    {saving ? 'Saving…' : 'Answer'}
                  </button>
                )}
                <button type="button" className="pill pill-quiet" disabled={saving}
                  onClick={() => void send(current, null, true)}>
                  Skip
                </button>
                {questions.indexOf(current) > 0 && (
                  <button type="button" className="pill pill-quiet" disabled={saving} onClick={back}>
                    Back
                  </button>
                )}
                {typing && current.kind === 'text' && (
                  <span style={{ fontSize: 'var(--fs-data)', color: 'var(--text-4)' }}>Enter sends</span>
                )}
              </div>
            </div>
          )}

          {!current && (
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/dashboard" className="pill pill-primary" style={{ textDecoration: 'none' }}>Go to Home</Link>
              <button type="button" className="pill pill-quiet" onClick={back}>Change my last answer</button>
            </div>
          )}
        </section>

        {/* What AIBOS knows, and what it does with it ------------------------ */}
        <div className="span-2" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <BentoCard icon={<Check />} title="What AIBOS knows" tag={`${progress.answered}`} motion="pulse"
            text={progress.answered ? undefined : 'Your answers collect here. Tap any one to change it.'}>
            {progress.done > 0 && (
              <div style={{ marginTop: 8 }}>
                {chapters.map(c => {
                  const qs = questions.filter(q => q.chapter === c.id && answers[q.id]);
                  if (!qs.length) return null;
                  return (
                    <div key={c.id} style={{ marginTop: 12 }}>
                      <p className="eyebrow" style={{ marginBottom: 4 }}>{c.title}</p>
                      {qs.map(q => (
                        <button key={q.id} type="button" onClick={() => change(q.id)}
                          aria-label={`Change: ${q.label}`}
                          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                            borderTop: '1px solid var(--border)', padding: '8px 0', cursor: 'pointer', font: 'inherit',
                            minHeight: 44 }}>
                          <span style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>{q.label}</span>
                          <span style={{ display: 'block', fontSize: 'var(--fs-data)', fontWeight: 600,
                            color: answers[q.id].skipped ? 'var(--text-4)' : 'var(--text-1)', overflowWrap: 'anywhere' }}>
                            {shown(q, answers[q.id], sym)}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </BentoCard>

          <BentoCard icon={<FileSpreadsheet />} title="Your AIBOS workbook" tag="Excel" motion="tilt"
            text="A spreadsheet laid out the way AIBOS reads, with your products, workers and ways of being paid already in it. Fill it in and upload it: every line lands in the right place."
            foot={<>
              <button type="button" className="pill pill-primary" onClick={() => void download()} disabled={downloading}>
                {downloading ? 'Making it…' : 'Download'}
              </button>
              <Link href="/dashboard/import" className="pill pill-quiet" style={{ textDecoration: 'none' }}>Upload it</Link>
            </>}>
            {downloadError && <p role="alert" className="bento-note" style={{ color: 'var(--red)', marginTop: 8 }}>{downloadError}</p>}
          </BentoCard>
        </div>

        {/* The goals as monthly targets ---------------------------------------- */}
        {plan?.ok && goalsDone && (
          <BentoCard className="span-6" icon={<Target />} title="Your goals, month by month" tag="Plan"
            text={`Each month's target climbs evenly from ${plan.basis ?? 'where you are'} to your goal${plan.horizon ? ` over ${plan.horizon} months` : ''}, then holds there. Home shows how each month is pacing against it.`}
            foot={
              <>
                <button type="button" className="pill pill-primary" onClick={() => void applyPlan()}
                  disabled={planBusy || (plan.to_write ?? 0) === 0}>
                  {planBusy ? 'Setting them…' : (plan.to_write ?? 0) === 0 ? 'All set' : 'Set these as my monthly targets'}
                </button>
                {(plan.own ?? 0) > 0 ? (
                  <span className="bento-note">
                    {plan.own} target{plan.own === 1 ? '' : 's'} you set yourself stay{plan.own === 1 ? 's' : ''} as {plan.own === 1 ? 'it is' : 'they are'}.
                  </span>
                ) : (plan.to_write ?? 0) === 0 && (
                  <span className="bento-note">These are your monthly targets now.</span>
                )}
              </>
            }>
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    {plan.months.some(m => m.revenue != null) && <th style={{ textAlign: 'right' }}>Sales target</th>}
                    {plan.months.some(m => m.profit != null) && <th style={{ textAlign: 'right' }}>Profit target</th>}
                  </tr>
                </thead>
                <tbody>
                  {plan.months.map(m => (
                    <tr key={m.month}>
                      <td>{monthName(m.month)}</td>
                      {plan.months.some(x => x.revenue != null) && (
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.revenue != null ? money(m.revenue, sym) : 'None'}</td>
                      )}
                      {plan.months.some(x => x.profit != null) && (
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.profit != null ? money(m.profit, sym) : 'None'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {planDone && (
              <p role="status" className="bento-note" style={{ marginTop: 12, color: 'var(--text-1)' }}>
                {planDone.written} target{planDone.written === 1 ? '' : 's'} set
                {planDone.first_month ? ` from ${monthName(planDone.first_month)}` : ''}.
                {' '}<Link href="/dashboard" style={{ color: 'var(--text-1)' }}>See this month on Home</Link>
              </p>
            )}
            {planError && <p role="alert" className="bento-note" style={{ marginTop: 12, color: 'var(--red)' }}>{planError}</p>}
          </BentoCard>
        )}
      </div>
    </>
  );
}
