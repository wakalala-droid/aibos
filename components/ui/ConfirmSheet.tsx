'use client';

// ConfirmSheet: the product's own confirmation (UI/UX audit 2026-10 B2).
// A native <dialog> opened with showModal(), so focus is trapped, Escape closes
// it and focus returns to the button that opened it, with no extra library.
// Bottom sheet on phones, centred card from 640px up (CSS in globals.css,
// "CONFIRM SHEET"). The destructive button is never the default focus.

import { useEffect, useRef, useState } from 'react';
import { registerConfirmSheet, type ConfirmRequest } from '@/lib/confirm';
import BorderGlow from './BorderGlow';

export default function ConfirmSheet() {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    registerConfirmSheet((r, resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setReq(r);
    });
    return () => registerConfirmSheet(null);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d || !req) return;
    if (!d.open) d.showModal();
  }, [req]);

  const finish = (ok: boolean) => {
    const d = ref.current;
    if (d?.open) d.close();
    resolver.current?.(ok);
    resolver.current = null;
    setReq(null);
  };

  return (
    <dialog
      ref={ref}
      className="confirm-sheet"
      aria-labelledby="confirm-sheet-title"
      onCancel={(e) => { e.preventDefault(); finish(false); }}
      onClick={(e) => { if (e.target === ref.current) finish(false); }}
    >
      {req && (
        <BorderGlow
          className="confirm-sheet-card"
          edgeSensitivity={30}
          glowColor="190 95 62"
          backgroundColor="var(--bg-card)"
          borderRadius={16}
          glowRadius={48}
          glowIntensity={1.2}
          coneSpread={12}
          colors={['#22d3ee', '#60a5fa', '#a78bfa']}
        >
          <div style={{ padding: '24px 24px 20px' }}>
            <h2 id="confirm-sheet-title" style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-1)', margin: 0, lineHeight: 1.35 }}>
              {req.title}
            </h2>
            {req.body && (
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 1.6, margin: '10px 0 0' }}>{req.body}</p>
            )}
            {req.copyText && (
              <input
                readOnly
                value={req.copyText}
                aria-label="Link to copy"
                onFocus={(e) => e.currentTarget.select()}
                style={{ width: '100%', marginTop: 14, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--text-1)', fontSize: 'var(--fs-body)' }}
              />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              {req.cancelLabel !== '' && (
                <button
                  type="button"
                  autoFocus
                  onClick={() => finish(false)}
                  style={{ padding: '0 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-1)', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer' }}
                >
                  {req.cancelLabel || 'Keep it'}
                </button>
              )}
              <button
                type="button"
                autoFocus={req.cancelLabel === ''}
                onClick={() => finish(true)}
                style={{
                  padding: '0 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer',
                  border: req.danger ? '1px solid var(--red)' : 'none',
                  background: req.danger ? 'var(--red-dim)' : 'var(--cyan)',
                  color: req.danger ? 'var(--red)' : 'var(--on-cyan)',
                }}
              >
                {req.confirmLabel}
              </button>
            </div>
          </div>
        </BorderGlow>
      )}
    </dialog>
  );
}
