'use client';

// The AIBOS team on Home (17 Nov 2026 cleanup): one slim panel in place of a
// card per worker. The six workers in a row around the AIBOS mark, each
// telling its state by fill, and one live line saying what the team did last.
// The whole strip opens the team page. Owners only: the workers ask the owner.
// On a plan without the workers it says what they would do and which plan
// has them (never a price, and nothing to buy in the iPhone app).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import { BrandMark } from '@/components/kit';
import { useStore } from '@/lib/store';
import { useProfile } from '@/lib/profile';
import { canAccess, type Tier } from '@/lib/tiers';
import { NOT_ON_PLAN_SHORT, useIosApp } from '@/lib/iosApp';
import { getTeam, listRecentActions, type AiAction, type AiTeam } from '@/lib/api';
import { WORKER_ICONS, workerState } from '@/components/team/TeamScene';
import { useAutoMode, useOnTeamChange } from '@/lib/autoMode';
import Panel from './Panel';

function clock(at?: string | null): string {
  const d = new Date(at ?? '');
  if (!at || Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`;
}

export function lastLine(team: AiTeam | null, recent: AiAction[]): string {
  const last = recent.find((j) => j.status === 'done' || j.status === 'waiting');
  if (last) {
    const who = last.worker?.name ?? 'Assistant';
    const what = last.status === 'done' ? last.did : last.said;
    const when = clock(last.at);
    return `${who}${when ? `, ${when}` : ''}: ${what}`;
  }
  if (team?.looked_at && clock(team.looked_at)) return `Looked through your books at ${clock(team.looked_at)}. Nothing new.`;
  return `The team looks through your books every ${team?.every_hours ?? 3} hours in the day.`;
}

export default function TeamStrip() {
  const tier = useStore((s) => s.tier) as Tier;
  const booksVersion = useStore((s) => s.booksVersion);
  const { teamRole } = useProfile();
  const ios = useIosApp();
  const { on: autoOn } = useAutoMode();
  const hasTeam = canAccess(tier, 'chat_actions');
  const [team, setTeam] = useState<AiTeam | null>(null);
  const [recent, setRecent] = useState<AiAction[]>([]);

  const load = useCallback(() => {
    if (!hasTeam) return;
    getTeam().then(setTeam).catch(() => {});
    listRecentActions(10).then(setRecent).catch(() => {});
  }, [hasTeam]);
  useEffect(() => { load(); }, [load, booksVersion]);
  useOnTeamChange(load);

  if (teamRole && teamRole !== 'owner') return null;

  const crew = (team?.workers ?? []).filter((w) => w.id !== 'assistant');
  const waiting = (team?.workers ?? []).reduce((n, w) => n + (w.on ? w.waiting : 0), 0);

  return (
    <Panel labelledBy="team-strip-title">
      <Link href="/dashboard/team" className={`team-strip${autoOn ? ' is-auto' : ''}`} aria-describedby="team-strip-line">
        <span className="team-strip-hub" aria-hidden="true"><BrandMark size={26} theme="light" /></span>
        <span className="team-strip-main">
          <span className="team-strip-head">
            <h2 id="team-strip-title" className="panel-title" style={{ margin: 0 }}>Your AIBOS team</h2>
            {hasTeam && (
              <span className="bento-tag">
                {autoOn ? 'Auto is on' : waiting > 0 ? `${waiting} for you` : 'Watching'}
              </span>
            )}
          </span>
          <span id="team-strip-line" className="team-strip-line">
            {hasTeam
              ? lastLine(team, recent)
              : `Six workers who look through your books, chase what is owed and ask before they act. ${ios ? NOT_ON_PLAN_SHORT : 'They come with Pro+'}.`}
          </span>
        </span>
        <span className="team-strip-crew" aria-hidden="true">
          {(crew.length ? crew : Object.keys(WORKER_ICONS).map((id) => ({ id, on: false, waiting: 0 } as never))).map((w: any) => {
            const Icon = WORKER_ICONS[w.id] ?? Users;
            const tone = hasTeam && crew.length ? workerState(w).tone : 'off';
            return <span key={w.id} className={`team-strip-dot is-${tone}`}><Icon /></span>;
          })}
        </span>
        <ChevronRight className="team-strip-go" aria-hidden="true" />
      </Link>
    </Panel>
  );
}
