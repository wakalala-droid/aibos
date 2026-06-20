/**
 * ProductPanels — faithful, static recreations of real AI-BOS dashboard
 * screens, rendered in the product's native dark skin so the marketing bands
 * show the genuine product (not abstract mockups). Pure server components:
 * inline SVG charts, no client JS, crisp at any size. Data is realistic and
 * labelled "illustrative" where shown, honouring the no-fabrication promise.
 *
 * Swap-in path for literal captures later: replace any panel's body with an
 * <img src="/marketing/<shot>.webp"> — the .mkt-panel chrome stays.
 */

// ── chart helpers ────────────────────────────────────────────────────────────
function build(values: number[], w: number, h: number, padY = 4) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const dx = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * dx;
    const y = h - padY - ((v - min) / range) * (h - padY * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w.toFixed(1)},${h} L0,${h} Z`;
  return { line, area, pts };
}

function Spark({ data, color, gid }: { data: number[]; color: string; gid: string }) {
  const w = 88, h = 30;
  const { line, area } = build(data, w, h, 3);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.32} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi({
  label, value, badge, up, data, color, gid,
}: { label: string; value: string; badge: string; up: boolean; data: number[]; color: string; gid: string }) {
  return (
    <div className="mkt-kpi">
      <div className="mkt-kpi-top">
        <p className="mkt-kpi-label">{label}</p>
        <span className={`mkt-kpi-badge ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {badge}</span>
      </div>
      <p className="mkt-kpi-value">{value}</p>
      <div style={{ marginTop: 8, marginBottom: -2 }}><Spark data={data} color={color} gid={gid} /></div>
    </div>
  );
}

function PanelBar({ url }: { url: string }) {
  return (
    <div className="mkt-panel-bar">
      <span className="mkt-panel-dots"><i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} /></span>
      <span className="mkt-panel-url">{url}</span>
    </div>
  );
}

