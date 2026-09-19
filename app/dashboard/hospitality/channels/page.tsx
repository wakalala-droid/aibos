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
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { slugFrom } from '@/lib/slug';
import {
  listUnits, listChannels, createChannel, updateChannel, deleteChannel,
  syncChannel, icalFeedUrl,
  listProperties, mintSiteToken, clearSiteToken, publicSiteBase,
  updateProperty, getGuestEmailStatus, sendGuestEmailSamples,
  type Unit, type Channel, type ChannelType, type SyncStatus, type Property, type GuestEmailStatus,
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
  const [properties, setProperties] = useState<Property[]>([]);
  const [channels, setChannels] = useState<Record<string, Channel[]>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const [us, props] = await Promise.all([listUnits(), listProperties()]);
      setUnits(us);
      setProperties(props);
      const entries = await Promise.all(us.map(async u => [u.id, await listChannels(u.id)] as const));
      setChannels(Object.fromEntries(entries));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load channels.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const noUnits = !loading && units.length === 0;

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 'var(--fs-data)' }}>{error}</div>}
      {loading && <p style={{ fontSize: 'var(--fs-data)', color: 'var(--text-3)' }}>Loading…</p>}
      {noUnits && <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)' }}>Add a unit first — channels attach to a unit.</p>}

      <WebsiteCard properties={properties} units={units} onChange={load} onError={setError} />
      <GuestEmailsCard properties={properties} onChange={load} onError={setError} />

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

/**
 * Your own website — the direct-booking channel.
 *
 * Every other channel here is somebody else's shopfront taking a commission.
 * This one is the property's own site, and it works the same way the iCal feed
 * does: an unguessable token IS the key. Paste the two settings below into the
 * site, and it can read live availability and send booking requests straight
 * into this calendar. Rotate the token and the site is cut off at once.
 *
 * A request from the site arrives as PENDING, which holds the dates without
 * booking any money. Confirming it here is what puts the stay in the books.
 */
