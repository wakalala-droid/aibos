'use client';

// components/team/TeamMap.tsx
// The AIBOS team at a glance (Jarvis phase 4): the AIBOS mark in its rings in
// the middle, the Assistant, and the six workers around it, each joined to
// the middle by a hairline. The idea is borrowed from an agent "base map";
// the look is the kit's: hairlines, the white disc and dashed ring of the art
// strip, status told by fill. A worker with something for the owner is
// filled brand cyan, with the count on it, and its line turns cyan. One
// that is watching is an outlined disc. One the plan does not include is
// faded. Nothing moves on its own. Tapping one picks it.

import { BedDouble, BookCheck, HandCoins, Landmark, Telescope, Users } from 'lucide-react';
import { BrandMark } from '@/components/kit';
import type { AiWorker } from '@/lib/api';

export const WORKER_ICONS: Record<string, typeof Users> = {
  bookkeeper: BookCheck, collector: HandCoins, tax: Landmark,
  payroll: Users, scout: Telescope, guest_desk: BedDouble,
};

// Around the middle, clockwise from the top, in % of the map.
const SPOTS: [number, number][] = [[50, 13], [81, 31], [81, 69], [50, 87], [19, 69], [19, 31]];

export function workerState(w: AiWorker): { word: string; tone: 'ask' | 'watch' | 'off' } {
  if (!w.on) return { word: w.off_reason || 'Not on your plan', tone: 'off' };
  if (w.waiting > 0) return { word: `${w.waiting} ${w.waiting === 1 ? 'needs' : 'need'} you`, tone: 'ask' };
  return { word: 'Watching', tone: 'watch' };
}

export default function TeamMap({ workers, picked, onPick }: {
  workers: AiWorker[];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const assistant = workers.find((w) => w.id === 'assistant');
  const crew = workers.filter((w) => w.id !== 'assistant').slice(0, SPOTS.length);
  const middle = assistant ? workerState(assistant) : null;
  return (
    <div className="team-map">
      <svg className="team-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {crew.map((w, i) => (
          <line key={w.id} x1="50" y1="50" x2={SPOTS[i][0]} y2={SPOTS[i][1]}
            className={`team-line is-${workerState(w).tone}`} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <button type="button" className={`team-hub is-${middle?.tone ?? 'watch'}`} aria-pressed={picked === 'assistant'}
        aria-label={`Assistant: ${middle?.word ?? 'Watching'}`} onClick={() => onPick('assistant')}>
        <span className="team-hub-ring" aria-hidden="true"><i className="team-hub-point" /></span>
        <span className="team-hub-disc" aria-hidden="true"><BrandMark size={40} theme="light" /></span>
        {assistant && assistant.waiting > 0 && <span className="team-count" aria-hidden="true">{assistant.waiting}</span>}
        <span className="team-name">Assistant</span>
      </button>

      {crew.map((w, i) => {
        const Icon = WORKER_ICONS[w.id] ?? Users;
        const s = workerState(w);
        return (
          <button key={w.id} type="button" className={`team-node is-${s.tone}`} aria-pressed={picked === w.id}
            style={{ left: `${SPOTS[i][0]}%`, top: `${SPOTS[i][1]}%` }}
            aria-label={`${w.name}: ${s.word}`} onClick={() => onPick(w.id)}>
            <span className="team-disc" aria-hidden="true">
              <Icon />
              {s.tone === 'ask' && <span className="team-count">{w.waiting}</span>}
            </span>
            <span className="team-name">{w.name}</span>
            <span className="team-state">{s.word}</span>
          </button>
        );
      })}
    </div>
  );
}
