'use client';

// TeachAibosCard: Home's nudge to teach AIBOS the business (22 Oct 2026).
// Until the owner has been through the interview (app/dashboard/teach), every
// answer AIBOS gives is generic: it does not know how old the business is, what
// a normal month looks like or what they are aiming for. Shown to the owner
// only, with how far they got; gone once the interview is done, and quiet for a
// week after "Not now".

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { getInterview } from '@/lib/api';
import { useProfile } from '@/lib/profile';

const SNOOZE_KEY = 'aibos-teach-snoozed-until-v1';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function TeachAibosCard() {
  const { teamRole } = useProfile();
  const [progress, setProgress] = useState<{ done: number; total: number; finished: boolean } | null>(null);
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    let alive = true;
    try { setSnoozed(Number(window.localStorage.getItem(SNOOZE_KEY) || 0) > Date.now()); }
    catch { setSnoozed(false); }
    // No interview table yet, or offline: the card simply stays away.
    getInterview().then((s) => { if (alive) setProgress(s.progress); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (snoozed || !progress || progress.finished) return null;
  if (teamRole && teamRole !== 'owner') return null;

  const started = progress.done > 0;
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0;

  return (
    <div role="status" className="bento" style={{ marginBottom: 16 }}>
      <div className="bento-head">
        <span className="bento-icon" aria-hidden="true"><BookOpen /></span>
        <div className="bento-main">
          <div className="bento-titlerow">
            <p className="bento-title">Teach AIBOS your business</p>
            <span className="bento-tag">{started ? `${progress.done} of ${progress.total}` : 'About 5 minutes'}</span>
          </div>
          {started && (
            <div className="progress-track" style={{ height: 8, marginTop: 12 }}>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="bento-text">
            {started
              ? 'Pick up where you left off. The more AIBOS knows, the more its answers are about your business and not a generic one.'
              : 'Tell AIBOS how the business started, what a normal month looks like and what you are aiming for. Its answers and your monthly targets come from it.'}
          </p>
        </div>
      </div>
      <div className="bento-foot">
        <Link href="/dashboard/teach" className="pill pill-primary">{started ? 'Carry on' : 'Start'}</Link>
        <button type="button" className="pill pill-quiet" onClick={() => {
          try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + WEEK_MS)); } catch { /* private mode */ }
          setSnoozed(true);
        }}>Not now</button>
      </div>
    </div>
  );
}
