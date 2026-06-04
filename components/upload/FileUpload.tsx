'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { BusinessType } from '@/lib/api';

const BIZ_TYPES: { value: BusinessType; label: string; sub: string }[] = [
  { value: 'QSR',         label: 'Restaurant / QSR', sub: 'Fast food, casual dining' },
  { value: 'Retail',      label: 'Retail',            sub: 'Shops, supermarkets'     },
  { value: 'Services',    label: 'Services',           sub: 'Professional services'   },
  { value: 'Hospitality', label: 'Hospitality',        sub: 'Hotels, lodges'          },
];

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api/proxy'
    : 'http://localhost:8000');

type Step = 'idle' | 'pick-type' | 'uploading' | 'done' | 'error';

export default function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep]     = useState<Step>('idle');
  const [bizType, setBizType] = useState<BusinessType>('QSR');
  const [file, setFile]     = useState<File | null>(null);
  const [progress, setProg] = useState(0);
  const [errMsg, setErrMsg] = useState('');
  const [dragOver, setDrag] = useState(false);

  const { hydrateFromUpload, setCurrency, setUploadedFile, setLoading, setBusinessType } = useStore();

  const onFile = useCallback((f: File) => {
    setFile(f);
    setStep('pick-type');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = '';
  }, [onFile]);

  const doUpload = useCallback(async () => {
    if (!file) return;
    setStep('uploading'); setProg(0); setErrMsg('');
    setLoading(true); setBusinessType(bizType);

    const ticker = setInterval(() => setProg(p => Math.min(p + 5, 88)), 300);

    try {
      const params = new URLSearchParams({
        current_cash: '50000', months_ahead: '3',
        z_threshold: '2.0', fixed_cost_pct: '0.40',
        business_type: bizType,
      });
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`${API}/upload?${params}`, { method: 'POST', body: form });

      clearInterval(ticker); setProg(100);

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        // Parse FastAPI detail
        let detail = errText;
        try { detail = JSON.parse(errText)?.detail ?? errText; } catch {}
        throw new Error(detail);
      }

      const result = await res.json();
      hydrateFromUpload(result);
      setCurrency(result.currency ?? 'ZMW', result.currency_symbol ?? 'K');
      setUploadedFile(file.name);
      setStep('done');
      setTimeout(() => setStep('idle'), 3000);
    } catch (err: any) {
      clearInterval(ticker);
      setErrMsg(err?.message ?? 'Upload failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [file, bizType, hydrateFromUpload, setCurrency, setUploadedFile, setLoading, setBusinessType]);

  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onInput} style={{ display: 'none' }} />
      <AnimatePresence mode="wait">

        {/* IDLE */}
        {step === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--cyan)' : 'var(--border-md)'}`,
                borderRadius: 10, padding: '28px 20px', cursor: 'pointer', textAlign: 'center',
                background: dragOver ? 'var(--cyan-dim)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--text-3)' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 4px' }}>
                Drop file or click to browse
              </p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-3)', margin: 0 }}>
                CSV · XLSX · XLS · max 50MB
              </p>
            </div>
          </motion.div>
        )}

        {/* PICK TYPE */}
        {step === 'pick-type' && (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-3)', margin: '0 0 10px' }}>
              📄 {file?.name}
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 12px' }}>
              Business type
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {BIZ_TYPES.map(bt => (
                <button
                  key={bt.value}
                  onClick={() => setBizType(bt.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: bizType === bt.value ? 'var(--cyan-dim)' : 'var(--bg-badge)',
                    border: `1px solid ${bizType === bt.value ? 'var(--cyan)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 600, color: bizType === bt.value ? 'var(--cyan)' : 'var(--text-1)', margin: '0 0 2px' }}>{bt.label}</p>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-4)', margin: 0 }}>{bt.sub}</p>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep('idle'); setFile(null); }}
                style={{ flex: '0 0 auto', padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border-md)', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                Back
              </button>
              <button onClick={doUpload}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #0097b2, #00d4ff)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                Analyse →
              </button>
            </div>
          </motion.div>
        )}

        {/* UPLOADING */}
        {step === 'uploading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '20px 0' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border-md)', borderTop: '2px solid var(--cyan)', margin: '0 auto 12px' }}
            />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)', margin: '0 0 12px' }}>Analysing…</p>
            <div className="progress-track">
              <motion.div className="progress-fill" style={{ background: 'var(--cyan)' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </motion.div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green-dim)', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: 'var(--good)', margin: '0 0 4px' }}>Analysis complete</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-3)', margin: 0 }}>{file?.name}</p>
          </motion.div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--red-dim)', border: '1px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16v.5" stroke="var(--crit)" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: 'var(--crit)', margin: '0 0 6px' }}>Analysis failed</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.5 }}>{errMsg}</p>
            <button onClick={() => { setStep('idle'); setFile(null); setErrMsg(''); }}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--crit)', background: 'var(--red-dim)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--crit)' }}>
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
