'use client';

// components/guide/SphereSettings.tsx
// Settings > The AI-BOS sphere (owner, 28 Nov 2026): the voice AI-BOS talks in,
// the spoken report when the app is first opened each day, and tips on pages
// not seen before. lib/guide/prefs.ts keeps them on the person's profile
// (migration 0050), so they follow them to every device, and on this device.

import { useState } from 'react';
import { SectionCard } from '@/components/kit';
import { Note, Segmented } from '@/components/hospitality/kit';
import { savePrefs, usePrefs, VOICES } from '@/lib/guide/prefs';
import { startTalk } from '@/lib/talkEvent';

type Changes = Parameters<typeof savePrefs>[0];

export default function SphereSettings() {
  const prefs = usePrefs();
  const [note, setNote] = useState<string | null>(null);
  const change = (c: Changes) => { setNote(null); void savePrefs(c).then(setNote); };

  return (
    <SectionCard title="The AI-BOS sphere"
      subtitle="AI-BOS out loud: the voice it talks in, a spoken report each day, and help on pages you have not seen yet."
      style={{ marginTop: 20 }}>
      <div style={{ display: 'grid', gap: 24 }}>
        <div>
          <label htmlFor="sphere-voice" className="field-label">The voice AI-BOS talks in</label>
          <div className="rs-btns" style={{ alignItems: 'center' }}>
            <select id="sphere-voice" className="field" style={{ flex: '1 1 220px', maxWidth: 360 }}
              value={prefs.voice} onChange={(e) => change({ voice: e.target.value })}>
              {VOICES.map((v) => <option key={v.name} value={v.name}>{`${v.name}: ${v.sounds.toLowerCase()}`}</option>)}
            </select>
            <button type="button" className="rs-btn is-quiet is-sm" onClick={() => startTalk()}>Talk to hear it</button>
          </div>
          <p className="rs-text is-quiet" style={{ marginTop: 8 }}>Your next talk uses it.</p>
        </div>

        <div>
          <p className="field-label" id="sphere-report">The spoken report</p>
          <p className="rs-text is-quiet" style={{ marginBottom: 12 }}>
            The first time you open AI-BOS each day, the sphere asks if you have a moment, then tells you how the
            business is doing, what needs you, and the three or four things it suggests you do next.
          </p>
          <div className="rs-btns" style={{ alignItems: 'center' }}>
            <Segmented label="The spoken report" value={prefs.spoken_report ? 'on' : 'off'}
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
              onChange={(v) => change({ spoken_report: v === 'on' })} />
            <button type="button" className="rs-btn is-quiet is-sm" onClick={() => startTalk('report')}>Hear it now</button>
          </div>
        </div>

        <div>
          <p className="field-label">Tips on new pages</p>
          <p className="rs-text is-quiet" style={{ marginBottom: 12 }}>
            When you rest on a page you have not seen before, the sphere offers once to show you round it.
          </p>
          <Segmented label="Tips on new pages" value={prefs.tips ? 'on' : 'off'}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
            onChange={(v) => change({ tips: v === 'on' })} />
        </div>

        {note && <Note tone="info">{note}</Note>}
      </div>
    </SectionCard>
  );
}
