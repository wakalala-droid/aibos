'use client';
/**
 * AIBOS — Schedule (the Scheduler).
 * Meetings, pick-ups, deliveries, deadlines, payments due — the owner's week in
 * one agenda. A schedule item is a commitment, not a business fact: completing a
 * pick-up or payment offers the record bridge, one tap creating the matching
 * Business Event so the commitment lands in the books.
 *
 * Agenda is the primary view (mobile-first — month grids are desktop thinking);
 * the month grid is secondary. Recurrence + reminders are the Pro layer; core
 * scheduling is free, like recording.
 *
 * Reminders go out from the API (schedule_reminders.py) to the bell, an
 * on-screen card and every phone and computer with notifications on, or by
 * email when none of those got it. "Remind me" sets when; the panel under the form
 * says where, so an owner can see their phone is set up before relying on it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { undoable } from '@/lib/toast';
import Link from 'next/link';
import { Bell, Users, Package, Truck, Landmark, CalendarClock, Check, Pencil, Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import PhoneAlerts from '@/components/pwa/PhoneAlerts';
import { playReminderSound, setSoundOn, soundOn } from '@/lib/sound';
import { fmt } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { logUsage } from '@/lib/usage';
import { canAccess, requiredTier, TIERS } from '@/lib/tiers';
import PageHeader from '@/components/ui/PageHeader';
import {
  listSchedule, createScheduleItem, updateScheduleItem, setScheduleStatus,
  deleteScheduleItem, createEvent, seedStatutorySchedule, getPushDevices,
  type ScheduleItem, type ScheduleKind, type PushDevice,
  type Recurrence, type EventType,
} from '@/lib/api';

// ── Kind vocabulary (colour = meaning, per visual_language_system) ──────────
const KIND_META: Record<ScheduleKind, { label: string; colour: string }> = {
  meeting:    { label: 'Meeting',  colour: 'var(--cyan)'   },
  pickup:     { label: 'Pick-up',  colour: 'var(--green)'  },
  delivery:   { label: 'Delivery', colour: 'var(--e2)'     },
  deadline:   { label: 'Deadline', colour: 'var(--red)'    },
  payment_due: { label: 'Payment',  colour: 'var(--amber)'  },
  reminder:   { label: 'Reminder', colour: 'var(--text-3)' },
  other:      { label: 'Other',    colour: 'var(--text-3)' },
};
const KIND_ICON: Record<ScheduleKind, React.ReactNode> = {
  meeting: <Users />, pickup: <Package />, delivery: <Truck />, deadline: <Landmark />,
  payment_due: <Landmark />, reminder: <Bell />, other: <CalendarClock />,
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
  daily:   { freq: 'daily',   interval: 1 },
  weekly:  { freq: 'weekly',  interval: 1 },
  biweekly: { freq: 'weekly',  interval: 2 },
  monthly: { freq: 'monthly', interval: 1 },
};

// Reminders: minutes before the item. Unset on the server means at the time,
// -1 means none (aibos-api schedule_items.REMIND_OFF). An all-day item stands
// at 09:00, so its choices are days, not minutes.
const REMIND_OFF = -1;
const TIMED_REMINDERS: Array<[number, string]> = [
  [0, 'At the time'], [15, '15 minutes before'], [30, '30 minutes before'],
  [60, '1 hour before'], [1440, '1 day before'], [REMIND_OFF, 'No reminder'],
];
const ALL_DAY_REMINDERS: Array<[number, string]> = [
  [0, 'On the day, at 09:00'], [1440, 'The day before, at 09:00'],
  [10080, 'A week before'], [REMIND_OFF, 'No reminder'],
];
// What each kind usually wants: a meeting needs time to get there, a deadline
// needs a day to prepare, a plain reminder is for the moment itself.
const DEFAULT_REMIND: Record<ScheduleKind, number> = {
  meeting: 30, pickup: 30, delivery: 30, deadline: 1440, payment_due: 1440, reminder: 0, other: 0,
};
function remindChoices(allDay: boolean) { return allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS; }
/** Keep a reminder that still makes sense after All day is switched. */
function fitRemind(minutes: number, allDay: boolean): number {
  if (remindChoices(allDay).some(([m]) => m === minutes)) return minutes;
  return minutes >= 1440 ? 1440 : 0;
}
/** "30 min before" for the agenda line; null when the item has no reminder. */
function remindShort(it: ScheduleItem): string | null {
  const m = it.remind_minutes_before ?? 0;
  if (m < 0) return null;
  if (m === 0) return it.all_day ? 'on the day, 09:00' : 'at the time';
  if (m === 10080) return 'a week before';
  if (m % 1440 === 0) return m === 1440 ? 'a day before' : `${m / 1440} days before`;
  if (m % 60 === 0) return m === 60 ? '1 hour before' : `${m / 60} hours before`;
  return `${m} min before`;
}

