'use client';
/**
 * AI-BOS — Schedule (the Scheduler).
 * Meetings, pick-ups, deliveries, deadlines, payments due — the owner's week in
 * one agenda. A schedule item is a commitment, not a business fact: completing a
 * pick-up or payment offers the record bridge, one tap creating the matching
 * Business Event so the commitment lands in the books.
 *
 * Agenda is the primary view (mobile-first — month grids are desktop thinking);
 * the month grid is secondary. Recurrence + reminders are the Pro layer; core
 * scheduling is free, like recording.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SectionCard from '@/components/ui/SectionCard';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { canAccess, requiredTier, TIERS } from '@/lib/tiers';
import {
  listSchedule, createScheduleItem, updateScheduleItem, setScheduleStatus,
  deleteScheduleItem, createEvent, type ScheduleItem, type ScheduleKind,
  type Recurrence, type EventType,
} from '@/lib/api';

// ── Kind vocabulary (colour = meaning, per visual_language_system) ──────────
const KIND_META: Record<ScheduleKind, { label: string; colour: string }> = {
  meeting:     { label: 'Meeting',  colour: 'var(--cyan)'   },
  pickup:      { label: 'Pick-up',  colour: 'var(--green)'  },
  delivery:    { label: 'Delivery', colour: 'var(--e2)'     },
  deadline:    { label: 'Deadline', colour: 'var(--red)'    },
  payment_due: { label: 'Payment',  colour: 'var(--amber)'  },
  reminder:    { label: 'Reminder', colour: 'var(--text-3)' },
  other:       { label: 'Other',    colour: 'var(--text-3)' },
};
const QUICK_KINDS: ScheduleKind[] = ['meeting', 'pickup', 'delivery', 'deadline', 'payment_due', 'reminder'];

// Kinds where "done" usually means money moved — they get the record bridge.
const BRIDGE_TYPES: Partial<Record<ScheduleKind, EventType>> = {
  pickup: 'Sale', delivery: 'Sale', payment_due: 'Expense',
};
const BRIDGE_OPTIONS: EventType[] = ['Sale', 'Expense', 'SupplierPayment', 'CustomerPayment'];

// Zambia-relevant statutory + rhythm seeds (empty state, one tap each).
const SEEDS: Array<{ title: string; kind: ScheduleKind; day: number }> = [
  { title: 'NAPSA contribution', kind: 'deadline',    day: 10 },
  { title: 'ZRA PAYE',           kind: 'deadline',    day: 10 },
  { title: 'ZRA VAT return',     kind: 'deadline',    day: 18 },
  { title: 'Rent',               kind: 'payment_due', day: 1  },
  { title: 'Salaries',           kind: 'payment_due', day: 28 },
];

type RepeatChoice = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
const REPEAT_RULES: Record<Exclude<RepeatChoice, 'none'>, Recurrence> = {
  daily:    { freq: 'daily',   interval: 1 },
  weekly:   { freq: 'weekly',  interval: 1 },
  biweekly: { freq: 'weekly',  interval: 2 },
  monthly:  { freq: 'monthly', interval: 1 },
};

interface FormState {
  kind: ScheduleKind; title: string; date: string; time: string; allDay: boolean;
  withWhom: string; location: string; amount: string; notes: string; repeat: RepeatChoice;
}
const todayISO = () => new Date().toISOString().slice(0, 10);
const EMPTY: FormState = {
  kind: 'meeting', title: '', date: todayISO(), time: '09:00', allDay: false,
  withWhom: '', location: '', amount: '', notes: '', repeat: 'none',
};

// ── Date helpers (rendered in the browser's zone — CAT for Zambian owners) ───
const DAY_MS = 86_400_000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d: Date) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** Next date this day-of-month occurs (this month if still ahead, else next). */
function nextMonthly(day: number): Date {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), day, 9, 0);
  return candidate > now ? candidate : new Date(now.getFullYear(), now.getMonth() + 1, day, 9, 0);
}

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', outline: 'none',
};
const lbl: React.CSSProperties = { fontFamily: 'Geist, sans-serif', fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };
const ghostBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: '0.7rem' };

