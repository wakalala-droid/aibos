import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/components/marketing/Hero';
import AskAnything from '@/components/marketing/AskAnything';
import StrategicIntelligence from '@/components/marketing/StrategicIntelligence';
import Reveal from '@/components/marketing/Reveal';
import ShowcaseBand from '@/components/marketing/ShowcaseBand';
import AibosWindow from '@/components/marketing/AibosWindow';
import KPICard from '@/components/ui/KPICard';
import DataManifestCard from '@/components/ui/DataManifestCard';
import { ForecastChart, CashProjectionChart, RunwayBar, AnomalyZChart, SegmentDonut } from '@/components/ui/DashboardCharts';
import {
  DEMO_FORECAST, DEMO_CASH_PROJECTION, DEMO_RUNWAY, DEMO_ANOMALY_Z,
  DEMO_SEGMENTS, DEMO_RETENTION, DEMO_MANIFEST, DEMO_BREAKDOWN,
} from '@/lib/demoData';

export const metadata: Metadata = {
  title: 'AI-BOS — The brain behind every business',
  description:
    'Ask your business anything and get the answer, in Kwacha, instantly. AI-BOS reads your data and gives you a CFO, analyst and consultant in your pocket. Start free.',
  alternates: { canonical: '/' },
};

const TRUST_PILLS = ['Free to start', 'Priced in ZMW', 'MTN & Airtel Money', 'Upload & go', 'Your data stays yours'];

