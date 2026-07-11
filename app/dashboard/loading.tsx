// Route-level loading state for dashboard pages (audit F-03): a skeleton that
// mirrors the real Overview layout (KPI grid + main columns) instead of a
// spinner, so the page appears to assemble rather than stall. Uses the global
// `.skeleton` shimmer, which freezes under prefers-reduced-motion.

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your dashboard">
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 180, height: 28 }} />
        <div className="skeleton" style={{ width: 280, height: 13, marginTop: 10 }} />
      </div>

      {/* KPI card row */}
      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi-card">
            <div className="skeleton" style={{ width: '55%', height: 12, marginBottom: 14 }} />
            <div className="skeleton" style={{ width: '70%', height: 30, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '40%', height: 12 }} />
          </div>
        ))}
      </div>

      {/* Main two-column layout */}
      <div className="grid-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="section-card">
            <div className="skeleton" style={{ width: 200, height: 16, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: '100%', height: 190 }} />
          </div>
          <div className="section-card">
            <div className="skeleton" style={{ width: 240, height: 16, marginBottom: 16 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ width: '100%', height: 52, marginBottom: 10 }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-card">
            <div className="skeleton" style={{ width: 160, height: 16, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: '100%', height: 120 }} />
          </div>
          <div className="section-card">
            <div className="skeleton" style={{ width: 130, height: 16, marginBottom: 16 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ width: '100%', height: 44, marginBottom: 8 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