export default function SchedulePage() {
  const sym = useStore(s => s.currencySymbol) || 'K';
  const tier = useStore(s => s.tier);
  const pro = canAccess(tier, 'schedule');
  const needTier = TIERS[requiredTier('schedule')].name;

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [monthCursor, setMonthCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Record bridge: the just-completed item awaiting "put it in the books?".
  const [bridge, setBridge] = useState<ScheduleItem | null>(null);
  const [bridgeType, setBridgeType] = useState<EventType>('Sale');
  const [bridgeBusy, setBridgeBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listSchedule(60)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));

  function edit(it: ScheduleItem) {
    const d = new Date(it.starts_at);
    setEditId(it.id);
    setMoreOpen(true);
    setForm({
      kind: it.kind, title: it.title, date: dayKey(d),
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      allDay: it.all_day, withWhom: it.with_whom ?? '', location: it.location ?? '',
      amount: it.amount != null ? String(it.amount) : '', notes: it.notes ?? '',
      repeat: !it.recurrence ? 'none'
        : it.recurrence.freq === 'daily' ? 'daily'
        : it.recurrence.freq === 'monthly' ? 'monthly'
        : (it.recurrence.interval ?? 1) === 2 ? 'biweekly' : 'weekly',
    });
  }
  function cancelEdit() { setEditId(null); setForm(EMPTY); setMoreOpen(false); }

  async function save() {
    if (!form.title.trim()) { setError('Give it a title.'); return; }
    if (!form.date) { setError('Pick a date.'); return; }
    setSaving(true); setError(null);
    try {
      const starts = new Date(`${form.date}T${form.allDay ? '09:00' : (form.time || '09:00')}`);
      const body = {
        kind: form.kind, title: form.title.trim(), starts_at: starts.toISOString(),
        all_day: form.allDay,
        with_whom: form.withWhom.trim() || null,
        location: form.location.trim() || null,
        amount: form.amount ? Number(form.amount) : null,
        notes: form.notes.trim() || null,
        // Only Pro sends the paid keys — the backend enforces this server-side too.
        ...(pro ? { recurrence: form.repeat === 'none' ? null : REPEAT_RULES[form.repeat] } : {}),
      };
      if (editId) await updateScheduleItem(editId, body);
      else await createScheduleItem(body);
      cancelEdit(); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function markDone(it: ScheduleItem) {
    setError(null);
    try {
      await setScheduleStatus(it.id, 'done');
      // The record bridge: money-shaped commitments offer one-tap bookkeeping.
      if (BRIDGE_TYPES[it.kind] && (it.amount ?? 0) > 0) {
        setBridge(it); setBridgeType(BRIDGE_TYPES[it.kind]!);
      }
      await load();
    } catch (e) { setError((e as Error).message); }
  }

  async function recordBridge() {
    if (!bridge) return;
    setBridgeBusy(true); setError(null);
    try {
      const payload: Record<string, unknown> = { amount: bridge.amount };
      if (bridgeType === 'Sale' || bridgeType === 'CustomerPayment') payload.customer = bridge.with_whom || bridge.title;
      if (bridgeType === 'SupplierPayment') payload.supplier = bridge.with_whom || bridge.title;
      if (bridgeType === 'Expense') payload.category = bridge.title;
      const ev = await createEvent({
        event_type: bridgeType, payload, source: 'manual', status: 'confirmed',
        occurred_at: new Date().toISOString(),
      });
      await updateScheduleItem(bridge.id, { linked_event_id: ev.id });
      setBridge(null); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBridgeBusy(false); }
  }

  async function remove(id: string) {
    try { await deleteScheduleItem(id); if (editId === id) cancelEdit(); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  async function addSeed(seed: { title: string; kind: ScheduleKind; day: number }) {
    setError(null);
    try {
      await createScheduleItem({
        title: seed.title, kind: seed.kind, all_day: true,
        starts_at: nextMonthly(seed.day).toISOString(),
        // Free gets the next due date; Pro makes it repeat every month.
        ...(pro ? { recurrence: { freq: 'monthly', interval: 1 } } : {}),
      });
      await load();
    } catch (e) { setError((e as Error).message); }
  }

  // ── Grouping: each scheduled item surfaces at its next occurrence ──────────
  const groups = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const g = { overdue: [] as Array<[Date, ScheduleItem]>, today: [] as Array<[Date, ScheduleItem]>, tomorrow: [] as Array<[Date, ScheduleItem]>, week: [] as Array<[Date, ScheduleItem]>, later: [] as Array<[Date, ScheduleItem]>, finished: [] as Array<[Date, ScheduleItem]> };
    for (const it of items) {
      const when = new Date(it.next_occurrences?.[0] ?? it.starts_at);
      if (it.status === 'done' || it.status === 'missed') { g.finished.push([new Date(it.starts_at), it]); continue; }
      const dayDiff = Math.floor((startOfDay(when).getTime() - today.getTime()) / DAY_MS);
      const due = it.ends_at ? new Date(it.ends_at) : when;
      if (due < now && dayDiff <= 0) g.overdue.push([when, it]);
      else if (dayDiff <= 0) g.today.push([when, it]);
      else if (dayDiff === 1) g.tomorrow.push([when, it]);
      else if (dayDiff <= 7) g.week.push([when, it]);
      else g.later.push([when, it]);
    }
    (Object.keys(g) as Array<keyof typeof g>).forEach(k => g[k].sort((a, b) => a[0].getTime() - b[0].getTime()));
    g.finished.reverse();
    return g;
  }, [items]);

  // ── Month grid: occurrences per day for the cursor month ───────────────────
  const monthDays = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      if (it.status === 'cancelled') continue;
      const occs = it.status === 'scheduled' ? (it.next_occurrences?.length ? it.next_occurrences : [it.starts_at]) : [it.starts_at];
      for (const o of occs) {
        const k = dayKey(new Date(o));
        map.set(k, [...(map.get(k) ?? []), it]);
      }
    }
    const first = new Date(monthCursor);
    const lead = (first.getDay() + 6) % 7;                      // Monday-first week
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: Array<{ key: string; day: number; items: ScheduleItem[] } | null> = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const k = dayKey(new Date(first.getFullYear(), first.getMonth(), d));
      cells.push({ key: k, day: d, items: map.get(k) ?? [] });
    }
    return cells;
  }, [items, monthCursor]);

  const kindBadge = (kind: ScheduleKind) => {
    const m = KIND_META[kind];
    return (
      <span className="badge" style={{ background: `color-mix(in srgb, ${m.colour} 12%, transparent)`, color: m.colour, flexShrink: 0 }}>
        {m.label}
      </span>
    );
  };

  const itemRow = (when: Date, it: ScheduleItem, finished = false) => (
    <div key={`${it.id}-${when.getTime()}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: finished ? 0.55 : 1 }}>
      {kindBadge(it.kind)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: finished ? 'line-through' : 'none' }}>
          {it.title}
          {(it.amount ?? 0) > 0 && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> · {sym}{fmt(it.amount!)}</span>}
        </div>
        <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)' }}>
          {fmtDay(when)}{it.all_day ? '' : ` · ${fmtTime(when)}`}
          {it.with_whom ? ` · ${it.with_whom}` : ''}{it.location ? ` · ${it.location}` : ''}
          {it.recurrence && it.next_occurrences && it.next_occurrences.length > 1 && (
            <span> · ↻ next {it.next_occurrences.slice(1, 3).map(o => new Date(o).toLocaleDateString([], { day: 'numeric', month: 'short' })).join(', ')}</span>
          )}
          {finished && ` · ${it.status === 'done' ? 'done' : 'missed'}`}
          {it.linked_event_id && ' · recorded ✓'}
        </div>
      </div>
      {!finished && (
        <button type="button" onClick={() => markDone(it)} className="touch-target" aria-label={`Mark ${it.title} done`}
          style={{ minHeight: 34, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--green)', fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          Done
        </button>
      )}
      {!finished && <button type="button" onClick={() => edit(it)} style={{ ...ghostBtn, color: 'var(--cyan)' }}>Edit</button>}
      <button type="button" onClick={() => remove(it.id)} style={{ ...ghostBtn, color: 'var(--text-4)' }}>Delete</button>
    </div>
  );

  const group = (label: string, entries: Array<[Date, ScheduleItem]>, warn = false) =>
    entries.length === 0 ? null : (
      <div key={label} style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: warn ? 'var(--amber)' : 'var(--text-4)', marginBottom: 2 }}>
          {label}
        </div>
        {entries.map(([when, it]) => itemRow(when, it))}
      </div>
    );

  const hasAny = items.length > 0;
  const selDayItems = selectedDay ? (monthDays.find(c => c?.key === selectedDay)?.items ?? []) : [];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>Schedule</h1>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>
          Meetings, pick-ups and deadlines — your week, one glance.
        </p>
      </div>

      <div className="grid-main">
        <SectionCard
          title="Coming up" explainId="schedule.agenda"
          subtitle={loading ? 'Loading…' : `${items.filter(i => i.status === 'scheduled').length} scheduled`}
          action={
            <div role="group" aria-label="Schedule view" style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-md)', background: 'var(--bg-badge)' }}>
              {(['agenda', 'month'] as const).map(v => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                  style={{ padding: '0 12px', border: 'none', cursor: 'pointer', fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', fontWeight: 700, background: view === v ? 'var(--cyan)' : 'transparent', color: view === v ? '#fff' : 'var(--text-4)' }}>
                  {v === 'agenda' ? 'Agenda' : 'Month'}
                </button>
              ))}
            </div>
          }
        >
          {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.8rem' }}>{error}</div>}

          {/* Record bridge — the just-completed commitment can land in the books. */}
          {bridge && (
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--green) 40%, transparent)', background: 'color-mix(in srgb, var(--green) 8%, transparent)' }}>
              <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
                Record “{bridge.title}” — {sym}{fmt(bridge.amount ?? 0)} in your books?
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={bridgeType} onChange={e => setBridgeType(e.target.value as EventType)} style={{ ...input, width: 'auto', minHeight: 36 }} aria-label="Event type">
                  {BRIDGE_OPTIONS.map(t => <option key={t} value={t}>{t === 'SupplierPayment' ? 'Supplier payment' : t === 'CustomerPayment' ? 'Customer payment' : t}</option>)}
                </select>
                <button type="button" onClick={recordBridge} disabled={bridgeBusy}
                  style={{ padding: '8px 16px', minHeight: 36, borderRadius: 8, border: 'none', background: 'var(--green)', color: '#04140d', fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', opacity: bridgeBusy ? 0.7 : 1 }}>
                  {bridgeBusy ? 'Recording…' : 'Record it'}
                </button>
                <button type="button" onClick={() => setBridge(null)} style={{ ...ghostBtn, color: 'var(--text-3)', fontSize: '0.78rem' }}>Not now</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}</div>
          ) : !hasAny ? (
            <div style={{ padding: '20px 8px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', color: 'var(--text-3)', margin: '0 0 14px' }}>
                Nothing scheduled yet. Start with the dates every Zambian business keeps:
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {SEEDS.map(s => (
                  <button key={s.title} type="button" onClick={() => addSeed(s)} className="touch-target"
                    style={{ padding: '8px 14px', minHeight: 38, borderRadius: 8, border: '1px solid var(--border-md)', background: 'var(--bg-badge)', color: 'var(--text-2)', fontFamily: 'Geist, sans-serif', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>
                    {s.title} · {s.day}{s.day === 1 ? 'st' : 'th'}
                  </button>
                ))}
              </div>
              <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-4)', marginTop: 12 }}>
                {pro ? 'One tap — each repeats monthly.' : `One tap adds the next due date. On ${needTier} they repeat monthly on their own.`}
              </p>
            </div>
          ) : view === 'agenda' ? (
            <>
              {group('Overdue', groups.overdue, true)}
              {group('Today', groups.today)}
              {group('Tomorrow', groups.tomorrow)}
              {group('This week', groups.week)}
              {group('Later', groups.later)}
              {groups.finished.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', marginBottom: 2 }}>Recently finished</div>
                  {groups.finished.slice(0, 5).map(([when, it]) => itemRow(when, it, true))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button type="button" aria-label="Previous month" onClick={() => { setSelectedDay(null); setMonthCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1)); }} style={{ ...ghostBtn, color: 'var(--text-2)', fontSize: '1rem', padding: '4px 10px' }}>‹</button>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-1)' }}>
                  {monthCursor.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" aria-label="Next month" onClick={() => { setSelectedDay(null); setMonthCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1)); }} style={{ ...ghostBtn, color: 'var(--text-2)', fontSize: '1rem', padding: '4px 10px' }}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                  <div key={d} style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 0' }}>{d}</div>
                ))}
                {monthDays.map((cell, i) => cell === null ? <div key={`x${i}`} /> : (
                  <button key={cell.key} type="button" onClick={() => setSelectedDay(cell.key === selectedDay ? null : cell.key)}
                    aria-label={`Day ${cell.day}${cell.items.length ? `, ${cell.items.length} item${cell.items.length === 1 ? '' : 's'}` : ''}`}
                    style={{
                      minHeight: 44, borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${cell.key === selectedDay ? 'var(--cyan)' : cell.key === dayKey(new Date()) ? 'var(--border-md)' : 'transparent'}`,
                      background: cell.key === selectedDay ? 'color-mix(in srgb, var(--cyan) 10%, transparent)' : 'transparent',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 2px',
                    }}>
                    <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', fontWeight: cell.key === dayKey(new Date()) ? 800 : 500, color: 'var(--text-2)' }}>{cell.day}</span>
                    <span style={{ display: 'flex', gap: 2 }}>
                      {cell.items.slice(0, 3).map((it, j) => (
                        <span key={j} style={{ width: 5, height: 5, borderRadius: 3, background: KIND_META[it.kind].colour }} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              {selectedDay && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {selDayItems.length === 0
                    ? <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', color: 'var(--text-4)' }}>Nothing on this day.</p>
                    : selDayItems.map(it => itemRow(new Date(it.next_occurrences?.[0] ?? it.starts_at), it, it.status !== 'scheduled'))}
                </div>
              )}
            </>
          )}
        </SectionCard>

        {/* ── Quick add / edit ─────────────────────────────────────────────── */}
        <SectionCard title={editId ? 'Edit item' : 'Quick add'} explainId="schedule.quickadd"
          subtitle={editId ? 'Update the details' : 'Three taps: what, when, add'}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {QUICK_KINDS.map(k => {
              const on = form.kind === k;
              const m = KIND_META[k];
              return (
                <button key={k} type="button" onClick={() => set('kind', k)} aria-pressed={on}
                  style={{
                    padding: '6px 12px', minHeight: 32, borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'Geist, sans-serif', fontSize: '0.72rem', fontWeight: 700,
                    border: `1px solid ${on ? m.colour : 'var(--border-md)'}`,
                    background: on ? `color-mix(in srgb, ${m.colour} 12%, transparent)` : 'transparent',
                    color: on ? m.colour : 'var(--text-3)',
                  }}>
                  {m.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder={form.kind === 'pickup' ? 'Mrs Banda — 2 crates' : form.kind === 'deadline' ? 'ZRA VAT return' : 'What is happening?'} style={input} />
            </div>
            <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={input} /></div>
            <div>
              <label style={lbl}>Time</label>
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)} disabled={form.allDay} style={{ ...input, opacity: form.allDay ? 0.5 : 1 }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="sched-allday" type="checkbox" checked={form.allDay} onChange={e => set('allDay', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--cyan)' }} />
              <label htmlFor="sched-allday" style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.76rem', color: 'var(--text-2)', cursor: 'pointer' }}>All day</label>
              <button type="button" onClick={() => setMoreOpen(o => !o)} style={{ ...ghostBtn, color: 'var(--cyan)', marginLeft: 'auto', fontSize: '0.72rem' }}>
                {moreOpen ? 'Fewer options' : 'More options'}
              </button>
            </div>

            {moreOpen && (
              <>
                <div><label style={lbl}>With whom</label><input value={form.withWhom} onChange={e => set('withWhom', e.target.value)} placeholder="Customer / supplier" style={input} /></div>
                <div><label style={lbl}>Where</label><input value={form.location} onChange={e => set('location', e.target.value)} style={input} /></div>
                <div><label style={lbl}>Amount ({sym})</label><input type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="Powers one-tap recording" style={input} /></div>
                <div>
                  <label style={lbl}>Repeats {pro ? '' : `· ${needTier}`}</label>
                  {pro ? (
                    <select value={form.repeat} onChange={e => set('repeat', e.target.value as RepeatChoice)} style={input}>
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  ) : (
                    <Link href="/pricing" style={{ ...input, display: 'flex', alignItems: 'center', color: 'var(--text-4)', textDecoration: 'none' }}>
                      Repeats monthly &amp; more — upgrade
                    </Link>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} style={input} /></div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={save} disabled={saving} className="touch-target"
              style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--green)', color: '#04140d', fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : editId ? 'Update' : 'Add to schedule'}
            </button>
            {editId && <button type="button" onClick={cancelEdit} className="touch-target" style={{ padding: '10px 20px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', fontFamily: 'Geist, sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
