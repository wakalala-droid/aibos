'use client';
import { useStore } from '@/lib/store';
import KPICard from '@/components/ui/KPICard';
import SectionCard from '@/components/ui/SectionCard';
import LockOverlay from '@/components/ui/LockOverlay';
import { motion } from 'framer-motion';

const STATUS = {
  good:  { color: 'var(--good)', label: 'On Target',    bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.25)' },
  warn:  { color: 'var(--warn)', label: 'Below Target', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)' },
  alert: { color: 'var(--crit)', label: 'Critical',     bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)'  },
};

function BenchmarkCard({ b, delay }: { b: any; delay: number }) {
  const cfg = STATUS[b.status as keyof typeof STATUS] ?? STATUS.good;
  const pct = Math.min(Math.abs(b.actual / Math.max(b.benchmark, 1)) * 100, 110);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      style={{ background: 'var(--bg-card)', border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-card)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, maxWidth: 130 }}>{b.label}</p>
        <span className="badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>{cfg.label}</span>
      </div>
      <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '2rem', fontWeight: 800, color: cfg.color, letterSpacing: '-0.03em', margin: '0 0 12px' }}>
        {b.actual}{b.unit !== 'K' ? b.unit : ''}
      </p>
      <div className="progress-track" style={{ marginBottom: 8 }}>
        <motion.div className="progress-fill" style={{ background: cfg.color }}
          initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: delay + 0.2 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)' }}>Benchmark: {b.benchmark}{b.unit !== 'K' ? b.unit : ''}</span>
        <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: cfg.color, fontWeight: 700 }}>
          {b.gap > 0 ? '+' : ''}{b.gap.toFixed(1)}{b.unit !== 'K' ? b.unit : ''}
        </span>
      </div>
    </motion.div>
  );
}

function AttachMeter({ label, value, benchmark, color }: { label: string; value: number; benchmark: number; color: string }) {
  const good = value >= benchmark;
  const barCol = good ? 'var(--good)' : 'var(--warn)';
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.7rem', color: 'var(--text-2)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.1rem', fontWeight: 800, color: barCol }}>{value.toFixed(1)}%</span>
          <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-4)' }}>/ {benchmark}%</span>
        </div>
      </div>
      <div className="progress-track" style={{ height: 6 }}>
        <motion.div className="progress-fill" style={{ background: barCol, height: '100%' }}
          initial={{ width: 0 }} animate={{ width: `${Math.min(value / benchmark * 100, 100)}%` }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }} />
      </div>
      <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: barCol, textAlign: 'right', margin: '4px 0 0' }}>
        {good ? `+${(value - benchmark).toFixed(1)}% above target` : `${(value - benchmark).toFixed(1)}% below target`}
      </p>
    </div>
  );
}

export default function BenchmarksPage() {
  const { benchmarks, attachRates, menuGaps, hasEngine3Data, posBusinessName, posPeriod } = useStore();
  const goodCount  = benchmarks.filter(b => b.status === 'good').length;
  const warnCount  = benchmarks.filter(b => b.status === 'warn').length;
  const alertCount = benchmarks.filter(b => b.status === 'alert').length;
  const drinkAttach = attachRates?.drink_attach_pct ?? 0;
  const sideAttach  = attachRates?.side_attach_pct  ?? 0;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--e3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Operations</p>
        <h1 style={{ fontFamily: 'Geist, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.03em' }}>Operational Benchmarks</h1>
        <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.7rem', color: 'var(--text-3)', margin: '4px 0 0' }}>{[posBusinessName, posPeriod].filter(Boolean).join(' · ')}</p>
      </div>

      {/* KPI summary strip */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <KPICard label="ON TARGET" value={String(goodCount)} sub="metrics within benchmark"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="rgba(52,211,153,0.15)" sparkColor="var(--good)" delay={0} />
        <KPICard label="BELOW TARGET" value={String(warnCount)} sub="metrics needing attention"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 20h20L12 3z" stroke="var(--warn)" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M12 10v4M12 17v.5" stroke="var(--warn)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(251,191,36,0.15)" sparkColor="var(--warn)" delay={0.06} />
        <KPICard label="CRITICAL" value={String(alertCount)} sub="metrics requiring urgent action"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--crit)" strokeWidth="1.5" fill="none"/><path d="M12 8v5M12 16v.5" stroke="var(--crit)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="rgba(239,68,68,0.15)" sparkColor="var(--crit)" delay={0.12} />
      </div>

      {/* Benchmark cards */}
      {benchmarks.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          {benchmarks.map((b, i) => <BenchmarkCard key={b.metric} b={b} delay={0.1 + i * 0.06} />)}
        </div>
      ) : (
        <SectionCard delay={0.1} style={{ position: 'relative', minHeight: 160, textAlign: 'center' }}>
          <LockOverlay colour="var(--e3)" title="Operations Locked" description="Upload a POS export file to see QSR benchmark comparisons" />
        </SectionCard>
      )}

      {/* Attach rates */}
      <SectionCard title="Attach Rates" subtitle="Drink & side attach vs QSR benchmarks" delay={0.22} style={{ marginBottom: 20 }}>
        <AttachMeter label="Drink Attach Rate" value={drinkAttach} benchmark={80} color="var(--e3)" />
        <AttachMeter label="Side Attach Rate"  value={sideAttach}  benchmark={30} color="var(--blue)" />
        {drinkAttach < 80 && (
          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', marginTop: 4 }}>
            <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', color: 'var(--warn)', margin: 0, lineHeight: 1.5 }}>
              Drink attach {drinkAttach.toFixed(1)}% is {(80 - drinkAttach).toFixed(1)}% below the 80% QSR benchmark. Train staff on proactive drink recommendations at every order.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Menu gaps */}
      {menuGaps.length > 0 && (
        <SectionCard title="Menu Optimisation Opportunities" subtitle="Velocity and pricing analysis" delay={0.28}>
          {menuGaps.map((g, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>{g.name}</span>
                  <span className="badge" style={{ color: 'var(--text-3)', background: 'var(--bg-badge)', borderColor: 'var(--border)', fontSize: '0.66rem' }}>{g.category}</span>
                </div>
                <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', color: 'var(--warn)', margin: '0 0 3px' }}>{g.issue}</p>
                <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', color: 'var(--good)', margin: 0 }}>→ {g.opportunity}</p>
              </div>
              <span style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', color: 'var(--text-4)', whiteSpace: 'nowrap', paddingTop: 2 }}>SKU: {g.sku}</span>
            </div>
          ))}
        </SectionCard>
      )}
    </>
  );
}
