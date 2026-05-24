'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, severityConfig } from '@/lib/store';
import { formatCurrency, formatPercent } from '@/lib/utils';

function Card({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
      style={{ background: 'rgba(9,13,30,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,179,237,0.12)', borderRadius: 16, padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden', ...style }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)' }} />
      {children}
    </motion.div>
  );
}

// Section within brief
function BriefSection({ icon, title, children, delay = 0 }: { icon: React.ReactNode; title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{ paddingBottom: 24, borderBottom: '1px solid rgba(99,179,237,0.07)', marginBottom: 24 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', flexShrink: 0 }}>
          {icon}
        </div>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

const Metric = ({ label, value, colour = '#e2eeff', mono = false }: { label: string; value: string; colour?: string; mono?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid rgba(99,179,237,0.04)' }}>
    <span style={{ fontSize: '0.75rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{label}</span>
    <span style={{ fontSize: '0.82rem', color: colour, fontFamily: mono ? 'DM Mono, monospace' : 'Outfit, sans-serif', fontWeight: 600 }}>{value}</span>
  </div>
);

const Insight = ({ text, colour = '#4a6285' }: { text: string; colour?: string }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
    <div style={{ width: 5, height: 5, borderRadius: '50%', background: colour, flexShrink: 0, marginTop: 7 }}/>
    <p style={{ fontSize: '0.78rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', lineHeight: 1.65, margin: 0 }}>{text}</p>
  </div>
);

const Rec = ({ text, priority, icon }: { text: string; priority: 'High' | 'Medium' | 'Low'; icon: React.ReactNode }) => {
  const colours = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
  const bg      = { High: 'rgba(239,68,68,0.08)', Medium: 'rgba(245,158,11,0.08)', Low: 'rgba(16,185,129,0.08)' };
  const border  = { High: 'rgba(239,68,68,0.25)', Medium: 'rgba(245,158,11,0.25)', Low: 'rgba(16,185,129,0.25)' };
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', background: bg[priority], border: `1px solid ${border[priority]}`, borderRadius: 10, marginBottom: 10 }}>
      <div style={{ color: colours[priority], flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.78rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', lineHeight: 1.6, margin: 0 }}>{text}</p>
      </div>
      <span style={{ fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', color: colours[priority], background: `${colours[priority]}20`, padding: '2px 7px', borderRadius: 4, alignSelf: 'flex-start', flexShrink: 0 }}>{priority}</span>
    </div>
  );
};

export default function BriefPage() {
  const kpi       = useStore(s => s.kpi);
  const health    = useStore(s => s.health);
  const anomalies = useStore(s => s.anomalies);
  const breakeven = useStore(s => s.breakeven);
  const cashflow  = useStore(s => s.cashflow);
  const monthly   = useStore(s => s.monthly);
  const forecast  = useStore(s => s.forecast).filter(f => f.forecast);

  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const today  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const q4Rev  = monthly.slice(9).reduce((s, m) => s + m.revenue, 0);
  const q3Rev  = monthly.slice(6, 9).reduce((s, m) => s + m.revenue, 0);
  const q4QoQ  = ((q4Rev - q3Rev) / q3Rev * 100).toFixed(1);

  const handleCopy = async () => {
    const text = `AI-BOS Strategic Brief — ${today}\n\nRevenue: ${formatCurrency(kpi.totalRevenue)}\nNet Profit: ${formatCurrency(kpi.netProfit)}\nAvg Margin: ${kpi.avgMargin}%\nHealth Score: ${health.score}/100\nCash Runway: ${cashflow.runway} months`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 1200));
    setExporting(false);
    // In production: trigger PDF generation via API
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* Brief header */}
      <Card delay={0}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16,185,129,0.5)', animation: 'pulse 2s ease-in-out infinite' }}/>
              <span style={{ fontSize: '0.62rem', fontFamily: 'DM Mono, monospace', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI-Generated · Updated {today}</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#e2eeff', margin: '0 0 6px', letterSpacing: '-0.025em' }}>
              Strategic Financial Brief
            </h1>
            <p style={{ fontSize: '0.78rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0 }}>
              Full-year performance review · AI-powered insights · Executive summary
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              onClick={handleCopy}
              style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(99,179,237,0.2)', background: 'transparent', color: copied ? '#10b981' : '#4a6285', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', cursor: 'pointer', transition: 'all .2s' }}
            >
              {copied ? '✓ Copied' : 'Copy Brief'}
            </button>
            <button
              onClick={handleExport}
              style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#60a5fa,#06b6d4)', color: '#03060d', fontSize: '0.75rem', fontFamily: 'DM Mono, monospace', cursor: 'pointer', fontWeight: 600 }}
            >
              {exporting ? 'Generating…' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Health score bar */}
        <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flexShrink: 0 }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: health.colour }}>{health.score}</span>
            <span style={{ fontSize: '0.78rem', fontFamily: 'DM Mono, monospace', color: '#4a6285' }}>/100</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: 'rgba(99,179,237,0.1)', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${health.score}%` }} transition={{ duration: 1.2, delay: 0.3 }} style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${health.colour}, #06b6d4)` }}/>
            </div>
            <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0 }}>Financial Health Score — {health.label}</p>
          </div>
        </div>
      </Card>

      {/* Main brief */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

        {/* Left column: full narrative */}
        <Card delay={0.08}>
          <BriefSection icon={<span style={{fontSize:'11px'}}>📊</span>} title="Executive Summary" delay={0.1}>
            <Insight colour="#60a5fa" text={`Full-year revenue reached ${formatCurrency(kpi.totalRevenue)}, representing an 18.4% YoY increase. Net profit was ${formatCurrency(kpi.netProfit)} at an average margin of ${kpi.avgMargin}%.`}/>
            <Insight colour="#60a5fa" text={`Q4 was the strongest quarter on record, with December generating ${formatCurrency(monthly[11].profit)} in net profit — the highest single-month result. Q4 revenue of ${formatCurrency(q4Rev, true)} was ${q4QoQ}% above Q3.`}/>
            <Insight colour="#f59e0b" text={`Q3 underperformed due to a critical cost anomaly in September (operating costs +34% vs budget, z-score 3.8σ). This depressed Q3 margins to an average of 27.1% vs Q2's 32.2%.`}/>
            <Insight colour="#10b981" text={`The business is above breakeven with a ${formatCurrency(breakeven.gap, true)} safety margin (${((breakeven.gap / breakeven.breakevenRevenue) * 100).toFixed(0)}%). Contribution margin stands at ${breakeven.contributionMargin}%.`}/>
          </BriefSection>

          <BriefSection icon={<span style={{fontSize:'11px'}}>💰</span>} title="Revenue Performance" delay={0.15}>
            <Insight colour="#60a5fa" text={`Revenue grew in 9 of 12 months. The three months of decline (April, June, September) were linked to specific operational events rather than structural demand weakness.`}/>
            <Insight colour="#60a5fa" text={`The revenue CAGR implied by the trajectory is approximately 18–22% annualised. Forward forecast for Q1 next year is ${formatCurrency(forecast[0]?.forecast ?? 281000, true)} (base case), with a 95% confidence interval of ${formatCurrency(forecast[0]?.lower ?? 255000, true)}–${formatCurrency(forecast[0]?.upper ?? 307000, true)}.`}/>
          </BriefSection>

          <BriefSection icon={<span style={{fontSize:'11px'}}>⚠️</span>} title="Risk Factors" delay={0.2}>
            <Insight colour="#ef4444" text={`September cost spike remains unresolved. At 3.8σ deviation, this is a statistically significant outlier. Root cause analysis is recommended — vendor contracts, payroll, or one-off capital expenditure should be investigated.`}/>
            <Insight colour="#f59e0b" text={`Cash runway is 14 months at current burn rate — below the 18-month target. While Q4 revenue growth should improve this, management should maintain a contingency plan if Q1 growth disappoints.`}/>
            <Insight colour="#f59e0b" text={`Margin volatility is high (range: 22.8%–36.0%). Stabilising margins above 30% requires consistent cost management, particularly in variable cost categories.`}/>
          </BriefSection>

          <BriefSection icon={<span style={{fontSize:'11px'}}>🚀</span>} title="Strategic Recommendations" delay={0.25}>
            <Rec priority="High"   icon={<span style={{fontSize:'12px'}}>🔍</span>} text="Conduct a full root-cause analysis on the September operating cost spike. Implement real-time cost monitoring with automated alerts at ±15% budget variance."/>
            <Rec priority="High"   icon={<span style={{fontSize:'12px'}}>💵</span>} text={`Increase cash runway from ${cashflow.runway} to 18+ months. Options: accelerate Q1 revenue, negotiate extended payment terms with key vendors, or explore a working capital facility.`}/>
            <Rec priority="Medium" icon={<span style={{fontSize:'12px'}}>📈</span>} text="Capitalise on Q4 momentum. Q4 is the strongest quarter — identify the demand drivers and replicate them in Q1. Sales pipeline review recommended by January."/>
            <Rec priority="Medium" icon={<span style={{fontSize:'12px'}}>📊</span>} text={`Set a margin floor of 30%. April, June, and September all breached this. Implement margin-based pricing reviews when revenue growth slows below 5% MoM.`}/>
            <Rec priority="Low"    icon={<span style={{fontSize:'12px'}}>📉</span>} text="Review contribution margin quarterly. At 60.3%, there is room to optimise variable cost ratios through procurement efficiency or product mix optimisation."/>
          </BriefSection>

          {/* Remove last border */}
          <BriefSection icon={<span style={{fontSize:'11px'}}>🔮</span>} title="Forward Outlook" delay={0.3}>
            <Insight colour="#a78bfa" text={`Base case: Q1 next year revenue of ${formatCurrency(forecast[0]?.forecast ?? 281000, true)}, growing to ${formatCurrency(forecast[2]?.forecast ?? 314000, true)} by Q1 end. Full-year implied revenue: $3.2M–$3.6M.`}/>
            <Insight colour="#a78bfa" text={`Bull case scenario (variable costs -10%): breakeven drops to ${formatCurrency(133000, true)}, safety margin widens significantly, runway extends to 18+ months by Q2.`}/>
            <Insight colour="#f59e0b" text="Key risk to watch: if the September cost pattern recurs in Q1, it would compress Q1 margins to ~24% and delay the runway improvement target by 2–3 months."/>
          </BriefSection>
        </Card>

        {/* Right column: metrics sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Card delay={0.12} style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Key Metrics</h3>
            <Metric label="Total Revenue"    value={formatCurrency(kpi.totalRevenue, true)} colour="#60a5fa"/>
            <Metric label="Total Costs"      value={formatCurrency(kpi.totalCosts, true)}   colour="#f59e0b"/>
            <Metric label="Net Profit"       value={formatCurrency(kpi.netProfit, true)}     colour="#10b981"/>
            <Metric label="Avg Net Margin"   value={`${kpi.avgMargin}%`}                     colour="#a78bfa"/>
            <Metric label="YoY Growth"       value="+18.4%"                                   colour="#10b981"/>
            <Metric label="Best Month"       value={`Dec (${formatCurrency(96000, true)})`}   colour="#10b981"/>
            <Metric label="Worst Margin"     value="Sep (22.8%)"                              colour="#ef4444"/>
            <Metric label="Cash Runway"      value={`${cashflow.runway} months`}              colour="#06b6d4"/>
            <Metric label="Breakeven Rev."   value={formatCurrency(breakeven.breakevenRevenue, true)} colour="#f59e0b"/>
            <Metric label="Safety Margin"    value={formatCurrency(breakeven.gap, true)}      colour="#10b981"/>
            <Metric label="Contrib. Margin"  value={`${breakeven.contributionMargin}%`}       colour="#10b981"/>
            <Metric label="Anomalies"        value={`${anomalies.length} detected`}            colour="#ef4444"/>
          </Card>

          <Card delay={0.16} style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Q1 Forecast</h3>
            {forecast.slice(0, 3).map((f, i) => (
              <div key={f.month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid rgba(99,179,237,0.05)' }}>
                <span style={{ fontSize: '0.72rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{f.month}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.82rem', color: '#a78bfa', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{formatCurrency(f.forecast!, true)}</div>
                  <div style={{ fontSize: '0.58rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(f.lower!, true)}–{formatCurrency(f.upper!, true)}</div>
                </div>
              </div>
            ))}
          </Card>

          <Card delay={0.2} style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alert Summary</h3>
            {Object.entries(severityConfig).slice(0, 4).map(([key, cfg]) => {
              const count = useStore.getState().alerts.filter(a => a.severity === key).length;
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(99,179,237,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.colour, boxShadow: `0 0 6px ${cfg.colour}60` }}/>
                    <span style={{ fontSize: '0.72rem', color: '#4a6285', fontFamily: 'DM Mono, monospace' }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: count > 0 ? cfg.colour : '#2d4a70' }}>{count}</span>
                </div>
              );
            })}
          </Card>

          {/* AI confidence stamp */}
          <div style={{ padding: '14px 16px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 12, textAlign: 'center' }}>
            <p style={{ fontSize: '0.62rem', fontFamily: 'DM Mono, monospace', color: '#60a5fa', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Analysis Confidence</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: '#60a5fa', margin: '0 0 4px' }}>94.3%</p>
            <p style={{ fontSize: '0.6rem', fontFamily: 'DM Mono, monospace', color: '#4a6285', margin: 0 }}>Based on 12-month dataset · {monthly.length * 3} data points</p>
          </div>
        </div>
      </div>
    </div>
  );
}
