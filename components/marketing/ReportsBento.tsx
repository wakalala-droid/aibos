'use client';

// The reports, as the kit's bento with the kit's own figures: a forecast in
// the brand line and greys, an unusual cost as a row with the one red figure,
// breakeven on a meter, best customers as a bar list and the file read-out.
// Sample numbers; every chart colour comes from --chart-* (one palette).

import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts';
import { TrendingUp, TriangleAlert, Scale, Trophy, FileSearch } from 'lucide-react';
import { BentoCard, ChartKey } from '@/components/kit';
import Rise, { useInView } from '@/components/marketing/Rise';

// Six months as recorded, then three forecast with the range around them.
const FORECAST = [
  { hist: 198000 }, { hist: 214500 }, { hist: 231000 }, { hist: 248000 }, { hist: 263000 },
  { hist: 284500, fcast: 284500, range: [284500, 284500] },
  { fcast: 299500, range: [275540, 323460] },
  { fcast: 314500, range: [289340, 339660] },
  { fcast: 329500, range: [303140, 355860] },
];

const CUSTOMERS = [
  { name: 'Lusaka Hotels', amount: 'K38,400', share: 100 },
  { name: 'Mwila Catering', amount: 'K21,950', share: 57 },
  { name: 'Grace Banda', amount: 'K9,120', share: 24 },
];

const READ_OUT = [
  ['“Amt” is your sales', '98% sure'],
  ['“Paid by” is how they paid', '91% sure'],
  ['“Notes” has no money in it', 'Skipped'],
] as const;

export default function ReportsBento() {
  // Seen once: the cards rise, the forecast line draws in, the fills grow.
  const [gridRef, seen] = useInView<HTMLDivElement>();
  const draw = seen === 'in';
  const empty = seen === 'wait';
  return (
    <section id="reports" className="mkt-section" aria-labelledby="reports-h" style={{ paddingTop: 0 }}>
      <div className="mkt-wrap">
        <Rise className="mkt-head">
          <div>
            <p className="mkt-eyebrow">Reports</p>
            <h2 id="reports-h" className="mkt-h2">Numbers that show their working.</h2>
          </div>
          <p className="mkt-head-sub">
            Forecasts, warnings and breakeven from your own records, in plain words. Each one says
            what to do next. Free shows a preview of every report.
          </p>
        </Rise>

        <div ref={gridRef} className="bento-grid mkt-grow" data-rise={seen} data-rise-mode="stagger">
          <BentoCard
            className="span-4 rows-2"
            icon={<TrendingUp />}
            title="Forecast"
            tag="Pro"
            text="Your next three months from your own history, with the range shown, never a single made-up number."
          >
            <div style={{ marginTop: 20 }}>
              <ChartKey items={[['var(--chart-1)', 'Your last six months'], ['var(--chart-muted)', 'The next three', true]]} />
              <div role="img" aria-label="Sales rising from K198,000 to K284,500 over six months, forecast to reach about K329,500 in three months, between K303,000 and K356,000."
                style={{ height: 240, marginTop: 12 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart key={draw ? 'draw' : 'rest'} data={FORECAST} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
                    <defs>
                      <linearGradient id="mkt-fc-hist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.26} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={['dataMin - 20000', 'dataMax + 10000']} />
                    <Area type="monotone" dataKey="range" stroke="none" fill="var(--chart-muted)" fillOpacity={0.14} isAnimationActive={draw} animationBegin={1100} animationDuration={700} animationEasing="ease-out" connectNulls />
                    <Area type="monotone" dataKey="hist" stroke="var(--chart-1)" strokeWidth={2} fill="url(#mkt-fc-hist)" isAnimationActive={draw} animationBegin={250} animationDuration={1100} animationEasing="ease-out" dot={false} connectNulls />
                    <Area type="monotone" dataKey="fcast" stroke="var(--chart-muted)" strokeWidth={2} strokeDasharray="6 4" fill="none" isAnimationActive={draw} animationBegin={1100} animationDuration={700} animationEasing="ease-out" dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </BentoCard>

          <BentoCard
            className="span-2"
            icon={<TriangleAlert />}
            title="Unusual spending"
            tag="Pro"
            text="Caught the day your numbers land, with the likely cause."
          >
            <div className="row" style={{ marginTop: 12 }}>
              <span className="row-main">
                <span className="row-title">Transport</span>
                <span className="row-sub">Up 64% on a usual month. Fuel was bought twice on the 14th.</span>
              </span>
              <span className="row-amount tone-bad">+K2,180</span>
            </div>
          </BentoCard>

          <BentoCard
            className="span-2"
            icon={<Scale />}
            title="Breakeven"
            tag="Pro"
            text="K182,400 a month covers your costs. You are K32,100 above it."
          >
            <div style={{ marginTop: 20 }}>
              <div className="meter" role="img" aria-label="Sales of K214,500 a month against a breakeven of K182,400">
                <span className="meter-fill" style={{ width: empty ? '0%' : '86%' }} />
                <span className="meter-mark" style={{ left: '73%' }} />
              </div>
            </div>
          </BentoCard>

          <BentoCard
            className="span-3"
            icon={<Trophy />}
            title="Best customers"
            tag="Pro"
            text="Who brings the money in. Who has gone quiet and is worth a call."
          >
            <ul className="bar-list" style={{ marginTop: 16 }}>
              {CUSTOMERS.map((c) => (
                <li key={c.name}>
                  <span className="bar-name">{c.name}</span>
                  <span className="bar-figure">{c.amount}</span>
                  <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ display: 'block', width: `${empty ? 0 : c.share}%` }} /></span>
                </li>
              ))}
            </ul>
          </BentoCard>

          <BentoCard
            className="span-3"
            icon={<FileSearch />}
            title="It shows its working"
            tag="Every plan"
            text="Before any answer, AIBOS says how it read your file. When your data cannot answer, it says so."
          >
            <div style={{ marginTop: 12 }}>
              {READ_OUT.map(([what, sure]) => (
                <div key={what} className="row" style={{ minHeight: 44 }}>
                  <span className="row-main"><span className="row-title" style={{ fontWeight: 500 }}>{what}</span></span>
                  <span className="bento-tag" style={{ marginLeft: 0 }}>{sure}</span>
                </div>
              ))}
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
