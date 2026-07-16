'use client';
/**
 * AIBOS — Growth Journey (Progressive Intelligence · Initiative 6 / Bible Ch.16).
 * A calm 5-stage stepper that shows where the business is on its AIBOS journey and
 * the single next action. Reveals capability as data accrues — never overwhelms.
 */
import { useStore } from '@/lib/store';
import { STAGES, computeProgress } from '@/lib/progressive';

export default function GrowthJourney() {
  const twin = useStore(s => s.twin);
  const p = computeProgress(twin);

  return (
    <div>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {STAGES.map(s => {
          const reached = s.id <= p.stage.id;
          const current = s.id === p.stage.id;
          return (
            <div key={s.id} style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                height: 4, borderRadius: 99,
                background: reached ? 'var(--cyan)' : 'var(--border)',
                opacity: current ? 1 : reached ? 0.7 : 1,
              }} />
              <div style={{
                marginTop: 6, fontSize: 'var(--fs-label)',
                fontWeight: current ? 700 : 500,
                color: current ? 'var(--cyan)' : reached ? 'var(--text-2)' : 'var(--text-4)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {s.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Current stage blurb + next action */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-1)' }}>
          Stage {p.stage.id} · {p.stage.title}
        </span>
        <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.5 }}>
          {p.stage.blurb}
        </span>
        <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)', marginTop: 4 }}>
          {p.nextAction}
        </span>
      </div>

      {/* Progress to next stage */}
      {p.next && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Toward {p.next.title}
            </span>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text-3)' }}>
              {p.pctToNext}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${p.pctToNext}%`, background: 'var(--cyan)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
