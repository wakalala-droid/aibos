'use client';
/**
 * AI-BOS — Timeline (Evolution Initiative 5).
 * The unified operational record of the business: every Business Event, filterable
 * by status and type, with confirm / void (soft-delete, audited). Becomes the
 * primary operational interface for small businesses.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SectionCard from '@/components/ui/SectionCard';
import EventList from '@/components/spine/EventList';
import StartFresh from '@/components/spine/StartFresh';
import { ALL_TYPES } from '@/components/spine/eventMeta';
import { useStore } from '@/lib/store';
import PageHeader from '@/components/ui/PageHeader';
import {
  listEvents, confirmEvent, voidEvent,
  type BusinessEvent, type EventStatus, type EventType,
} from '@/lib/api';

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', minHeight: 32, borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-md)'}`,
  background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
  color: active ? 'var(--cyan)' : 'var(--text-3)',
  fontSize: 'var(--fs-label)', fontWeight: 600,
});

function TimelineInner() {
  const params = useSearchParams();
  const refreshTwin = useStore(s => s.refreshTwin);
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Deep-linkable (audit #31): any KPI/chart/driver links here with ?type=&status=
  // so "the events behind this number" is one click from wherever it's shown.
  const initType = params.get('type');
  const initStatus = params.get('status');
  const [status, setStatus] = useState<EventStatus | 'all'>(
    (['confirmed', 'pending', 'void'] as string[]).includes(initStatus ?? '') ? (initStatus as EventStatus) : 'all');
  const [type, setType] = useState<EventType | 'all'>(
    (ALL_TYPES as string[]).includes(initType ?? '') ? (initType as EventType) : 'all');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setEvents(await listEvents({
        status: status === 'all' ? undefined : status,
        event_type: type === 'all' ? undefined : type,
        limit: 500,
      }));
    } catch (e) {
      setError((e as Error).message || 'Could not load the timeline.');
    } finally {
      setLoading(false);
    }
  }, [status, type]);

  useEffect(() => { load(); }, [load]);

  async function handleConfirm(id: string) {
    setBusyId(id);
    try { await confirmEvent(id); await load(); refreshTwin(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function handleVoid(id: string) {
    setBusyId(id);
    try { await voidEvent(id); await load(); refreshTwin(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  return (
    <>
      <PageHeader
        title="Timeline"
        subtitle="Every recorded business event — one unified record."
      />

      <SectionCard
        title="Activity"
        subtitle={loading ? 'Loading…' : `${events.length} event${events.length === 1 ? '' : 's'}`}
        action={
          <button type="button" onClick={load} className="touch-target"
            style={{ padding: '6px 12px', minHeight: 32, borderRadius: 6, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)', fontSize: 'var(--fs-label)', fontWeight: 600, cursor: 'pointer' }}>
            Refresh
          </button>
        }
      >
        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(['all', 'confirmed', 'pending', 'void'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)} style={chip(status === s)}>
              {s === 'all' ? 'All status' : s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          <button type="button" onClick={() => setType('all')} style={chip(type === 'all')}>All types</button>
          {ALL_TYPES.map(t => (
            <button key={t} type="button" onClick={() => setType(t)} style={chip(type === t)}>{t}</button>
          ))}
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        ) : (
          <EventList
            events={events}
            busyId={busyId}
            onConfirm={handleConfirm}
            onVoid={handleVoid}
            emptyHint="No events match these filters. Record activity to get started."
          />
        )}
      </SectionCard>

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
