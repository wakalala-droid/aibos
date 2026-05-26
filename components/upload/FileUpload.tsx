'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { uploadFile } from '@/lib/api';

function UploadIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

interface FileUploadProps {
  compact?: boolean;
}

export function FileUpload({ compact = false }: FileUploadProps) {
  const [state, setState]       = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Store actions — update live data after upload
  const setUploadedFile = useStore(s => s.setUploadedFile);
  const updateData      = useStore(s => s.updateData);
  const setLoading      = useStore(s => s.setLoading);
  const setCurrency     = useStore(s => s.setCurrency);

  const ACCEPTED = ['.csv', '.xlsx', '.xls'];

  const validate = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) return 'Unsupported type. Use CSV or Excel.';
    if (file.size > 50 * 1024 * 1024) return 'File too large. Max 50MB.';
    return null;
  };

  const processFile = useCallback(async (file: File) => {
    const err = validate(file);
    if (err) { setState('error'); setErrorMsg(err); return; }

    setFilename(file.name);
    setState('uploading');
    setProgress(0);
    setLoading(true);

    // Animate progress bar while API call runs
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) { clearInterval(progressInterval); return prev; }
        return prev + Math.random() * 12;
      });
    }, 300);

    try {
      // ── Real API call to FastAPI /upload ──────────────────────────
      const result = await uploadFile(file, {
        current_cash:   50000,
        months_ahead:   3,
        z_threshold:    2.0,
        fixed_cost_pct: 0.40,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!result.ok) throw new Error('Analysis failed');

      // ── Map API response to store shape ───────────────────────────
      const monthly = (result.records as any[]).map((r: any) => ({
        month:      r.month,
        revenue:    Number(r.revenue)    || 0,
        costs:      Number(r.costs)      || 0,
        profit:     Number(r.profit)     || 0,
        margin:     Number(r.margin_pct) || 0,
      }));

      const pnl = result.pnl as any;

      const kpi = {
        totalRevenue:    Number(pnl.total_revenue)  || 0,
        totalCosts:      Number(pnl.total_costs)    || 0,
        netProfit:       Number(pnl.total_profit)   || 0,
        avgMargin:       Number(pnl.avg_margin)     || 0,
        varianceAlerts:  (result.alerts ?? []).length,
        cashRunway:      Number(result.runway_months) || 0,
        revenueDelta:    Number(pnl.revenue_delta)  || 0,
        costsDelta:      Number(pnl.costs_delta)    || 0,
        profitDelta:     Number(pnl.profit_delta)   || 0,
        marginDelta:     Number(pnl.margin_delta)   || 0,
      };

      const score  = result.health_score ?? 0;
      const label  = result.health_label ?? 'Healthy';
      const colour = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';

      // Best/worst month from monthly data
      const sortedByProfit = [...monthly].sort((a, b) => b.profit - a.profit);
      const bestMonth  = sortedByProfit[0];
      const worstMonth = sortedByProfit[sortedByProfit.length - 1];

      const health = {
        score,
        label:      label as any,
        colour,
        bestMonth:  bestMonth?.month  ?? '',
        bestValue:  bestMonth?.profit ?? 0,
        worstMonth: worstMonth?.month  ?? '',
        worstValue: worstMonth?.profit ?? 0,
      };

      // Map alerts
      const alerts = (result.alerts ?? []).map((a: any, i: number) => ({
        id:          String(i),
        severity:    (a.change_pct > 30 ? 'critical' : a.change_pct > 15 ? 'high' : 'medium') as any,
        title:       a.type ?? (a.direction === 'drop' ? 'Revenue drop' : 'Cost spike'),
        description: `${a.month}: ${Math.abs(a.change_pct).toFixed(1)}% ${a.direction}`,
        month:       a.month,
      }));

      // Map anomalies
      const anomalies = (result.anomalies ?? []).map((a: any, i: number) => ({
        id:       String(i),
        month:    a.month,
        field:    a.metric,
        value:    a.value     ?? 0,
        expected: a.expected  ?? 0,
        zScore:   a.z_score   ?? 0,
        severity: a.severity  ?? 'medium',
      }));

      // Map forecast
      const forecastRaw = (result.forecast as any)?.forecast ?? [];
      const forecastData = [
        ...monthly.map(m => ({ month: m.month, historical: m.revenue })),
        ...forecastRaw.map((f: any) => ({
          month:    f.month,
          forecast: f.predicted,
          lower:    f.low,
          upper:    f.high,
        })),
      ];

      // Map breakeven
      const be = result.breakeven as any;
      const breakeven = be ? {
        breakevenRevenue:      be.breakeven_revenue         ?? 0,
        currentRevenue:        be.current_avg_revenue       ?? 0,
        fixedCosts:            be.fixed_costs               ?? 0,
        variableCosts:         be.variable_costs            ?? 0,
        contributionMargin:    be.contribution_margin_ratio ? be.contribution_margin_ratio * 100 : 0,
        status:               (be.margin_of_safety > 0 ? 'above' : 'below') as any,
        gap:                   be.margin_of_safety          ?? 0,
      } : undefined;

      // Map cashflow — API now enriches with inflow/outflow/month
      const cfProjections = (result.cashflow ?? []).map((c: any) => ({
        month:   c.month ?? `M+${c.month_ahead ?? 1}`,
        cash:    Number(c.projected_cash) || 0,
        inflow:  Number(c.inflow)  || 0,
        outflow: Number(c.outflow) || 0,
      }));

      const avgBurn = monthly.length > 0
        ? monthly.slice(-3).reduce((s, m) => s + (m.costs || 0), 0) / Math.min(3, monthly.length)
        : 0;

      const cashflow = {
        runway:       Number(result.runway_months) || 0,
        currentCash:  50000,
        monthlyBurn:  avgBurn,
        projections:  cfProjections,
      };

      // ── Push everything to Zustand ────────────────────────────────
      updateData({
        monthly,
        kpi,
        health,
        alerts,
        anomalies,
        forecast:  forecastData,
        ...(breakeven ? { breakeven } : {}),
        cashflow,
      });

      setUploadedFile(file.name);
      setState('success');

    } catch (e: any) {
      clearInterval(progressInterval);
      console.error('[FileUpload] API error:', e);

      // Friendly error messages
      const msg = e.message ?? '';
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
        setErrorMsg('Cannot reach the API server. Check NEXT_PUBLIC_API_URL is set correctly.');
      } else if (msg.includes('422') || msg.includes('Missing columns')) {
        setErrorMsg('Wrong file format. Ensure your file has: month, revenue, costs columns.');
      } else {
        setErrorMsg(msg || 'Analysis failed. Please try again.');
      }
      setState('error');
    } finally {
      setLoading(false);
    }
  }, [setUploadedFile, updateData, setLoading]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const reset = () => {
    setState('idle');
    setProgress(0);
    setFilename(null);
    setErrorMsg(null);
    setUploadedFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const isDragging  = state === 'dragging';
  const isUploading = state === 'uploading';
  const isSuccess   = state === 'success';
  const isError     = state === 'error';

  const borderColour = isDragging ? 'rgba(96,165,250,0.7)'
    : isSuccess ? 'rgba(16,185,129,0.5)'
    : isError   ? 'rgba(239,68,68,0.5)'
    : 'rgba(99,179,237,0.18)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background:     'rgba(9,13,30,0.72)',
        backdropFilter: 'blur(16px)',
        border:         '1px solid rgba(99,179,237,0.12)',
        borderRadius:   16,
        padding:        compact ? 16 : 24,
        boxShadow:      '0 4px 24px rgba(0,0,0,0.3)',
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,179,237,0.3),transparent)' }} />

      {!compact && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>Upload Financial Data</h3>
          <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '3px 0 0' }}>
            CSV or Excel · month, revenue, costs columns required
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── Idle / Drag zone ──────────────────────────────────── */}
        {!isUploading && !isSuccess && !isError && (
          <motion.div
            key="drop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onDragOver={e => { e.preventDefault(); setState('dragging'); }}
            onDragLeave={() => setState('idle')}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border:       `2px dashed ${borderColour}`,
              borderRadius: 12,
              padding:      compact ? '20px 16px' : '36px 24px',
              background:   isDragging ? 'rgba(59,130,246,0.08)' : 'rgba(9,13,30,0.4)',
              textAlign:    'center',
              cursor:       'pointer',
              transition:   'all 0.2s ease',
            }}
          >
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFileChange} style={{ display: 'none' }} />
            <div style={{ color: isDragging ? '#60a5fa' : '#4a6285', marginBottom: 10, display: 'inline-block' }}>
              <UploadIcon />
            </div>
            <p style={{ fontSize: compact ? '0.78rem' : '0.88rem', fontWeight: 500, color: isDragging ? '#60a5fa' : '#d4ddf0', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px' }}>
              {isDragging ? 'Drop to analyse' : 'Drop file or click to browse'}
            </p>
            <p style={{ fontSize: '0.65rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace', margin: 0 }}>
              CSV · XLSX · XLS · max 50MB
            </p>
          </motion.div>
        )}

        {/* ── Uploading ─────────────────────────────────────────── */}
        {isUploading && (
          <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: '28px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '0.84rem', fontWeight: 500, color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260, marginInline: 'auto' }}>
              {filename}
            </p>
            <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 20px' }}>
              Running financial analysis…
            </p>
            <div style={{ background: 'rgba(99,179,237,0.1)', borderRadius: 999, height: 6, overflow: 'hidden', maxWidth: 280, marginInline: 'auto' }}>
              <motion.div
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#60a5fa,#06b6d4)' }}
              />
            </div>
            <p style={{ fontSize: '0.62rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', marginTop: 8 }}>
              {Math.round(Math.min(progress, 100))}%
            </p>
          </motion.div>
        )}

        {/* ── Success ───────────────────────────────────────────── */}
        {isSuccess && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ padding: '24px 0', textAlign: 'center' }}>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginInline: 'auto', marginBottom: 12, color: '#10b981' }}
            >
              <CheckIcon />
            </motion.div>
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: '0 0 2px' }}>
              Analysis Complete
            </p>
            <p style={{ fontSize: '0.68rem', color: '#10b981', fontFamily: 'DM Mono, monospace', margin: '0 0 4px' }}>{filename}</p>
            <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 16px' }}>
              Dashboard updated with your data
            </p>
            <button onClick={reset} style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 7, padding: '6px 16px', cursor: 'pointer' }}>
              Upload new file
            </button>
          </motion.div>
        )}

        {/* ── Error ─────────────────────────────────────────────── */}
        {isError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', marginBottom: 10, display: 'inline-block' }}><ErrorIcon /></div>
            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ef4444', fontFamily: 'Outfit, sans-serif', margin: '0 0 6px' }}>Upload Failed</p>
            <p style={{ fontSize: '0.7rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: '0 0 16px', maxWidth: 260, marginInline: 'auto', lineHeight: 1.5 }}>
              {errorMsg}
            </p>
            <button onClick={reset} style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 7, padding: '6px 16px', cursor: 'pointer' }}>
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
