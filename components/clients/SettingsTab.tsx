'use client';
/**
 * Find clients, Settings (the owner's): who signs the messages, the booking
 * link answers offer, how many follow-ups, the facts answers may use and the
 * do not contact list.
 */
import { useState } from 'react';
import Panel from '@/components/home/Panel';
import { Note, Segmented } from '@/components/hospitality/kit';
import { saveClientSettings, type ClientsFull } from '@/lib/api';
import { Field, Group, said, toLines, type Said } from './shared';

type Count = '0' | '1' | '2' | '3';

export default function SettingsTab({ home, reload }: { home: ClientsFull; reload: () => Promise<void> }) {
  const s = home.settings;
  const [name, setName] = useState(s.sender_name ?? '');
  const [role, setRole] = useState(s.sender_role ?? '');
  const [phone, setPhone] = useState(s.phone ?? '');
  const [link, setLink] = useState(s.booking_link ?? '');
  const [followups, setFollowups] = useState<Count>(String(Math.max(0, Math.min(3, s.followups ?? 2))) as Count);
  const [days, setDays] = useState(String(s.followup_days ?? 4));
  const [facts, setFacts] = useState(s.facts ?? '');
  const [stop, setStop] = useState((s.do_not_contact ?? []).join('\n'));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Said | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const d = Number(days);
    if (!Number.isInteger(d) || d < 2 || d > 21) {
      setNote({ tone: 'bad', text: 'Days between follow-ups must be a whole number from 2 to 21.' });
      return;
    }
    const l = link.trim();
    if (l && !/^https?:\/\//i.test(l)) {
      setNote({ tone: 'bad', text: 'The booking link must be a web address starting with https://.' });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await saveClientSettings({
        sender_name: name.trim() || null,
        sender_role: role.trim() || null,
        phone: phone.trim() || null,
        booking_link: l || null,
        followups: Number(followups),
        followup_days: d,
        facts: facts.trim() || null,
        do_not_contact: toLines(stop).map((x) => x.toLowerCase()),
      });
      setNote({ tone: 'good', text: 'Saved. New messages use these from now on.' });
      await reload();
    } catch (err) {
      setNote({ tone: 'bad', text: said(err, 'The settings could not be saved just now. Try again in a moment.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Settings">
      <Note tone="info">
        AIBOS never sends for you. Each message opens in your own email or WhatsApp with everything filled in. You
        press send there, so replies come straight to you.
      </Note>
      <form onSubmit={save} className="rs-form" style={{ alignItems: 'start', gap: 18, marginTop: 20 }}>
        <Field label="Your name, as you sign" hint={home.business ? `Messages are signed with this name and ${home.business}.` : undefined}>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Your role">
          <input className="field" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} placeholder="Owner" />
        </Field>
        <Field label="Your phone, for the signature">
          <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Booking link" wide hint={
          'A page where they pick a time for a call. Google Calendar gives you one free: in Google Calendar press '
          + 'Create, then Appointment schedule, then copy its booking page link. Leave it empty and AIBOS asks them '
          + 'which day suits.'
        }>
          <input className="field" type="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={300}
            placeholder="https://calendar.app.google/..." />
        </Field>
        <Group label="Follow-ups when they do not answer">
          <Segmented<Count> label="Follow-ups" value={followups} onChange={setFollowups}
            options={[{ value: '0', label: 'None' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]} />
        </Group>
        <Field label="Days between follow-ups" hint="From 2 to 21.">
          <input className="field" type="number" inputMode="numeric" min={2} max={21} value={days}
            onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Facts AIBOS may use in answers" wide
          hint="Prices, opening hours, where you are, what is included. When they ask a question, AIBOS answers only from these and never guesses.">
          <textarea className="field" rows={5} value={facts} onChange={(e) => setFacts(e.target.value)} maxLength={3000} />
        </Field>
        <Field label="Do not contact" wide
          hint="One a line: an email, a whole domain such as example.co.zm, or a phone number. Anyone here is never found, written to or sent to again. People who reply asking to stop are added for you.">
          <textarea className="field" rows={5} value={stop} onChange={(e) => setStop(e.target.value)} />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          {note && <Note tone={note.tone}>{note.text}</Note>}
          <div className="rs-btns" style={{ marginTop: note ? 16 : 4 }}>
            <button type="submit" className="rs-btn is-navy" disabled={busy} aria-busy={busy}>{busy ? 'Saving' : 'Save settings'}</button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
