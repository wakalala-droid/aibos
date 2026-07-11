'use client';
/**
 * Channels — the iCal sync surface (the interim channel manager).
 *
 * Two directions per channel: PULL an OTA's calendar (paste its iCal export URL
 * into "Import URL", then Sync) and PUBLISH ours (copy the feed URL below into the
 * OTA's "import calendar" field). A booking taken anywhere then blocks the dates
 * everywhere — the fix for the audit's conflicting-availability finding without
 * needing full OTA API partnership.
 */
import { useCallback, useEffect, useState } from 'react';
import SectionCard from '@/components/ui/SectionCard';
import {
  listUnits, listChannels, createChannel, updateChannel, deleteChannel,
  syncChannel, icalFeedUrl,
  type Unit, type Channel, type ChannelType, type SyncStatus,
} from '@/lib/hospitality';

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)',
  border: '1px solid var(--border-md)', borderRadius: 6, color: 'var(--text-1)',
  fontSize: 'var(--fs-data)', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', minHeight: 36, borderRadius: 8, border: 'none', background: 'var(--cyan)',
  color: '#fff', fontSize: 'var(--fs-data)', fontWeight: 700, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '7px 12px', minHeight: 34, borderRadius: 8, background: 'transparent',
  border: '1px solid var(--border-md)', color: 'var(--text-3)',
  fontSize: 'var(--fs-data)', fontWeight: 600, cursor: 'pointer',
};

const TYPE_LABEL: Record<ChannelType, string> = {
  direct: 'Direct', booking_com: 'Booking.com', airbnb: 'Airbnb', ical_generic: 'Other (iCal)',
};
const SYNC_META: Record<SyncStatus, { label: string; colour: string }> = {
  ok: { label: 'Synced', colour: 'var(--green)' },
  error: { label: 'Error', colour: 'var(--red)' },
  unconfigured: { label: 'Not set up', colour: 'var(--text-4)' },
};

export default function ChannelsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [channels, setChannels] = useState<Record<string, Channel[]>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const us = await listUnits();
      setUnits(us);
      const entries = await Promise.all(us.map(async u => [u.id, await listChannels(u.id)] as const));
      setChannels(Object.fromEntries(entries));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load channels.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!loading && units.length === 0) {
    return <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Add a unit first — channels attach to a unit.</p>;
  }

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{error}</div>}
      {loading && <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>Loading…</p>}

      {units.map(u => (
        <div key={u.id} style={{ marginBottom: 18 }}>
          <UnitChannels unit={u} channels={channels[u.id] || []} onChange={load} onError={setError} />
        </div>
      ))}
    </>
  );
}

function UnitChannels({ unit, channels, onChange, onError }: { unit: Unit; channels: Channel[]; onChange: () => Promise<void>; onError: (m: string) => void }) {
  const [type, setType] = useState<ChannelType>('booking_com');
  const [importUrl, setImportUrl] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [copied, setCopied] = useState('');

  const add = async () => {
    setBusy('add'); onError('');
    try { await createChannel(unit.id, { channel_type: type, ical_import_url: importUrl.trim() || undefined }); setImportUrl(''); await onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not add channel.'); }
    finally { setBusy(''); }
  };
  const sync = async (id: string) => {
    setBusy(id); onError('');
    try { const r = await syncChannel(id); if (!r.ok && r.status === 'error') onError(r.note); await onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Sync failed.'); }
    finally { setBusy(''); }
  };
  const saveImport = async (c: Channel, url: string) => {
    setBusy(c.id); onError('');
    try { await updateChannel(c.id, { ical_import_url: url.trim() }); await onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(''); }
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this channel? Imported bookings keep their history.')) return;
    setBusy(id); onError('');
    try { await deleteChannel(id); await onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not remove.'); }
    finally { setBusy(''); }
  };
  const copyFeed = (token: string) => {
    const url = icalFeedUrl(token);
    navigator.clipboard?.writeText(url).then(() => { setCopied(token); setTimeout(() => setCopied(''), 1500); });
  };

  return (
    <SectionCard title={unit.unit_name} subtitle="Sync availability with each place this unit is listed.">
      {channels.length === 0 && <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-4)', marginBottom: 12 }}>No channels yet.</p>}

      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        {channels.map(c => {
          const meta = SYNC_META[c.sync_status];
          return (
            <div key={c.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>{TYPE_LABEL[c.channel_type]}</span>
                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 'var(--fs-label)', fontWeight: 700, color: meta.colour, background: `color-mix(in srgb, ${meta.colour} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${meta.colour} 40%, transparent)` }}>{meta.label}</span>
                {c.last_synced_at && <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>last: {new Date(c.last_synced_at).toLocaleString()}</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button style={{ ...primaryBtn, opacity: busy === c.id ? 0.6 : 1 }} disabled={busy === c.id} onClick={() => sync(c.id)}>{busy === c.id ? 'Syncing…' : 'Sync now'}</button>
                  <button style={{ ...ghostBtn, color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)' }} onClick={() => remove(c.id)}>Remove</button>
                </div>
              </div>

              {c.last_sync_note && <p style={{ fontSize: 'var(--fs-label)', color: c.sync_status === 'error' ? 'var(--red)' : 'var(--text-3)', margin: '0 0 10px' }}>{c.last_sync_note}</p>}

              {/* Import URL (pull) */}
              <label style={lbl}>Import URL — paste the OTA’s iCal export link, then Sync</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input style={{ ...input, flex: 1 }} defaultValue={c.ical_import_url || ''} placeholder="https://…/calendar.ics" onBlur={e => { if (e.target.value.trim() !== (c.ical_import_url || '')) saveImport(c, e.target.value); }} />
              </div>

              {/* Export feed (publish) */}
              {c.ical_export_token && (
                <>
                  <label style={lbl}>Our feed URL — paste this into the OTA’s “import calendar” field</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...input, flex: 1, color: 'var(--text-3)' }} readOnly value={icalFeedUrl(c.ical_export_token)} onFocus={e => e.target.select()} />
                    <button style={ghostBtn} onClick={() => copyFeed(c.ical_export_token!)}>{copied === c.ical_export_token ? 'Copied ✓' : 'Copy'}</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add channel */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ minWidth: 140 }}>
          <label style={lbl}>Add channel</label>
          <select style={input} value={type} onChange={e => setType(e.target.value as ChannelType)}>
            {(Object.keys(TYPE_LABEL) as ChannelType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={lbl}>Import URL (optional)</label>
          <input style={input} value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://…/calendar.ics" />
        </div>
        <button style={{ ...primaryBtn, opacity: busy === 'add' ? 0.7 : 1 }} disabled={busy === 'add'} onClick={add}>{busy === 'add' ? 'Adding…' : 'Add channel'}</button>
      </div>
    </SectionCard>
  );
}
