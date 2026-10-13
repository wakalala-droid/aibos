'use client';
/**
 * AIBOS — Timeline (Evolution Initiative 5).
 * The unified operational record of the business: every Business Event, filterable
 * by status and type, with confirm / void (soft-delete, audited). Becomes the
 * primary operational interface for small businesses.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, Search, Plus } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard';
import BigMoney from '@/components/home/BigMoney';
import { openRecordSheet } from '@/lib/recordSheet';
import EventList from '@/components/spine/EventList';
import StartFresh from '@/components/spine/StartFresh';
import TidyUp from '@/components/spine/TidyUp';
import { ALL_TYPES, typeLabel } from '@/components/spine/eventMeta';
import { useStore } from '@/lib/store';
import PageHeader from '@/components/ui/PageHeader';
import PeriodChips from '@/components/ui/PeriodChips';
import { usePeriod, periodRange, inPeriod } from '@/lib/period';
import { undoable } from '@/lib/toast';
import { amountOf, cashSign } from '@/components/spine/eventMeta';
import { sumMoney } from '@/lib/ngwee';
import { fmt } from '@/lib/utils';
import {
  listEvents, confirmEvent, voidEvent,
  type BusinessEvent, type EventStatus, type EventType,
} from '@/lib/api';

/** How many entries one read brings; past this the owner narrows the list. */
const LIMIT = 1000;

