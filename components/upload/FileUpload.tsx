'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { uploadFile } from '@/lib/api';
import { tokens } from '@/lib/utils';
import type { BusinessType } from '@/lib/api';

const BUSINESS_TYPES: Array<{ value: BusinessType; emoji: string; label: string; hint: string }> = [
  { value: 'QSR',         emoji: '🍕', label: 'Restaurant / QSR', hint: 'Fast food, casual dining' },
  { value: 'Retail',      emoji: '🛍️', label: 'Retail',           hint: 'Shops, supermarkets'     },
  { value: 'Services',    emoji: '💼', label: 'Services',          hint: 'Professional services'   },
  { value: 'Hospitality', emoji: '🏨', label: 'Hospitality',       hint: 'Hotels, lodges'          },
];

type UploadStep = 'idle' | 'select-type' | 'uploading' | 'done' | 'error';

export default function FileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep]               = useState<UploadStep>('idle');
  const [selectedType, setSelectedType] = useState<BusinessType>('QSR');
  const [pendingFile, setPendingFile]   = useState<File | null>(null);
  const [progress, setProgress]         = useState(0);
  const [errorMsg, setErrorMsg]         = useState('');
  const [dragOver, setDragOver]         = useState(false);

  const { hydrateFromUpload, setCurrency, setBusinessType, setUploadedFile, setLoading } = useStore();

  const handleFilePicked = useCallback((file: File) => {
    if (!file) return;
    setPendingFile(file);
    setStep('select-type');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFilePicked(file);
  }, [handleFilePicked]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFilePicked(file);
    e.target.value = '';
  }, [handleFilePicked]);

  const handleUpload = useCallback(async () => {
    if (!pendingFile) return;
    setStep('uploading');
    setProgress(0);
    setErrorMsg('');
    setLoading(true);
    setBusinessType(selectedType);

    const ticker = setInterval(() => setProgress(p => Math.min(p + 6, 88)), 280);

    try {
      const result = await uploadFile(pendingFile, { businessType: selectedType });
      clearInterval(ticker);
      setProgress(100);
      hydrateFromUpload(result);
      setCurrency(result.currency || 'ZMW', result.currency_symbol || 'K');
      setUploadedFile(pendingFile.name);
      setStep('done');
      setTimeout(() => setStep('idle'), 2800);
    } catch (err) {
      clearInterval(ticker);
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [pendingFile, selectedType, hydrateFromUpload, setCurrency, setBusinessType, setUploadedFile, setLoading]);

  const handleBack  = () => { setStep('idle'); setPendingFile(null); };
  const handleRetry = () => { setStep('idle'); setErrorMsg(''); setPendingFile(null); };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <AnimatePresence mode="wait">

        {/* ── IDLE ─────────────────────────────────────────────────────── */}
        {step === 'idle' && (
          <motion.div key="idle"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
          >
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleInputChange} style={{ display: 'none' }} />
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? tokens.e1 : tokens.border}`,
                borderRadius: 16, padding: '28px 24px', cursor: 'pointer',
                background: dragOver
                  ? `color-mix(in srgb, ${tokens.e1} 5%, var(--bg-surface))`
                  : tokens.bgSurface,
                backdropFilter: tokens.blur,
                transition: 'all 0.2s ease', textAlign: 'center',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: tokens.shimmer }} />
              <div style={{ marginBottom: 12 }}>
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ margin: '0 auto', display: 'block' }}>
                  <circle cx="18" cy="18" r="18" fill={`color-mix(in srgb, ${tokens.e1} 8%, transparent)`} />
                  <path d="M18 10v12M13 15l5-5 5 5" stroke="var(--e1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M11 24h14" stroke="var(--e1)" strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
                </svg>
              </div>
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 4px' }}>
                Drop your data file here
              </p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted, margin: 0, letterSpacing: '0.04em' }}>
                P&amp;L CSV · Transaction Excel · POS Export · XLS/XLSX
              </p>
              <div style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
                background: `color-mix(in srgb, ${tokens.e1} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${tokens.e1} 20%, transparent)`,
                borderRadius: 8, padding: '7px 16px',
              }}>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: tokens.e1 }}>Browse files</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SELECT TYPE ───────────────────────────────────────────────── */}
        {step === 'select-type' && (
          <motion.div key="select-type"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
            style={{
              background: tokens.bgSurface2, backdropFilter: tokens.blur,
              border: `1px solid ${tokens.border}`, borderRadius: 16,
              padding: '22px 20px', position: 'relative', overflow: 'hidden',
              boxShadow: tokens.shadow,
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: tokens.shimmer }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 2h6l3 3v8H3V2z" stroke={tokens.info} strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted, letterSpacing: '0.04em' }}>
                {pendingFile?.name}
              </span>
            </div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: tokens.textPrimary, margin: '0 0 4px' }}>
              What type of business is this?
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted, letterSpacing: '0.04em', margin: '0 0 16px' }}>
              Sets the benchmark config for Engine 3
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              {BUSINESS_TYPES.map(bt => {
                const sel = selectedType === bt.value;
                return (
                  <button key={bt.value} onClick={() => setSelectedType(bt.value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: 2, padding: '11px 13px',
                      background: sel
                        ? `color-mix(in srgb, ${tokens.e1} 10%, var(--bg-surface))`
                        : tokens.bgSurface,
                      border: `1px solid ${sel ? tokens.e1 : tokens.border}`,
                      borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{bt.emoji}</span>
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: sel ? tokens.e1 : tokens.textSecondary }}>
                      {bt.label}
                    </span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', color: tokens.textMuted }}>{bt.hint}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleBack} style={{
                flex: '0 0 auto', padding: '9px 14px', background: 'transparent',
                border: `1px solid ${tokens.border}`, borderRadius: 9, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: tokens.textMuted,
                transition: 'all 0.15s ease',
              }}>← Back</button>
              <button onClick={handleUpload} style={{
                flex: 1, padding: '9px 14px',
                background: 'var(--logo-grad)', border: 'none', borderRadius: 9, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontSize: '0.82rem', fontWeight: 700,
                color: '#fff',
                boxShadow: `0 4px 20px color-mix(in srgb, ${tokens.e1} 30%, transparent)`,
              }}>Analyse →</button>
            </div>
          </motion.div>
        )}

        {/* ── UPLOADING ─────────────────────────────────────────────────── */}
        {step === 'uploading' && (
          <motion.div key="uploading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: tokens.bgSurface2, backdropFilter: tokens.blur,
              border: `1px solid ${tokens.border}`, borderRadius: 16,
              padding: '28px 24px', textAlign: 'center',
              position: 'relative', overflow: 'hidden', boxShadow: tokens.shadow,
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: tokens.shimmer }} />
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `2px solid color-mix(in srgb, ${tokens.e1} 15%, transparent)`,
                  borderTop: `2px solid ${tokens.e1}`,
                }}
              />
            </div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 6px' }}>
              Analysing your data…
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted, margin: '0 0 16px', letterSpacing: '0.04em' }}>
              Running {selectedType} intelligence pipeline
            </p>
            <div style={{ height: 3, borderRadius: 3, background: tokens.tableHead, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'var(--logo-grad)', borderRadius: 3 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: tokens.textFaint, margin: '8px 0 0', letterSpacing: '0.04em' }}>
              {progress}% complete
            </p>
          </motion.div>
        )}

        {/* ── DONE ──────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.25, type: 'spring', stiffness: 260, damping: 20 }}
            style={{
              background: tokens.bgSurface2, backdropFilter: tokens.blur,
              border: `1px solid color-mix(in srgb, ${tokens.good} 25%, transparent)`,
              borderRadius: 16, padding: '24px', textAlign: 'center',
              position: 'relative', overflow: 'hidden', boxShadow: tokens.shadow,
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${tokens.good} 40%, transparent), transparent)` }} />
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>✓</div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: tokens.good, margin: '0 0 4px' }}>Analysis complete</p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted, margin: 0, letterSpacing: '0.04em' }}>
              {pendingFile?.name} → {selectedType} intelligence
            </p>
          </motion.div>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────── */}
        {step === 'error' && (
          <motion.div key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: tokens.bgSurface2, backdropFilter: tokens.blur,
              border: `1px solid color-mix(in srgb, ${tokens.crit} 25%, transparent)`,
              borderRadius: 16, padding: '24px', textAlign: 'center',
              position: 'relative', overflow: 'hidden', boxShadow: tokens.shadow,
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⚠</div>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: tokens.crit, margin: '0 0 6px' }}>Analysis failed</p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: tokens.textMuted, margin: '0 0 16px', maxWidth: 260, marginLeft: 'auto', marginRight: 'auto' }}>
              {errorMsg}
            </p>
            <button onClick={handleRetry} style={{
              padding: '8px 20px',
              background: `color-mix(in srgb, ${tokens.crit} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tokens.crit} 25%, transparent)`,
              borderRadius: 8, cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', color: tokens.crit,
              transition: 'all 0.15s ease',
            }}>Try again</button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