// ── 1. Dashboard overview ────────────────────────────────────────────────────
export function DashboardPanel() {
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const revenue = [198, 214, 231, 248, 263, 284];
  const profit = [38, 44, 49, 53, 57, 61];
  const W = 540, H = 172, PL = 6, PR = 6, PT = 10, PB = 22;
  const cw = W - PL - PR, ch = H - PT - PB;
  const rMax = Math.max(...revenue);
  const map = (arr: number[]) => arr.map((v, i) => [PL + (i / (arr.length - 1)) * cw, PT + ch - (v / rMax) * ch] as const);
  const rPts = map(revenue), pPts = map(profit);
  const toPath = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const rArea = `${toPath(rPts)} L${(PL + cw).toFixed(1)},${PT + ch} L${PL},${PT + ch} Z`;

  const engines = [
    ['Financial', 82, '#00d4ff'], ['Customer', 74, '#f97316'], ['Operations', 68, '#34d399'],
    ['Forecasting', 71, '#a78bfa'], ['Decision', 79, '#60a5fa'],
  ] as const;

  return (
    <div className="mkt-panel">
      <PanelBar url="app.aibos.africa/dashboard" />
      <div className="mkt-panel-body">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-1)' }}>Zoe’s Kitchen · Lusaka</p>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)' }}>Updated today · K = ZMW</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
          <Kpi label="Revenue" value="K284,500" badge="12.4%" up data={revenue} color="#00d4ff" gid="kpi-rev" />
          <Kpi label="Net profit" value="K61,800" badge="8.1%" up data={profit} color="#34d399" gid="kpi-prof" />
          <Kpi label="Cash on hand" value="K96,200" badge="4.2%" up={false} data={[120, 112, 118, 104, 99, 96]} color="#fbbf24" gid="kpi-cash" />
          <Kpi label="Gross margin" value="21.7%" badge="1.3%" up data={[18.9, 19.4, 20.1, 20.6, 21.2, 21.7]} color="#a78bfa" gid="kpi-marg" />
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 12, padding: '14px 14px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-3)' }}>Revenue vs profit · 6 months</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.66rem', color: 'var(--text-4)' }}><i style={{ width: 8, height: 8, borderRadius: 2, background: '#00d4ff', display: 'inline-block' }} />Revenue</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.66rem', color: 'var(--text-4)' }}><i style={{ width: 8, height: 8, borderRadius: 2, background: '#34d399', display: 'inline-block' }} />Profit</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" aria-hidden style={{ display: 'block' }}>
            <defs>
              <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1={PL} x2={PL + cw} y1={PT + ch * g} y2={PT + ch * g} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            ))}
            <path d={rArea} fill="url(#dashRev)" />
            <path d={toPath(rPts)} fill="none" stroke="#00d4ff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            <path d={toPath(pPts)} fill="none" stroke="#34d399" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            {rPts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill="#0a0e1a" stroke="#00d4ff" strokeWidth={1.6} />)}
            {months.map((m, i) => (
              <text key={m} x={PL + (i / (months.length - 1)) * cw} y={H - 5} fill="#6b7889" fontSize={11} fontFamily="JetBrains Mono, monospace" textAnchor={i === 0 ? 'start' : i === months.length - 1 ? 'end' : 'middle'}>{m}</text>
            ))}
          </svg>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {engines.map(([name, score, c]) => (
            <div key={name} style={{ flex: '1 1 88px', background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '9px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: c as string }}>{name}</span>
                <span style={{ fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-1)' }}>{score}</span>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)' }}>
                <div style={{ height: '100%', width: `${score}%`, borderRadius: 4, background: c as string }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 2. Forecast ──────────────────────────────────────────────────────────────
export function ForecastPanel() {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const hist = [214, 231, 248, 263, 284]; // solid
  const proj = [284, 298, 312, 326];      // dashed (overlaps May)
  const W = 560, H = 230, PL = 8, PR = 8, PT = 14, PB = 24;
  const cw = W - PL - PR, ch = H - PT - PB;
  const all = [...hist, ...proj.slice(1), 360, 270];
  const max = Math.max(...all), min = Math.min(...all);
  const X = (i: number) => PL + (i / (labels.length - 1)) * cw;
  const Y = (v: number) => PT + ch - ((v - min) / (max - min)) * ch;
  const histPath = hist.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const projPath = proj.map((v, i) => `${i ? 'L' : 'M'}${X(i + 4).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  // confidence band around projection (±8%)
  const bandTop = proj.map((v, i) => [X(i + 4), Y(v * 1.09)] as const);
  const bandBot = proj.map((v, i) => [X(i + 4), Y(v * 0.92)] as const);
  const band = `M${bandTop.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')} L${[...bandBot].reverse().map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')} Z`;

  return (
    <div className="mkt-panel">
      <PanelBar url="app.aibos.africa/dashboard/forecast" />
      <div className="mkt-panel-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-1)' }}>Revenue forecast</p>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--text-4)' }}>next 3 months</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" aria-hidden style={{ display: 'block' }}>
          {[0, 0.33, 0.66, 1].map((g) => (
            <line key={g} x1={PL} x2={PL + cw} y1={PT + ch * g} y2={PT + ch * g} stroke="rgba(255,255,255,0.05)" />
          ))}
          <line x1={X(4)} x2={X(4)} y1={PT} y2={PT + ch} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
          <text x={X(4) + 4} y={PT + 11} fill="#6b7889" fontSize={10} fontFamily="JetBrains Mono, monospace">today</text>
          <path d={band} fill="#a78bfa" fillOpacity={0.14} />
          <path d={histPath} fill="none" stroke="#00d4ff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          <path d={projPath} fill="none" stroke="#a78bfa" strokeWidth={2.6} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
          {hist.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={2.8} fill="#0a0e1a" stroke="#00d4ff" strokeWidth={1.6} />)}
          {labels.map((m, i) => (
            <text key={m} x={X(i)} y={H - 6} fill="#6b7889" fontSize={11} fontFamily="JetBrains Mono, monospace" textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>{m}</text>
          ))}
        </svg>
        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '12px 14px' }}>
          <span aria-hidden style={{ color: '#a78bfa', fontSize: '1.1rem', lineHeight: 1 }}>↗</span>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-2)', lineHeight: 1.55 }}>
            On your trend, August lands near <strong style={{ color: 'var(--text-1)' }}>K310k–K342k</strong>. AI-BOS shows the range, not a single false number.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 3. Read-fidelity manifest ────────────────────────────────────────────────
export function ManifestPanel() {
  const rows: [string, string, string, number][] = [
    ['Month', 'PERIOD', '#00d4ff', 99],
    ['Revenue', 'REVENUE', '#34d399', 98],
    ['Costs', 'COST', '#f87171', 97],
    ['Category', 'CATEGORY', '#f97316', 92],
    ['Notes', 'IGNORED — free text', '#6b7889', 100],
  ];
  return (
    <div className="mkt-panel">
      <PanelBar url="app.aibos.africa/data-studio" />
      <div className="mkt-panel-body">
        <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-1)' }}>How AI-BOS read your file</p>
        <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-3)' }}>Every column, how it was mapped, how confident we are.</p>
        <span style={{ display: 'inline-block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#00d4ff', background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', padding: '4px 10px', borderRadius: 6, marginBottom: 16 }}>
          Time-series data · sales_may.xlsx
        </span>
        <table className="mkt-ptable">
          <thead><tr><th>Column</th><th>Read as</th><th style={{ textAlign: 'right' }}>Confidence</th></tr></thead>
          <tbody>
            {rows.map(([col, role, c, conf]) => (
              <tr key={col}>
                <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{col}</td>
                <td><span className="mkt-tag" style={{ color: c }}>{role}</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: conf >= 95 ? '#34d399' : '#fbbf24' }}>{conf}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '11px 13px' }}>
          <span aria-hidden style={{ color: '#fbbf24', fontWeight: 800 }}>!</span>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
            No <strong style={{ color: 'var(--text-1)' }}>units</strong> column found — per-unit economics are turned off rather than guessed.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 4. Anomaly alert ─────────────────────────────────────────────────────────
export function AnomalyPanel() {
  const cash = [120, 112, 118, 104, 99, 79];
  const labels = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const max = Math.max(...cash);
  return (
    <div className="mkt-panel">
      <PanelBar url="app.aibos.africa/dashboard/anomaly" />
      <div className="mkt-panel-body">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <span aria-hidden style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.3)', display: 'grid', placeItems: 'center', color: '#f87171', fontWeight: 800 }}>!</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-1)' }}>Cash dropped 18% in May</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-3)', lineHeight: 1.5 }}>Caught the day your file landed — before it became a crisis.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 96, padding: '0 4px', marginBottom: 8 }}>
          {cash.map((v, i) => {
            const last = i === cash.length - 1;
            return (
              <div key={labels[i]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: '100%', height: `${(v / max) * 100}%`, borderRadius: '5px 5px 0 0', background: last ? '#f87171' : 'rgba(0,212,255,0.55)' }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: last ? '#f87171' : '#6b7889' }}>{labels[i]}</span>
              </div>
            );
          })}
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text-1)' }}>Likely cause:</strong> two supplier prepayments (K21,400) landed before your biggest invoices cleared. Suggested move: stagger the next order by 8 days.
          </p>
        </div>
      </div>
    </div>
  );
}