function WebsiteCard({ properties, units, onChange, onError }: {
  properties: Property[]; units: Unit[];
  onChange: () => Promise<void>; onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const apiBase = publicSiteBase();

  const copy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    });
  };

  const mint = async (p: Property) => {
    setBusy(p.id); onError('');
    try { await mintSiteToken(p.id); await onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not connect the website.'); }
    finally { setBusy(''); }
  };

  const rotate = async (p: Property) => {
    if (!confirm('Make a new key? Your website stops working until you paste the new one in.')) return;
    await mint(p);
  };

  const disconnect = async (p: Property) => {
    if (!confirm('Take the website offline? It will no longer show availability or take requests.')) return;
    setBusy(p.id); onError('');
    try { await clearSiteToken(p.id); await onChange(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Could not disconnect.'); }
    finally { setBusy(''); }
  };

  // Do NOT return null with no properties. Somebody arriving here to connect
  // their site would find an empty tab and no way forward, which is the dead
  // end this card exists to remove.
  if (properties.length === 0) {
    return (
      <SectionCard
        title="Your own website"
        subtitle="Take bookings direct, with no commission."
        style={{ marginBottom: 18 }}
      >
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)', margin: 0 }}>
          Add your property and its units on the Units tab first. The key your
          website uses belongs to a property, so there has to be one to give it to.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Your own website"
      subtitle="Take bookings direct, with no commission. Requests land here as pending."
      style={{ marginBottom: 18 }}
    >
      {properties.map((p) => {
        const token = p.public_site_token || '';
        const mine = units.filter((u) => u.property_id === p.id);
        return (
          <div key={p.id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{p.name}</span>
              <span className="badge" style={{
                color: token ? 'var(--green)' : 'var(--text-4)',
                borderColor: token ? 'var(--green)' : 'var(--border)',
              }}>
                {token ? 'CONNECTED' : 'NOT CONNECTED'}
              </span>
            </div>

            {!token ? (
              <>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)', margin: '0 0 10px' }}>
                  Connect your website and it can show which nights are free and send
                  booking requests straight into this calendar.
                </p>
                <button type="button" style={primaryBtn} disabled={busy === p.id} onClick={() => mint(p)}>
                  {busy === p.id ? 'Connecting…' : 'Connect my website'}
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-3)', margin: '0 0 10px' }}>
                  Put these two settings into your website, then publish it.
                </p>

                <Setting
                  name="NEXT_PUBLIC_AIBOS_API_URL"
                  value={apiBase}
                  missing={!apiBase}
                  copied={copied === `${p.id}-url`}
                  onCopy={() => copy(`${p.id}-url`, apiBase)}
                />
                <Setting
                  name="NEXT_PUBLIC_AIBOS_SITE_TOKEN"
                  value={shown[p.id] ? token : `${token.slice(0, 6)}${'•'.repeat(18)}`}
                  secret
                  revealed={Boolean(shown[p.id])}
                  onReveal={() => setShown((s) => ({ ...s, [p.id]: !s[p.id] }))}
                  copied={copied === `${p.id}-token`}
                  onCopy={() => copy(`${p.id}-token`, token)}
                />

                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Web address of each unit
                  </p>
                  {mine.length === 0 ? (
                    <p style={{ fontSize: 15, color: 'var(--text-3)', margin: 0 }}>
                      No units yet. Add them on the Units tab.
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {mine.map((u) => (
                        <li key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '2px 0' }}>
                          <code style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                            {u.public_slug || slugFrom(u.unit_name)}
                          </code>
                          <span style={{ fontSize: 15, color: 'var(--text-3)' }}>{u.unit_name}</span>
                          {!u.public_slug && (
                            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)' }}>
                              from the name
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', margin: '6px 0 0', lineHeight: 1.6 }}>
                    Your website has to ask for these exact words. Change them on the
                    Units tab. If they do not match, that residence answers
                    &ldquo;does not exist&rdquo; and nothing else goes wrong, which is
                    why it is worth checking now.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button type="button" style={ghostBtn} disabled={busy === p.id} onClick={() => rotate(p)}>
                    New key
                  </button>
                  <button type="button" style={ghostBtn} disabled={busy === p.id} onClick={() => disconnect(p)}>
                    Take offline
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </SectionCard>
  );
}

/**
 * Emails to your guests: sent in the property's name, never in ours.
 *
 * A guest who booked on the property's own website used to hear nothing in
 * writing. Now they get three emails: the moment the request lands, and again
 * when the owner confirms or turns it down. The owner's rule was that the guest
 * must never hear from AI-BOS, so everything here is about what the GUEST sees:
 * whose name, which address, where a reply lands.
 *
 * Off until the owner turns it on, and "Send me the samples" sits before the
 * switch on purpose: nobody should start emailing strangers without reading
 * what they will get.
 */
function GuestEmailsCard({ properties, onChange, onError }: {
  properties: Property[];
  onChange: () => Promise<void>;
  onError: (m: string) => void;
}) {
  if (properties.length === 0) return null;
  return (
    <SectionCard
      title="Emails to your guests"
      subtitle="Sent in your property's name. Your guests never see AI-BOS."
      style={{ marginBottom: 18 }}
    >
      {properties.map((p, i) => (
        <GuestEmailsForProperty key={p.id} property={p} last={i === properties.length - 1} onChange={onChange} onError={onError} />
      ))}
    </SectionCard>
  );
}

const BODY: React.CSSProperties = { fontSize: 18, lineHeight: 1.6, color: 'var(--text-2)', margin: 0 };
const FIELD: React.CSSProperties = { ...input, fontSize: 18, minHeight: 46 };

function GuestEmailsForProperty({ property: p, last, onChange, onError }: {
  property: Property; last: boolean;
  onChange: () => Promise<void>; onError: (m: string) => void;
}) {
  const [status, setStatus] = useState<GuestEmailStatus | null>(null);
  const [form, setForm] = useState({
    guest_email_from_name: p.guest_email_from_name || '',
    guest_email_from: p.guest_email_from || '',
    guest_email_reply_to: p.guest_email_reply_to || '',
    guest_contact_phone: p.guest_contact_phone || '',
    guest_payment_instructions: p.guest_payment_instructions || '',
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'warn' } | null>(null);
  const [logo, setLogo] = useState(p.guest_email_logo_url || '');
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    try { setStatus(await getGuestEmailStatus(p.id)); } catch { /* the card still works without it */ }
  }, [p.id]);
  useEffect(() => { refresh(); }, [refresh]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async (extra: Partial<Property> = {}, done = 'Saved.') => {
    setBusy('save'); setMessage(null); onError('');
    try {
      await updateProperty(p.id, { ...form, ...extra });
      await Promise.all([onChange(), refresh()]);
      setMessage({ text: done, tone: 'good' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not save.', tone: 'warn' });
    } finally { setBusy(''); }
  };

  /* The property's logo, for its guest emails. Same public `logos` bucket and
     own-folder rule as the business logo on the profile page. PNG or JPG only:
     Gmail and Outlook show an SVG as a broken image. */
  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setMessage({ text: 'Use a PNG or JPG logo. Most email apps cannot show other kinds.', tone: 'warn' });
      return;
    }
    setBusy('logo'); setMessage(null);
    try {
      const supabase = createClient();
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const path = `${user.id}/property-${p.id}-email-logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw new Error(upErr.message);
      const url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl;
      await updateProperty(p.id, { guest_email_logo_url: url });
      setLogo(url);
      await Promise.all([onChange(), refresh()]);
      setMessage({ text: 'Logo saved. It will be at the top of every email to your guests.', tone: 'good' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'The logo could not be uploaded.', tone: 'warn' });
    } finally { setBusy(''); }
  };

  const removeLogo = async () => {
    setBusy('logo'); setMessage(null);
    try {
      await updateProperty(p.id, { guest_email_logo_url: null });
      setLogo('');
      await Promise.all([onChange(), refresh()]);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not remove the logo.', tone: 'warn' });
    } finally { setBusy(''); }
  };

  const samples = async () => {
    setBusy('samples'); setMessage(null);
    try {
      const r = await sendGuestEmailSamples(p.id);
      if (r.status) setStatus(r.status);
      if (!r.to) {
        setMessage({ text: r.note || 'There is no email address on your profile to send the samples to.', tone: 'warn' });
      } else if (r.ok) {
        const fell = r.results && Object.values(r.results).some(x => x.fallback);
        setMessage({
          text: `Three sample emails are on their way to ${r.to}.` +
            (fell ? ' They came from the backup address because your own domain is not verified yet.' : ''),
          tone: fell ? 'warn' : 'good',
        });
      } else {
        const why = r.results && Object.values(r.results).find(x => !x.sent)?.note;
        setMessage({ text: `The samples did not send. ${why || ''}`.trim(), tone: 'warn' });
      }
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not send the samples.', tone: 'warn' });
    } finally { setBusy(''); }
  };

  const on = Boolean(p.guest_emails_enabled);
  const notReady = status !== null && !status.ready;
  const notLive = status !== null && !status.email_live;

  return (
    <div style={{ paddingBottom: last ? 0 : 18, marginBottom: last ? 0 : 18, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>{p.name}</span>
        <span className="badge" style={{ color: on ? 'var(--green)' : 'var(--text-4)', borderColor: on ? 'var(--green)' : 'var(--border)' }}>
          {on ? 'ON' : 'OFF'}
        </span>
      </div>

      {notReady && (
        <p style={{ ...BODY, color: 'var(--warn)', marginBottom: 12 }}>
          This needs a one-time database update before it can be used: run migration 0031 in Supabase.
        </p>
      )}
      {notLive && (
        <p style={{ ...BODY, color: 'var(--warn)', marginBottom: 12 }}>
          Email is not switched on for AI-BOS yet, so nothing can be sent.
        </p>
      )}

      <p style={{ ...BODY, marginBottom: 16 }}>
        When a guest books on your website they get an email straight away. They get another when
        you confirm the booking or turn it down, and a reminder 3 days before they arrive if money is
        still owed, with a link to pay. When they reply, it comes to you.
      </p>

      <div style={{ marginBottom: 16 }}>
        <span style={lbl}>Your logo</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {logo ? (
            // The email itself is white, so the preview is too: what the guest sees.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`${p.name} logo`} style={{ height: 56, maxWidth: 240, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 8, border: '1px solid var(--border-md)' }} />
          ) : (
            <span style={{ ...BODY, color: 'var(--text-3)' }}>No logo yet, so your property&rsquo;s name is shown in its place.</span>
          )}
          <label style={{ ...ghostBtn, fontSize: 16, minHeight: 44, display: 'inline-flex', alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            {busy === 'logo' ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}
            <input type="file" accept="image/png,image/jpeg" onChange={onLogo} disabled={Boolean(busy) || notReady} style={{ display: 'none' }} />
          </label>
          {logo && (
            <button type="button" style={{ ...ghostBtn, fontSize: 16, minHeight: 44 }} disabled={Boolean(busy)} onClick={removeLogo}>
              Remove
            </button>
          )}
        </div>
        <p style={{ ...BODY, fontSize: 16, color: 'var(--text-3)', marginTop: 6 }}>
          Shown at the top of every email to your guests. Use a PNG or JPG on a white or clear background.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <label>
          <span style={lbl}>Name your guests see</span>
          <input style={FIELD} value={form.guest_email_from_name} onChange={set('guest_email_from_name')} placeholder={p.name} />
        </label>
        <label>
          <span style={lbl}>Send from</span>
          <input style={FIELD} type="email" value={form.guest_email_from} onChange={set('guest_email_from')} placeholder="reservations@yourdomain.com" />
        </label>
        <label>
          <span style={lbl}>Replies go to</span>
          <input style={FIELD} type="email" value={form.guest_email_reply_to} onChange={set('guest_email_reply_to')} placeholder="The inbox you actually read" />
        </label>
        <label>
          <span style={lbl}>Phone for guests</span>
          <input style={FIELD} value={form.guest_contact_phone} onChange={set('guest_contact_phone')} placeholder="+260" />
        </label>
      </div>

      <label style={{ display: 'block', marginTop: 14 }}>
        <span style={lbl}>How to pay</span>
        <textarea
          style={{ ...FIELD, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
          value={form.guest_payment_instructions}
          onChange={set('guest_payment_instructions')}
          placeholder="Mobile money and bank details, exactly as a guest should copy them."
        />
      </label>
      <p style={{ ...BODY, fontSize: 16, color: 'var(--text-3)', marginTop: 6 }}>
        Shown in the first email as an option to pay now, and in the confirmation.
      </p>

      {status && (
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-badge)', border: '1px solid var(--border-md)' }}>
          <p style={{ ...BODY, color: 'var(--text-3)', fontSize: 16 }}>Your guests will see it from</p>
          <p style={{ ...BODY, fontWeight: 700, color: 'var(--text-1)', wordBreak: 'break-word' }}>{status.sending_as}</p>
          {status.own_domain_verified === false && (
            <p style={{ ...BODY, color: 'var(--warn)', marginTop: 6 }}>
              {status.own_domain} is not verified for sending yet, so emails go out from the backup
              address above, still in your name. Replies still come to you.
            </p>
          )}
          {status.own_domain_verified === null && status.from_address && (
            <p style={{ ...BODY, color: 'var(--text-3)', marginTop: 6 }}>
              Send yourself the samples to check that {status.own_domain} is ready to send from.
            </p>
          )}
          {!status.from_address && (
            <p style={{ ...BODY, color: 'var(--text-3)', marginTop: 6 }}>
              To send from your own address, verify your domain for sending and put the address in &ldquo;Send from&rdquo;.
            </p>
          )}
        </div>
      )}

      {message && (
        <p style={{ ...BODY, marginTop: 12, color: message.tone === 'good' ? 'var(--good)' : 'var(--warn)' }}>{message.text}</p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" style={{ ...ghostBtn, fontSize: 16, minHeight: 44 }} disabled={Boolean(busy)} onClick={() => save()}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        <button type="button" style={{ ...ghostBtn, fontSize: 16, minHeight: 44 }} disabled={Boolean(busy) || notReady || notLive} onClick={samples}>
          {busy === 'samples' ? 'Sending…' : 'Send me the three samples'}
        </button>
        <button
          type="button"
          style={{ ...primaryBtn, fontSize: 16, minHeight: 44, ...(on ? { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border-md)' } : {}) }}
          disabled={Boolean(busy) || notReady}
          onClick={() => save({ guest_emails_enabled: !on }, on ? 'Emails to guests are off.' : 'Emails to guests are on.')}
        >
          {on ? 'Turn off' : 'Turn on emails to guests'}
        </button>
      </div>
    </div>
  );
}

/** One copy-me setting line. */
function Setting({ name, value, missing, secret, revealed, onReveal, copied, onCopy }: {
  name: string; value: string; missing?: boolean; secret?: boolean;
  revealed?: boolean; onReveal?: () => void; copied: boolean; onCopy: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
      <code style={{
        fontSize: 'var(--fs-label)', color: 'var(--text-3)', minWidth: 210,
        fontFamily: 'inherit', fontWeight: 600,
      }}>
        {name}
      </code>
      <code style={{
        flex: '1 1 220px', minWidth: 0, padding: '6px 10px', borderRadius: 6,
        background: 'var(--bg-input)', border: '1px solid var(--border-md)',
        fontSize: 'var(--fs-label)', fontFamily: 'inherit',
        color: missing ? 'var(--red)' : 'var(--text-1)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {missing ? 'Not set on this deployment' : value}
      </code>
      {secret && (
        <button type="button" style={ghostBtn} onClick={onReveal}>
          {revealed ? 'Hide' : 'Show'}
        </button>
      )}
      <button type="button" style={ghostBtn} disabled={missing} onClick={onCopy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