/** "Chrome on an Android phone and Edge on a Windows computer". */
function deviceList(devices: PushDevice[]): string {
  const names = Array.from(new Set(devices.map(d => (d.device === 'A browser' ? 'a browser' : d.device))));
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
const isPhone = (d: PushDevice) => /phone|iphone|ipad/i.test(d.device);

interface FormState {
  kind: ScheduleKind; title: string; date: string; time: string; allDay: boolean;
  withWhom: string; location: string; amount: string; notes: string; repeat: RepeatChoice;
  /** Minutes before; REMIND_OFF for none. */
  remind: number;
  /** Chosen by hand, so picking a kind no longer changes it. */
  remindTouched: boolean;
}
// The owner's own calendar day. toISOString() is UTC, which is still yesterday
// between midnight and 2am in Lusaka.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const EMPTY: FormState = {
  kind: 'meeting', title: '', date: todayISO(), time: '09:00', allDay: false,
  withWhom: '', location: '', amount: '', notes: '', repeat: 'none',
  remind: DEFAULT_REMIND.meeting, remindTouched: false,
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

// A locked choice reads like a field, so the form keeps its shape on Free.
const lockedField: React.CSSProperties = { display: 'flex', alignItems: 'center', color: 'var(--text-3)', textDecoration: 'none' };

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
  const [statutoryBusy, setStatutoryBusy] = useState(false);
  // Where reminders will arrive: this person's phones and computers with
  // notifications on. null while unknown, so nothing says "no phone" too early.
  const [devices, setDevices] = useState<PushDevice[] | null>(null);
  const loadDevices = useCallback(async () => {
    try { setDevices(await getPushDevices()); } catch { setDevices(null); }
  }, []);
  useEffect(() => { if (pro) void loadDevices(); }, [pro, loadDevices]);
  // The sound a reminder makes here. Read after mount: the setting lives on
  // this device, and the server render cannot see it.
  const [sound, setSound] = useState(true);
  useEffect(() => { setSound(soundOn()); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    // Full-year horizon so the month grid stays truthful when browsing ahead.
    try { setItems(await listSchedule(366)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function seedStatutory() {
    setStatutoryBusy(true); setError(null);
    try { await seedStatutorySchedule(); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setStatutoryBusy(false); }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(p => ({ ...p, [k]: v }));
  // Picking a kind brings its usual reminder, until the owner picks one by hand.
  const pickKind = (k: ScheduleKind) => setForm(p => ({
    ...p, kind: k, remind: p.remindTouched ? p.remind : fitRemind(DEFAULT_REMIND[k], p.allDay),
  }));
  const setAllDay = (allDay: boolean) => setForm(p => ({ ...p, allDay, remind: fitRemind(p.remind, allDay) }));

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
      // Unset on the server means at the time.
      remind: fitRemind(it.remind_minutes_before ?? 0, it.all_day), remindTouched: true,
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
        ...(pro ? {
          recurrence: form.repeat === 'none' ? null : REPEAT_RULES[form.repeat],
          remind_minutes_before: form.remind,
        } : {}),
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
      // For recurring items the backend returns the materialised occurrence,
      // not the template — the record bridge must link the event to THAT row.
      const resolved = await setScheduleStatus(it.id, 'done');
      if (BRIDGE_TYPES[resolved.kind] && (resolved.amount ?? 0) > 0) {
        setBridge(resolved); setBridgeType(BRIDGE_TYPES[resolved.kind]!);
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
      logUsage('event_recorded', { meta: { event_type: bridgeType, via: 'schedule_bridge' } });
      await updateScheduleItem(bridge.id, { linked_event_id: ev.id });
      setBridge(null); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBridgeBusy(false); }
  }

  async function remove(id: string) {
    const it = items.find((x) => x.id === id);
    if (editId === id) cancelEdit();
    setItems((xs) => xs.filter((x) => x.id !== id));
    undoable({
      message: it?.recurrence ? 'Removed, with its repeats' : 'Removed from your schedule',
      run: () => deleteScheduleItem(id),
      onUndo: () => { void load(); },
      onDone: () => { void load(); },
      onError: (e) => { setError(e.message); void load(); },
    });
  }

  async function addSeed(seed: { title: string; kind: ScheduleKind; day: number }) {
    setError(null);
    try {
      await createScheduleItem({
        title: seed.title, kind: seed.kind, all_day: true,
        starts_at: nextMonthly(seed.day).toISOString(),
        // Free gets the next due date; Pro makes it repeat every month and
        // reminds the day before, like a deadline made by hand.
        ...(pro ? { recurrence: { freq: 'monthly', interval: 1 }, remind_minutes_before: DEFAULT_REMIND[seed.kind] } : {}),
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

  const kindMark = (kind: ScheduleKind) => {
    const m = KIND_META[kind];
    return (
      <span className="avatar" aria-hidden="true" style={{ background: `color-mix(in srgb, ${m.colour} 12%, transparent)`, color: m.colour }}>
        {KIND_ICON[kind]}
      </span>
    );
  };

  const itemRow = (when: Date, it: ScheduleItem, finished = false) => (
    <div key={`${it.id}-${when.getTime()}`} className="row" style={{ flexWrap: 'wrap', opacity: finished ? 0.55 : 1 }}>
      {kindMark(it.kind)}
      <div className="row-main" style={{ minWidth: 160 }}>
        <div className="row-title" style={{ textDecoration: finished ? 'line-through' : 'none' }}>
          {it.title}
        </div>
        <div className="row-sub" style={{ whiteSpace: 'normal' }}>
          {KIND_META[it.kind].label} · {fmtDay(when)}{it.all_day ? '' : ` · ${fmtTime(when)}`}
          {it.with_whom ? ` · ${it.with_whom}` : ''}{it.location ? ` · ${it.location}` : ''}
          {/* When its reminder goes out. Only on plans that send them. */}
          {pro && !finished && it.status === 'scheduled' && remindShort(it) && (
            <span style={{ whiteSpace: 'nowrap' }}>
              {' · '}<Bell size={12} strokeWidth={2} aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-1px' }} />
              <span className="sr-only">Reminder</span> {remindShort(it)}
            </span>
          )}
          {/* Only dates still ahead. An overdue monthly deadline listed
              "next 10 Aug, 10 Sept" when both had already gone by. */}
          {(() => {
            const ahead = (it.recurrence && it.next_occurrences ? it.next_occurrences.slice(1) : [])
              .filter(o => new Date(o).getTime() > Date.now()).slice(0, 2);
            return ahead.length > 0 && (
              <span> · ↻ next {ahead.map(o => new Date(o).toLocaleDateString([], { day: 'numeric', month: 'short' })).join(', ')}</span>
            );
          })()}
          {finished && ` · ${it.status === 'done' ? 'done' : 'missed'}`}
          {it.linked_event_id && ' · recorded in your books'}
        </div>
      </div>
      {(it.amount ?? 0) > 0 && <span className="row-amount">{fmt(it.amount!, false, sym)}</span>}
      <span className="row-actions">
        {!finished && (
          <button type="button" onClick={() => markDone(it)} className="pill" aria-label={`Mark ${it.title} done`} style={{ color: 'var(--green)' }}>
            <Check aria-hidden="true" />Done
          </button>
        )}
        {!finished && <button type="button" className="icon-pill" onClick={() => edit(it)} aria-label={`Change ${it.title}`}><Pencil aria-hidden="true" /></button>}
        <button type="button" className="icon-pill danger" onClick={() => remove(it.id)} aria-label={`Remove ${it.title}`}><Trash2 aria-hidden="true" /></button>
      </span>
    </div>
  );

  const group = (label: string, entries: Array<[Date, ScheduleItem]>, warn = false) =>
    entries.length === 0 ? null : (
      <div key={label} style={{ marginBottom: 8 }}>
        <p className="day-label" style={warn ? { color: 'var(--red)' } : undefined}>
          {label}
        </p>
        {entries.map(([when, it]) => itemRow(when, it))}
      </div>
    );

  const hasAny = items.length > 0;
  const selDayItems = selectedDay ? (monthDays.find(c => c?.key === selectedDay)?.items ?? []) : [];

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Meetings, pick-ups and deadlines: your week, one glance."
        actions={
          <button type="button" className="pill pill-primary"
            onClick={() => { cancelEdit(); document.getElementById('sched-title')?.focus(); }}>
            <Plus aria-hidden="true" />Add to schedule
          </button>
        }
      />

      {/* Statutory autopilot (audit #25): one tap seeds recurring PAYE/NAPSA/
          NHIMA reminders, amounts from the latest payroll run. Hidden once
          all three exist. */}
      {pro && !loading && !items.some(i => i.title === 'NAPSA contribution') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '16px 24px', marginBottom: 16, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 320px' }}>
            <span className="avatar avatar-brand" aria-hidden="true"><Landmark /></span>
            <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
              <strong style={{ color: 'var(--text-1)' }}>Never miss ZRA, NAPSA or NHIMA again.</strong> Reminders on the 10th of every month, with amounts from your last payroll.
            </span>
          </span>
          <button type="button" className="pill" disabled={statutoryBusy} onClick={() => void seedStatutory()}>
            {statutoryBusy ? 'Setting up…' : 'Set them up'}
          </button>
        </div>
      )}

      <div className="grid-main">
        <SectionCard
          title="Coming up" explainId="schedule.agenda"
          subtitle={loading ? 'Loading…' : `${items.filter(i => i.status === 'scheduled').length} scheduled`}
          action={
            <div role="group" aria-label="Schedule view" className="seg">
              {(['agenda', 'month'] as const).map(v => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}>
                  {v === 'agenda' ? 'List' : 'Month'}
                </button>
              ))}
            </div>
          }
        >
          {error && <div role="alert" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>{error}</div>}

          {/* Record bridge — the just-completed commitment can land in the books. */}
          {bridge && (
            <div style={{ marginBottom: 16, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--green-dim)' }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)', marginBottom: 12 }}>
                Record “{bridge.title}”: {fmt(bridge.amount ?? 0, false, sym)} in your books?
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={bridgeType} onChange={e => setBridgeType(e.target.value as EventType)} className="field" style={{ width: 'auto' }} aria-label="Record it as">
                  {BRIDGE_OPTIONS.map(t => <option key={t} value={t}>{t === 'SupplierPayment' ? 'Supplier payment' : t === 'CustomerPayment' ? 'Customer payment' : t}</option>)}
                </select>
                <button type="button" onClick={recordBridge} disabled={bridgeBusy} className="pill pill-primary">
                  {bridgeBusy ? 'Recording…' : 'Record it'}
                </button>
                <button type="button" onClick={() => setBridge(null)} className="pill pill-quiet">Not now</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}</div>
          ) : !hasAny ? (
            <div style={{ padding: '8px 0' }}>
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', margin: '0 0 16px' }}>
                Nothing scheduled yet. Start with the dates every Zambian business keeps:
              </p>
              <div className="chips">
                {SEEDS.map(s => (
                  <button key={s.title} type="button" onClick={() => addSeed(s)} className="chip">
                    <Plus aria-hidden="true" style={{ width: 18, height: 18 }} />{s.title} · {s.day}{s.day === 1 ? 'st' : 'th'}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginTop: 12 }}>
                {pro ? 'One tap: each repeats monthly.' : `One tap adds the next due date. On ${needTier} they repeat monthly on their own.`}
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
                  <p className="day-label">Recently finished</p>
                  {groups.finished.slice(0, 5).map(([when, it]) => itemRow(when, it, true))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button type="button" className="icon-pill" aria-label="Previous month" onClick={() => { setSelectedDay(null); setMonthCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1)); }}><ChevronLeft aria-hidden="true" /></button>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-1)' }}>
                  {monthCursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" className="icon-pill" aria-label="Next month" onClick={() => { setSelectedDay(null); setMonthCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1)); }}><ChevronRight aria-hidden="true" /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                  <div key={d} style={{ fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--text-3)', textAlign: 'center', padding: '4px 0' }}>{d}</div>
                ))}
                {monthDays.map((cell, i) => cell === null ? <div key={`x${i}`} /> : (
                  <button key={cell.key} type="button" onClick={() => setSelectedDay(cell.key === selectedDay ? null : cell.key)}
                    aria-label={`Day ${cell.day}${cell.items.length ? `, ${cell.items.length} item${cell.items.length === 1 ? '' : 's'}` : ''}`}
                    aria-pressed={cell.key === selectedDay}
                    style={{
                      minHeight: 52, borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      border: `1px solid ${cell.key === dayKey(new Date()) && cell.key !== selectedDay ? 'var(--border-strong)' : 'transparent'}`,
                      background: cell.key === selectedDay ? 'var(--text-1)' : cell.items.length ? 'var(--pill-bg)' : 'transparent',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 2px',
                      fontFamily: 'inherit',
                    }}>
                    <span style={{ fontSize: 'var(--fs-label)', fontWeight: cell.key === dayKey(new Date()) ? 700 : 500, color: cell.key === selectedDay ? 'var(--bg-card)' : 'var(--text-1)' }}>{cell.day}</span>
                    <span style={{ display: 'flex', gap: 3 }}>
                      {cell.items.slice(0, 3).map((it, j) => (
                        <span key={j} style={{ width: 6, height: 6, borderRadius: 3, background: cell.key === selectedDay ? 'var(--bg-card)' : KIND_META[it.kind].colour }} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              {selectedDay && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {selDayItems.length === 0
                    ? <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Nothing on this day.</p>
                    : selDayItems.map(it => itemRow(new Date(it.next_occurrences?.[0] ?? it.starts_at), it, it.status !== 'scheduled'))}
                </div>
              )}
            </>
          )}
        </SectionCard>

        {/* ── Quick add / edit ─────────────────────────────────────────────── */}
        <SectionCard title={editId ? 'Change this' : 'Add to your schedule'} explainId="schedule.quickadd"
          subtitle={editId ? undefined : 'What, when, add.'}>
          <div className="chips" role="group" aria-label="What kind" style={{ marginBottom: 16 }}>
            {QUICK_KINDS.map(k => (
              <button key={k} type="button" className="chip" onClick={() => pickKind(k)} aria-pressed={form.kind === k}>
                {KIND_META[k].label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="sched-title" className="field-label">What</label>
              <input id="sched-title" value={form.title} onChange={e => set('title', e.target.value)} placeholder={form.kind === 'pickup' ? 'Mrs Banda, 2 crates' : form.kind === 'deadline' ? 'ZRA VAT return' : 'What is happening?'} className="field" />
            </div>
            <div><label htmlFor="sched-date" className="field-label">Date</label><input id="sched-date" type="date" value={form.date} onChange={e => set('date', e.target.value)} className="field" /></div>
            <div>
              <label htmlFor="sched-time" className="field-label">Time</label>
              <input id="sched-time" type="time" value={form.time} onChange={e => set('time', e.target.value)} disabled={form.allDay} className="field" style={{ opacity: form.allDay ? 0.5 : 1 }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="sched-allday" type="checkbox" checked={form.allDay} onChange={e => setAllDay(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
              <label htmlFor="sched-allday" style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', cursor: 'pointer' }}>All day</label>
              <button type="button" className="pill pill-quiet" aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)} style={{ marginLeft: 'auto' }}>
                {moreOpen ? 'Fewer options' : 'More options'}
              </button>
            </div>

            {/* When the reminder goes out. In the main form, not under More
                options: a reminder nobody knew they could set never arrives. */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="sched-remind" className="field-label">Remind me {pro ? '' : `· ${needTier}`}</label>
              {pro ? (
                <select id="sched-remind" value={form.remind}
                  onChange={e => setForm(p => ({ ...p, remind: Number(e.target.value), remindTouched: true }))}
                  className="field">
                  {remindChoices(form.allDay).map(([m, label]) => <option key={m} value={m}>{label}</option>)}
                </select>
              ) : (
                <Link href="/pricing" className="field" style={lockedField}>
                  Reminders on your phone come with {needTier}. See plans
                </Link>
              )}
            </div>

            {moreOpen && (
              <>
                <div><label className="field-label">With whom</label><input value={form.withWhom} onChange={e => set('withWhom', e.target.value)} placeholder="Customer / supplier" className="field" /></div>
                <div><label className="field-label">Where</label><input value={form.location} onChange={e => set('location', e.target.value)} className="field" /></div>
                <div><label className="field-label">Amount ({sym})</label><input type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="Powers one-tap recording" className="field" /></div>
                <div>
                  <label className="field-label">Repeats {pro ? '' : `· ${needTier}`}</label>
                  {pro ? (
                    <select value={form.repeat} onChange={e => set('repeat', e.target.value as RepeatChoice)} className="field">
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  ) : (
                    <Link href="/pricing" className="field" style={lockedField}>
                      Repeats monthly and more: upgrade
                    </Link>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className="field" /></div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={save} disabled={saving} className="pill pill-primary">
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Add to schedule'}
            </button>
            {editId && <button type="button" onClick={cancelEdit} className="pill pill-quiet">Cancel</button>}
          </div>

          {/* Where reminders arrive, so an owner knows before relying on it
              whether their phone is one of the places. */}
          {pro && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <h3 className="panel-title" style={{ marginBottom: 8 }}>
                Where your reminders arrive
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-3)' }}>
                In the bell and on screen while AIBOS is open.
                {devices && devices.length > 0 && ` Also as a notification on ${deviceList(devices)}.`}
                {devices && devices.length === 0 && ' No phone or computer has notifications on yet, so each reminder is emailed to you as well.'}
                {devices && !devices.some(isPhone) && ' To get them on your phone, open AIBOS on the phone, tap the bell, then tap Turn on.'}
              </p>
              <PhoneAlerts embedded onChange={() => void loadDevices()} />
              <label htmlFor="sched-sound" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-2)', cursor: 'pointer' }}>
                <input id="sched-sound" type="checkbox" checked={sound}
                  onChange={e => { const on = e.target.checked; setSound(on); setSoundOn(on); if (on) void playReminderSound(true); }}
                  style={{ width: 22, height: 22, accentColor: 'var(--cyan)' }} />
                Play a sound when a notification arrives
              </label>
              <p style={{ margin: '4px 0 0 30px', fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--text-3)' }}>
                AIBOS plays it itself wherever it is open, the installed app included and keeps the
                notification quiet so you hear it once. With AIBOS closed your phone uses its own sound.
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
