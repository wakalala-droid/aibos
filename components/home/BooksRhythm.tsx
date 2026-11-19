'use client';

// The week's rhythm under the greeting (habit audit, 19 Nov 2026).
//
// After the first-week goal nothing on Home showed the habit the owner was
// building, so it faded without a word. Seven dots, one a day, filled on a
// day the books were kept, and "Books kept 5 of the last 7 days": a count of
// the week, never a streak that one closed Sunday breaks back to nothing.
// Today waits as a grey ring until something is recorded. The days come
// from when entries were written down (hooks/useRecordingDays): catching up
// on Friday's sales today fills today's dot, the day the books were kept.

import { useRecordingDays } from '@/hooks/useRecordingDays';
import { GOAL_DAYS } from '@/lib/briefTrial';

export const WEEK = 7;

export interface RhythmDay { day: string; kept: boolean; today: boolean }

/** The last seven local days, oldest first, each kept or not. */
export function lastWeek(days: string[], now: Date = new Date()): RhythmDay[] {
  const kept = new Set(days);
  const out: RhythmDay[] = [];
  for (let i = WEEK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day = d.toLocaleDateString('en-CA');
    out.push({ day, kept: kept.has(day), today: i === 0 });
  }
  return out;
}

export default function BooksRhythm() {
  const rec = useRecordingDays();
  // The first-week card counts the first days; this takes over after it.
  if (!rec || rec.days.length < GOAL_DAYS) return null;
  const week = lastWeek(rec.days);
  const kept = week.filter((d) => d.kept).length;
  // A week away is the welcome back nudge's to say, not a row of empty dots.
  if (kept === 0) return null;
  const todayKept = week[WEEK - 1].kept;
  const words = kept === WEEK ? 'Books kept every day for a week' : `Books kept ${kept} of the last ${WEEK} days`;

  return (
    <p className="home-rhythm">
      <span className="rhythm-dots" aria-hidden="true">
        {week.map((d) => (
          <span key={d.day} className={`rhythm-dot${d.kept ? ' is-kept' : d.today ? ' is-today' : ''}`} />
        ))}
      </span>
      <span>
        {words}
        {!todayKept && <span className="sr-only">. Nothing recorded yet today.</span>}
      </span>
    </p>
  );
}
