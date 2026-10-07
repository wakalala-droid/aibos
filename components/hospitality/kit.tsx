'use client';
/**
 * Rooms & Stays: the pieces every screen in the section is built from, taken
 * from the week calendar (the owner's reference, 7 Oct 2026) so the booking
 * panel, the lists and the forms read as the same thing as the calendar.
 *
 * Status is told the calendar's way, by fill rather than a coloured edge:
 * navy is a confirmed stay, a dashed outline is a request still waiting,
 * charcoal is a finished stay, a plain outline is one that did not happen.
 * The styles live in app/globals.css under "Rooms and Stays: the set".
 */
import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';

export type Tone = 'stay' | 'wait' | 'done' | 'off' | 'bad' | 'open';

/** The calendar's fill for a booking status. */
export function toneOf(status: string): Tone {
  switch (status) {
    case 'confirmed': return 'stay';
    case 'pending': return 'wait';
    case 'completed': return 'done';
    case 'no_show': return 'bad';
    default: return 'off'; // cancelled, declined
  }
}

/** The small square from the calendar's key. */
export function Swatch({ tone }: { tone: Tone }) {
  return <i className={`rs-swatch is-${tone}`} aria-hidden="true" />;
}

/** A rounded label, with the calendar's swatch in front when it names a status. */
export function Chip({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="rs-chip">
      {tone && <Swatch tone={tone} />}
      {children}
    </span>
  );
}

/** A day as the calendar draws it: the month in capitals over the date in a circle. */
export function DayBadge({ date, tone = 'stay', small = false }: { date: string; tone?: Tone; small?: boolean }) {
  const d = new Date(`${date}T00:00:00`);
  const ok = !Number.isNaN(d.getTime());
  return (
    <span className={`rs-day is-${tone}${small ? ' is-sm' : ''}`} aria-hidden="true">
      {!small && <span className="rs-day-mon">{ok ? d.toLocaleDateString([], { month: 'short' }) : ''}</span>}
      <span className="rs-day-num">{ok ? d.getDate() : '?'}</span>
    </span>
  );
}

/** A titled part of a panel, set off by a hairline, as the calendar's lanes are. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rs-sec">
      <div className="rs-sec-head">
        <h3 className="rs-sec-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Facts({ children }: { children: ReactNode }) {
  return <div className="rs-facts">{children}</div>;
}

/** One fact: a spaced-capitals label, like the calendar's MON, over its value. */
export function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rs-fact">
      <div className="rs-fact-label">{label}</div>
      <div className="rs-fact-value">{value}</div>
      {hint && <div className="rs-fact-hint">{hint}</div>}
    </div>
  );
}

/** One choice out of a few, the chosen one filled navy like a stay. */
export function Segmented<T extends string>({ label, options, value, onChange, disabled }: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rs-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A message in the panel: how an answer went, or what went wrong. */
export function Note({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const Icon = tone === 'good' ? Check : tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={`rs-note is-${tone}`} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