export default function MarketingHome() {
  return (
    <>
      <Hero />

      {/* Trust pills */}
      <div className="mkt-wrap" style={{ marginTop: 4, marginBottom: 8 }}>
        <Reveal>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {TRUST_PILLS.map((p) => (
              <li key={p} className="mkt-pill"><span className="dot" aria-hidden />{p}</li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* Strategic Intelligence — rising-graph divider + real Strategic Brief */}
      <StrategicIntelligence />

      {/* Ask anything — the loved CFO chat (dark) */}
      <AskAnything />

      {/* Forecast (light) — real ForecastChart */}
      <ShowcaseBand
        eyebrow="See around the corner"
        title="Know what’s coming, while you can still act."
        lead="AI-BOS projects your revenue from your own history and shows the range, not a fake single number. You see the strong month to ride, and the soft one to brace for."
        values={['Built only from your real data', 'A 95% confidence band, never false precision', 'Updates the moment you upload']}
        cta={{ label: 'Start free', href: '/login' }}
      >
        <AibosWindow>
          <p style={{ margin: '0 0 12px', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text-1)' }}>AI Revenue Forecast</p>
          <ForecastChart data={DEMO_FORECAST} sym="K" />
        </AibosWindow>
      </ShowcaseBand>

      {/* Cashflow (dark) — real RunwayBar + CashProjectionChart */}
      <ShowcaseBand
        dark
        eyebrow="Never get caught short"
        title="Know your runway to the day."
        lead="Stop finding out about a cash crunch when it hits. AI-BOS tracks your runway and projects your cash position forward, so a tight month becomes a warning you can act on weeks early."
        values={['Live runway against your target', 'Forward cash projection from your trend', 'Flags the month you dip before you do']}
      >
        <AibosWindow>
          <div style={{ marginBottom: 14 }}><RunwayBar runway={DEMO_RUNWAY} /></div>
          <p style={{ margin: '0 0 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)' }}>Projected cash position</p>
          <CashProjectionChart data={DEMO_CASH_PROJECTION} sym="K" />
        </AibosWindow>
      </ShowcaseBand>

      {/* Customers (light, reverse) — real SegmentDonut */}
      <ShowcaseBand
        reverse
        eyebrow="Know who really pays you"
        title="Your best customers, not just your busiest."
        lead="AI-BOS sorts every customer by what they’re actually worth, from the champions you should spotlight to the ones slipping away you can win back, so your time and your offers land where the money is."
        values={['RFM segments straight from your sales', 'Retention and churn risk surfaced', 'Who to keep, who to win back']}
        cta={{ label: 'Start free', href: '/login' }}
      >
        <AibosWindow>
          <p style={{ margin: '0 0 14px', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text-1)' }}>Customer Intelligence</p>
          <SegmentDonut segments={DEMO_SEGMENTS} />
          <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>Retention</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--good)', margin: 0 }}>{DEMO_RETENTION.rate}%</p>
            </div>
            <div>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>Returning</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--blue)', margin: 0 }}>{DEMO_RETENTION.returning}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.64rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>First-time</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-2)', margin: 0 }}>{DEMO_RETENTION.firstTime}</p>
            </div>
          </div>
        </AibosWindow>
      </ShowcaseBand>

      {/* Anomaly (dark) — real AnomalyZChart */}
      <ShowcaseBand
        dark
        eyebrow="Catch it early"
        title="Spot the problem before it costs you."
        lead="AI-BOS watches your numbers statistically and flags whatever breaks the pattern, whether it’s a cost spike or a margin slip, the day your file lands, with a likely cause and a next move."
        values={['Statistical anomaly detection', 'Critical vs warning, colour-coded', 'A cause and an action, not just a red number']}
      >
        <AibosWindow>
          <p style={{ margin: '0 0 12px', fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text-1)' }}>Z-Score Distribution</p>
          <AnomalyZChart data={DEMO_ANOMALY_Z} />
        </AibosWindow>
      </ShowcaseBand>

      {/* Manifest (light, reverse) — real DataManifestCard */}
      <ShowcaseBand
        reverse
        eyebrow="No black box"
        title="It shows its working."
        lead="Before any insight, AI-BOS tells you exactly how it read your file: every column, what it became, and how confident it is. When the data can’t answer, it says so."
        values={['A plain-English read-out of every file', 'Confidence shown on each column', 'Refuses to invent what isn’t there']}
      >
        <AibosWindow>
          <DataManifestCard manifest={DEMO_MANIFEST} breakdown={DEMO_BREAKDOWN} currencySymbol="K" />
        </AibosWindow>
      </ShowcaseBand>

      {/* Final CTA — climactic, with a real KPI strip */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal>
            <div className="mkt-card mkt-dark" style={{ textAlign: 'center', padding: 'clamp(44px, 6vw, 84px) clamp(24px, 5vw, 56px)', position: 'relative', overflow: 'hidden' }}>
              <span className="mkt-glow" style={{ top: '-35%', left: '50%', transform: 'translateX(-50%)', width: 520, height: 520, background: 'radial-gradient(circle, rgba(0,212,255,0.30), transparent 60%)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Real KPI strip */}
                <div data-theme="dark" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 620, margin: '0 auto 36px' }}>
                  <KPICard label="REVENUE" value="K284,500" growth={8.2} sub="vs last month" sparkData={[198000, 214500, 231000, 248000, 263000, 284500]} sparkColor="var(--spark-revenue)" delay={0} />
                  <KPICard label="NET PROFIT" value="K61,800" growth={10.4} sub="vs last month" sparkData={[39600, 45000, 49600, 53500, 56000, 61800]} sparkColor="var(--spark-profit)" delay={0.06} />
                  <KPICard label="CASH" value="K96,200" growth={-2.8} sub="vs last month" sparkData={[120000, 112000, 118000, 104000, 99000, 96200]} sparkColor="var(--cyan)" delay={0.12} />
                </div>
                <h2 className="mkt-h2" style={{ maxWidth: 640, marginInline: 'auto' }}>Ready to see your numbers think?</h2>
                <p className="mkt-lead" style={{ marginTop: 18, marginInline: 'auto', maxWidth: 500 }}>
                  This is your business, an hour after you upload. Start free on your own data and upgrade only when the value is obvious.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 32 }}>
                  <Link href="/login" className="mkt-btn mkt-btn-primary">Start free with your data</Link>
                  <Link href="/pricing" className="mkt-btn mkt-btn-secondary">See pricing</Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
