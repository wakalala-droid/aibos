'use client';
/**
 * Find clients: the words and small pieces every tab shares. Built on the
 * calendar kit (components/hospitality/kit.tsx) and the .rs-* classes: status
 * is told by fill, never by a coloured edge.
 */
import type { ReactNode } from 'react';
import type { Tone } from '@/components/hospitality/kit';
import type { ClientLabel, ClientMessage, ClientStage } from '@/lib/api';

export const STAGE_ORDER: ClientStage[] = [
  'new', 'researched', 'ready', 'contacted', 'replied', 'meeting', 'won', 'lost', 'skipped',
];

export const STAGE_WORDS: Record<ClientStage, string> = {
  new: 'Not researched',
  researched: 'Researched',
  ready: 'Ready to send',
  contacted: 'Written to',
  replied: 'Wrote back',
  meeting: 'Meeting booked',
  won: 'Won',
  lost: 'Lost',
  skipped: 'Skipped',
};

/** A stage in the calendar's fills: navy once they talk to you, solid when won. */
export function stageTone(stage: ClientStage): Tone {
  switch (stage) {
    case 'replied':
    case 'meeting': return 'stay';
    case 'won': return 'done';
    case 'researched':
    case 'ready': return 'wait';
    case 'contacted': return 'open';
    default: return 'off';
  }
}

/** What a reply said, in the same fills. */
export function labelTone(label: ClientLabel | null | undefined): Tone {
  switch (label) {
    case 'hot_lead':
    case 'wants_call': return 'stay';
    case 'question': return 'open';
    case 'unsubscribe': return 'bad';
    case 'not_interested': return 'off';
    default: return 'wait';
  }
}

export const KIND_WORDS: Record<ClientMessage['kind'], string> = {
  first: 'First message',
  followup: 'Follow-up',
  answer: 'Your answer',
  reply: 'They wrote',
};

export const SOURCE_WORDS: Record<'map' | 'list' | 'typed', string> = {
  map: 'Found on the map',
  list: 'From your list',
  typed: 'Added by hand',
};

export type Said = { tone: 'good' | 'warn' | 'bad' | 'info'; text: string };

/** "today", "yesterday", "5 Nov", or "5 Nov 2025" from another year. */
export function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff === -1) return 'tomorrow';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** The server's own words when it gave some, else ours. */
export function said(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function plural(n: number, one: string, many?: string): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many ?? `${one}s`}`;
}

/** One item a line. */
export function toLines(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Separated by commas or lines. */
export function toWords(text: string): string[] {
  return text.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
}

export function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** How many were added, already known or stopped by the do not contact list. */
export function addedWords(got: { added: number; known: number; blocked: number }): string {
  const parts = [`${got.added.toLocaleString('en-GB')} added`];
  if (got.known) parts.push(`${got.known.toLocaleString('en-GB')} already in your list`);
  if (got.blocked) parts.push(`${got.blocked.toLocaleString('en-GB')} on your do not contact list`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** A labelled field. */
export function Field({ label, hint, wide, children }: {
  label: string; hint?: ReactNode; wide?: boolean; children: ReactNode;
}) {
  return (
    <label style={{ display: 'block', minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="rs-text is-quiet" style={{ display: 'block', marginTop: 6 }}>{hint}</span>}
    </label>
  );
}

/** A labelled group of buttons (a label element would press the first one). */
export function Group({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0, gridColumn: '1 / -1' }}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="rs-text is-quiet" style={{ display: 'block', marginTop: 6 }}>{hint}</span>}
    </div>
  );
}

/** Several choices out of many, each a chip that stays pressed. */
export function PickChips({ label, options, value, onChange, disabled }: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const on = new Set(value);
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={on.has(o.value)} disabled={disabled}
          onClick={() => onChange(on.has(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value])}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