function TimelineInner() {
  const params = useSearchParams();
  const refreshTwin = useStore(s => s.refreshTwin);
  const version = useStore(s => s.booksVersion);
  const sym = useStore(s => s.currencySymbol) || 'K';
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Deep-linkable (audit #31): any KPI/chart/driver links here with ?type=&status=
  // so "the events behind this number" is one click from wherever it's shown.
  const initType = params.get('type');
  const initStatus = params.get('status');
  // 'active' (the default) is everything recorded and not removed: confirmed
  // and waiting for the owner. Only confirmed entries count in any figure.
  // Removed records are kept for the audit trail but no longer fill the
  // list; the Removed chip shows them.
  const [status, setStatus] = useState<EventStatus | 'all' | 'active'>(
    (['confirmed', 'pending', 'void', 'all'] as string[]).includes(initStatus ?? '') ? (initStatus as EventStatus | 'all') : 'active');
  const [type, setType] = useState<EventType | 'all'>(
    (ALL_TYPES as string[]).includes(initType ?? '') ? (initType as EventType) : 'all');

  // Free-text search across the record (audit #38): matches customer, supplier,
  // category, note, item, amount and type — "fuel", "chanda", "450".
  // ?q= arrives from links like "Where your money went" (Fuel, Rent...).
  const [q, setQ] = useState(params.get('q') ?? '');
  const [period, setPeriod] = usePeriod('all');
  // ?ids= arrives from an AI answer's "Open the entries it used" (C7, C8).
  const idsParam = params.get('ids') ?? '';
  const onlyIds = useMemo(() => new Set(idsParam.split(',').filter(Boolean)), [idsParam]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const range = periodRange(period);
    const inView = (status === 'active' ? events.filter((e) => e.status !== 'void') : events)
      .filter((e) => inPeriod(e.occurred_at, range))
      .filter((e) => !onlyIds.size || onlyIds.has(e.id));
    if (!needle) return inView;
    return inView.filter((e) => {
      const p = e.payload ?? {};
      const hay = [e.event_type, p.customer, p.supplier, p.category, p.note, p.item,
                   ...(Array.isArray(p.items) ? (p.items as unknown[]) : []), p.amount]
        .map((v) => String(v ?? '')).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [events, q, status, period, onlyIds]);

  // Money in and out across what is on screen, the way a bank sums a statement.
  // Confirmed entries only, to the ngwee, like the money figure: entries that
  // wait for the owner are added up apart and said so. They used to be in
  // these totals although no figure anywhere counts them.
  const totals = useMemo(() => {
    const ins: number[] = [], outs: number[] = [], waitIn: number[] = [], waitOut: number[] = [];
    let waiting = 0;
    for (const e of shown) {
      if (e.status === 'void') continue;
      const sign = cashSign(e);
      if (e.status === 'pending') {
        if (sign) waiting += 1;
        if (sign > 0) waitIn.push(amountOf(e)); else if (sign < 0) waitOut.push(amountOf(e));
        continue;
      }
      if (sign > 0) ins.push(amountOf(e)); else if (sign < 0) outs.push(amountOf(e));
    }
    return { moneyIn: sumMoney(ins), moneyOut: sumMoney(outs), waiting,
             waitingIn: sumMoney(waitIn), waitingOut: sumMoney(waitOut) };
  }, [shown]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setEvents(await listEvents({
        status: status === 'all' || status === 'active' ? undefined : status,
        event_type: type === 'all' ? undefined : type,
        limit: LIMIT,
      }));
    } catch (e) {
      setError((e as Error).message || 'Could not load the timeline.');
    } finally {
      setLoading(false);
    }
  }, [status, type]);

  // Read again whenever the books change anywhere (a fix on the Money page,
  // a payment that arrived, another tab).
  useEffect(() => { load(); }, [load, version]);

  async function handleConfirm(id: string) {
    setBusyId(id);
    try { await confirmEvent(id); await load(); refreshTwin(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  // Remove with Undo (UI/UX audit 2026-10 C2): the row goes at once and the
  // removal is sent after 5 seconds unless the owner taps Undo. A removed entry
  // stays listed under "Removed" and leaves your figures.
  function handleVoid(id: string) {
    setEvents((xs) => xs.filter((x) => x.id !== id));
    undoable({
      message: 'Entry removed from your figures',
      run: () => voidEvent(id),
      onUndo: () => { void load(); },
      onDone: () => { void load(); refreshTwin(); },
      onError: (e) => { setError(e.message); void load(); },
    });
  }

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Every record in your books, newest first."
        actions={
          <>
            <button type="button" onClick={load} className="icon-pill" aria-label="Refresh the list" title="Refresh"><RefreshCw aria-hidden="true" /></button>
            <button type="button" className="pill pill-primary" onClick={openRecordSheet}><Plus aria-hidden="true" />Record</button>
          </>
        }
      />

      <SectionCard
        title={loading ? 'Loading…' : q.trim() ? `${shown.length} match “${q.trim()}”` : `${shown.length} record${shown.length === 1 ? '' : 's'}`}
      >
        {!loading && shown.length > 0 && (
          <div className="mini-stats" style={{ marginBottom: 16 }}>
            <div className="mini-stat">
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Money in</span>
              <BigMoney value={totals.moneyIn} sym={sym} size="md" tone="in" />
            </div>
            <div className="mini-stat">
              <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>Money out</span>
              <BigMoney value={totals.moneyOut} sym={sym} size="md" tone="out" />
            </div>
          </div>
        )}
        {!loading && totals.waiting > 0 && status !== 'pending' && (
          <p style={{ margin: '-4px 0 16px', fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
            {totals.waiting} {totals.waiting === 1 ? 'entry here waits' : 'entries here wait'} for you
            ({fmt(totals.waitingIn, false, sym)} in, {fmt(totals.waitingOut, false, sym)} out) and {totals.waiting === 1 ? 'is' : 'are'} not
            in these totals or your money figure until you confirm {totals.waiting === 1 ? 'it' : 'them'}.{' '}
            <button type="button" className="tap-link" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--cyan)', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit' }}
              onClick={() => setStatus('pending')}>
              Show them
            </button>
          </p>
        )}
        {!loading && status === 'pending' && totals.waiting > 0 && (
          <p style={{ margin: '-4px 0 16px', fontSize: 'var(--fs-label)', color: 'var(--text-3)', lineHeight: 1.5 }}>
            Waiting for you: {fmt(totals.waitingIn, false, sym)} in and {fmt(totals.waitingOut, false, sym)} out, in no figure until you confirm each.
          </p>
        )}
        {!loading && events.length >= LIMIT && (
          <p style={{ margin: '-4px 0 16px', fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
            Showing the newest {LIMIT}. Pick a type or a status to see older ones.
          </p>
        )}

        {/* Search (audit #38) */}
        <label style={{ position: 'relative', display: 'block', marginBottom: 12 }}>
          <span className="sr-only">Search your records</span>
          <Search aria-hidden="true" style={{ position: 'absolute', left: 14, top: 13, width: 18, height: 18, color: 'var(--text-4)' }} />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search, like fuel, Chanda or 450"
            className="field" style={{ paddingLeft: 42, borderRadius: 999 }}
          />
        </label>

        {onlyIds.size > 0 && (
          <p role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: '0 0 12px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--cyan-dim)', fontSize: 'var(--fs-body)', color: 'var(--text-1)' }}>
            Showing the {onlyIds.size} {onlyIds.size === 1 ? 'entry' : 'entries'} an answer used. Fix any that are wrong.
            <a href="/dashboard/timeline" className="tap-link" style={{ color: 'var(--cyan)', fontWeight: 600 }}>Show everything</a>
          </p>
        )}

        {/* When (C6): one tap for the usual windows, kept in the address. */}
        <div style={{ marginBottom: 8 }}>
          <PeriodChips value={period} onChange={setPeriod} label="When" />
        </div>

        {/* Filters */}
        <div className="chips" role="group" aria-label="Which records" style={{ marginBottom: 12 }}>
          {(['active', 'confirmed', 'pending', 'void', 'all'] as const).map(s => (
            <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === 'active' ? 'Recorded' : s === 'all' ? 'Everything' : s === 'void' ? 'Removed' : s === 'pending' ? 'Waiting for you' : 'Confirmed'}
            </button>
          ))}
        </div>
        {/* One picker instead of 16 chips: at 18px the chips filled a phone
            screen before the first record (UI/UX audit 2026-10 Part E). */}
        <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as EventType | 'all')}
            className="field" style={{ flex: 1, minWidth: 200, maxWidth: 360, width: 'auto' }}>
            <option value="all">All types</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
        </label>

        {error && (
          <div role="alert" style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--red-dim)', color: 'var(--red)', fontSize: 'var(--fs-body)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        ) : (
          <EventList
            events={shown}
            busyId={busyId}
            onConfirm={handleConfirm}
            onVoid={handleVoid}
            onChanged={() => { void load(); refreshTwin(); }}
            emptyHint="No events match these filters. Record activity to get started."
          />
        )}
      </SectionCard>

      <TidyUp onDone={() => { void load(); refreshTwin(); }} />

      <StartFresh onDone={load} />
    </>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <TimelineInner />
    </Suspense>
  );
}
