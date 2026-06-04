'use client';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  label: string;
  sublabel?: string;
  value: string;
  sub?: string;
  growth?: number;
  icon?: React.ReactNode;
  iconBg?: string;
  sparkData?: number[];
  sparkColor?: string;
  delay?: number;
}

export default function KPICard({
  label, sublabel, value, sub = 'vs prior period',
  growth, icon, iconBg = 'rgba(96,165,250,0.15)',
  sparkData, sparkColor = '#60a5fa', delay = 0,
}: KPICardProps) {
  const spark = sparkData?.map((v, i) => ({ v, i }));

  return (
    <motion.div
      className="kpi-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {/* Top row: icon + label + growth badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <div
              className="kpi-icon"
              style={{ background: iconBg }}
            >
              {icon}
            </div>
          )}
          <div>
            <p className="kpi-label" style={{ margin: 0 }}>{label}</p>
            {sublabel && (
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'var(--text-4)', margin: 0 }}>
                {sublabel}
              </p>
            )}
          </div>
        </div>
        {growth !== undefined && (
          <span className={`kpi-badge ${growth >= 0 ? 'up' : 'down'}`}>
            {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <p className="kpi-value">{value}</p>

      {/* Sub + sparkline row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <p className="kpi-sub">{sub}</p>
        {spark && spark.length > 1 && (
          <div style={{ width: 90, height: 40, marginBottom: -4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
