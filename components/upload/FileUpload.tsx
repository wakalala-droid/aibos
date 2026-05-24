'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';

function UploadIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  );
}
function FileIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  );
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

interface FileUploadProps {
  onUploadComplete?: (filename: string) => void;
  compact?: boolean;
}

export function FileUpload({ onUploadComplete, compact = false }: FileUploadProps) {
  const [state, setState]       = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const setUploadedFile = useStore(s => s.setUploadedFile);

  const ACCEPTED = ['.csv', '.xlsx', '.xls'];
  const MAX_MB   = 50;

  const validate = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) return `Unsupported file type. Use CSV or Excel.`;
    if (file.size > MAX_MB * 1024 * 1024) return `File too large. Max ${MAX_MB}MB.`;
    return null;
  };

  const processFile = useCallback(async (file: File) => {
    const err = validate(file);
    if (err) { setState('error'); setErrorMsg(err); return; }

    setFilename(file.name);
    setState('uploading');
    setProgress(0);

    // Simulate upload with realistic progress curve
    const steps = [10, 25, 42, 58, 71, 84, 93, 100];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 180 + Math.random() * 120));
      setProgress(step);
    }

    setState('success');
    setUploadedFile(file.name);
    onUploadComplete?.(file.name);
  }, [onUploadComplete, setUploadedFile]);

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

  const isDragging   = state === 'dragging';
  const isUploading  = state === 'uploading';
  const isSuccess    = state === 'success';
  const isError      = state === 'error';

  const borderColour = isDragging ? 'rgba(96,165,250,0.7)' : isSuccess ? 'rgba(16,185,129,0.5)' : isError ? 'rgba(239,68,68,0.5)' : 'rgba(99,179,237,0.18)';
  const bgColour     = isDragging ? 'rgba(59,130,246,0.08)' : isSuccess ? 'rgba(16,185,129,0.05)' : 'rgba(9,13,30,0.5)';

  if (compact && isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10 }}
      >
        <div style={{ color: '#10b981' }}><CheckIcon size={16} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.78rem', color: '#e2eeff', fontFamily: 'Outfit, sans-serif', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</p>
          <p style={{ fontSize: '0.62rem', color: '#10b981', fontFamily: 'DM Mono, monospace', margin: 0 }}>Processed successfully</p>
        </div>
        <button onClick={reset} style={{ background: 'none', border: 'none', color: '#4a6285', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'DM Mono, monospace' }}>Replace</button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background:   'rgba(9,13,30,0.72)',
        backdropFilter: 'blur(16px)',
        border:       '1px solid rgba(99,179,237,0.12)',
        borderRadius: 16,
        padding:      compact ? 16 : 24,
        boxShadow:    '0 4px 24px rgba(0,0,0,0.3)',
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {/* Top glow */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,179,237,0.3), transparent)' }} />

      {!compact && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0 }}>Upload Financial Data</h3>
          <p style={{ fontSize: '0.68rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginTop: 2 }}>CSV or Excel · Max 50MB · P&amp;L, Balance Sheet, Cash Flow</p>
        </div>
      )}

      {/* ── Drop zone ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
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
              background:   bgColour,
              textAlign:    'center',
              cursor:       'pointer',
              transition:   'all 0.2s ease',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
            <motion.div
              animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
              style={{ color: isDragging ? '#60a5fa' : '#4a6285', marginBottom: 10, display: 'inline-block' }}
            >
              <UploadIcon size={compact ? 20 : 28} />
            </motion.div>
            <p style={{ fontSize: compact ? '0.78rem' : '0.88rem', fontWeight: 500, color: isDragging ? '#60a5fa' : '#d4ddf0', fontFamily: 'Outfit, sans-serif', margin: 0, marginBottom: 4 }}>
              {isDragging ? 'Drop to upload' : 'Drop file here or click to browse'}
            </p>
            <p style={{ fontSize: '0.65rem', color: '#2d4a70', fontFamily: 'DM Mono, monospace', margin: 0 }}>
              {ACCEPTED.join(' · ')} · max {MAX_MB}MB
            </p>
          </motion.div>
        )}

        {/* ── Uploading ──────────────────────────────────────────── */}
        {isUploading && (
          <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ color: '#60a5fa', marginBottom: 12 }}><FileIcon size={28} /></div>
            <p style={{ fontSize: '0.82rem', color: '#d4ddf0', fontFamily: 'Outfit, sans-serif', fontWeight: 500, margin: 0, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260, marginInline: 'auto' }}>{filename}</p>
            <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginBottom: 16 }}>Processing financial data…</p>
            <div style={{ background: 'rgba(99,179,237,0.1)', borderRadius: 999, height: 6, overflow: 'hidden', maxWidth: 280, marginInline: 'auto' }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #60a5fa, #06b6d4)' }}
              />
            </div>
            <p style={{ fontSize: '0.62rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', marginTop: 8 }}>{progress}%</p>
          </motion.div>
        )}

        {/* ── Success ────────────────────────────────────────────── */}
        {isSuccess && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ padding: '24px 0', textAlign: 'center' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginInline: 'auto', marginBottom: 12, color: '#10b981' }}
            >
              <CheckIcon size={22} />
            </motion.div>
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2eeff', fontFamily: 'Outfit, sans-serif', margin: 0, marginBottom: 2 }}>Analysis Complete</p>
            <p style={{ fontSize: '0.68rem', color: '#10b981', fontFamily: 'DM Mono, monospace', margin: 0, marginBottom: 4 }}>{filename}</p>
            <p style={{ fontSize: '0.65rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', margin: 0, marginBottom: 16 }}>Dashboard updated with your data</p>
            <button onClick={reset} style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 7, padding: '6px 16px', cursor: 'pointer' }}>Upload new file</button>
          </motion.div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {isError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '24px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '0.82rem', color: '#ef4444', fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>Upload failed</p>
            <p style={{ fontSize: '0.7rem', color: '#4a6285', fontFamily: 'DM Mono, monospace', marginBottom: 16 }}>{errorMsg}</p>
            <button onClick={reset} style={{ fontSize: '0.72rem', fontFamily: 'DM Mono, monospace', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 7, padding: '6px 16px', cursor: 'pointer' }}>Try again</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
