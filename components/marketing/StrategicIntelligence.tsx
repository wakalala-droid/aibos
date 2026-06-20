'use client';

// Strategic Intelligence — the "deciding without the numbers" narrative.
// A rising growth line replaces the divider: it climbs from beneath the copy
// (lower-left, uncertainty) to the Strategic Brief (upper-right, clarity),
// guiding the eye headline → copy → graph → KPI cards → brief. The brief is
// built from GENUINE product components (KPICard, InsightCard) and fades out at
// the bottom to imply more intelligence below.
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import KPICard from '@/components/ui/KPICard';
import InsightCard from '@/components/ui/InsightCard';

// Node waypoints in the SVG's 1200×600 viewBox. Because the graph SVG uses
// preserveAspectRatio="none", a viewBox point (x,y) maps linearly to
// (x/12 %, y/6 %) of the section — so the HTML pulse dots sit exactly on the line.
const NODES = [
  { x: 60, y: 470, delay: 0.2 },
  { x: 430, y: 410, delay: 0.7 },
  { x: 720, y: 300, delay: 1.2 },
  { x: 1150, y: 130, delay: 1.7, end: true },
];

const LINE = 'M60,470 C 250,458 320,432 430,410 S 620,362 720,300 S 1010,180 1150,130';

export default function StrategicIntelligence() {
  const reduce = useReducedMotion();

  return (
    <section className="mkt-section si-section" aria-labelledby="si-h">
      {/* Rising growth line — the divider. Spans the whole section, behind content. */}
      <svg className="si-graph" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="siLine" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--text-4)" stopOpacity="0.5" />
            <stop offset="45%" stopColor="var(--cyan)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--cyan)" />
          </linearGradient>
          <linearGradient id="siFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.10" />
          </linearGradient>
        </defs>
        {/* faint area under the curve — intelligence accumulating toward the right */}
        <motion.path
          d={`${LINE} L1150,600 L60,600 Z`}
          fill="url(#siFill)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 0.6 }}
        />
        <motion.path
          d={LINE}
          fill="none"
          stroke="url(#siLine)"
          strokeWidth={2.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
        />
      </svg>

      {/* Pulse dots on the line (HTML, precisely aligned to viewBox coords) */}
      <div className="si-nodes" aria-hidden>
        {NODES.map((nd, i) => (
          <motion.span
            key={i}
            className={`si-node${nd.end ? ' si-node-end' : ''}`}
            style={{ left: `${nd.x / 12}%`, top: `${nd.y / 6}%` }}
            initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.2 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: reduce ? 0 : nd.delay }}
          />
        ))}
      </div>

      <div className="mkt-wrap si-grid">
        {/* LEFT — the problem */}
        <div className="si-left">
          <motion.p className="mkt-eyebrow" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            Decision intelligence, made visible
          </motion.p>
          <motion.h2 id="si-h" className="mkt-h2" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.08 }}>
            You’re not making bad decisions.<br />
            <span style={{ color: 'var(--cyan)' }}>You’re just deciding without the numbers.</span>
          </motion.h2>
          <motion.p className="mkt-lead" style={{ marginTop: 24, maxWidth: 460 }} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.18 }}>
            The signals that decide whether a month works — a margin slipping, a
            customer drifting, cash tightening — are usually invisible until it’s
            too late. AI-BOS surfaces them while you can still act, and turns them
            into a brief you can read in a minute.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} style={{ marginTop: 30 }}>
            <Link href="/login" className="mkt-btn mkt-btn-primary">See your brief — free</Link>
          </motion.div>
        </div>

        {/* RIGHT — the Strategic Brief (genuine components) */}
        <div className="si-brief-wrap">
          <motion.div
            className="aibos-window si-brief"
            data-theme="dark"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
          >
            <div className="aibos-window-bar">
              <span className="aibos-window-dots"><i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} /></span>
              <span className="aibos-window-url">app.aibos.africa/dashboard/brief</span>
            </div>
            <div className="aibos-window-body">
              {/* Brief header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Strategic Brief</p>
                  <p style={{ margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-4)' }}>Zoe’s Kitchen · auto-generated today</p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--good)', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', padding: '4px 9px', borderRadius: 999 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--good)' }} /> Live
                </span>
              </div>

              {/* Executive summary */}
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--text-2)' }}>
                <span style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Executive summary</span><br />
                Three moves this week protect <strong style={{ color: 'var(--text-1)' }}>~K31k</strong> of revenue and recover <strong style={{ color: 'var(--text-1)' }}>K2,900/mo</strong> in margin.
              </p>

              {/* Real KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                <KPICard label="MARGIN UPSIDE" value="+K8,400" sub="/mo if you act" growth={13.6} sparkData={[2100, 3400, 4200, 5600, 7000, 8400]} sparkColor="var(--spark-profit)" delay={0} />
                <KPICard label="AT-RISK REVENUE" value="K31,200" sub="31 customers slipping" sparkData={[12, 17, 21, 25, 28, 31]} sparkColor="var(--spark-cost)" delay={0.08} />
              </div>

              {/* Recommended moves — genuine InsightCards */}
              <p style={{ margin: '0 0 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)' }}>Recommended moves</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InsightCard priority="high" sourceEngines={['E1', 'E3']} index={0}
                  insight="Grilled Chicken margin slipped 41% → 36% as poultry costs rose."
                  action="Raise its price ~K6 or renegotiate supply — recovers ≈ K2,900/mo." />
                <InsightCard priority="medium" sourceEngines={['E2']} index={1}
                  insight="31 customers moved to ‘At-Risk’ this month."
                  action="Send a win-back offer to the top 10 by lifetime value." />
                <InsightCard priority="medium" sourceEngines={['E1']} index={2}
                  insight="Cash dips to K96k in May on supplier prepayments."
                  action="Stagger the next order by 8 days to protect runway." />
              </div>

              {/* Action items — partially revealed beneath the fade (curiosity) */}
              <p style={{ margin: '18px 0 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)' }}>This week</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['Reprice Grilled Chicken Platter', 'Win-back the top 10 at-risk customers', 'Reschedule the supplier order'].map((t) => (
                  <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem', color: 'var(--text-2)' }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid var(--text-4)', flexShrink: 0 }} />{t}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
          <div className="si-brief-fade" aria-hidden />
        </div>
      </div>
    </section>
  );
}
