'use client';
/**
 * AI-BOS — QR scanner (Evolution Initiative 7).
 * Decodes a receipt QR with the browser's native BarcodeDetector where available
 * (Chrome/Android/Edge), with a universal "paste the code" fallback so every device
 * can still use it. Returns the decoded string; the backend (parse_qr) turns it into
 * a proposed event. Progressive enhancement — same pattern as the voice mic.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<DetectedBarcode[]> };

function getDetector(): BarcodeDetectorLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike };
  if (!w.BarcodeDetector) return null;
  try { return new w.BarcodeDetector({ formats: ['qr_code'] }); }
  catch { return null; }
}

export default function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [supported, setSupported] = useState(true);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    const detector = getDetector();
    if (!detector) { setSupported(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length && codes[0].rawValue) {
            stop();
            onResult(codes[0].rawValue);
            return;
          }
        } catch { /* transient decode error — keep scanning */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError('Could not access the camera. Paste the code instead.');
      setSupported(false);
    }
  }, [onResult, stop]);

  useEffect(() => {
    setSupported(getDetector() != null);
    return stop; // cleanup on unmount
  }, [stop]);

  function handleClose() { stop(); onClose(); }

  return (
    <div role="dialog" aria-label="Scan receipt QR" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--overlay-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="section-card" style={{ width: '100%', maxWidth: 420, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 className="section-title">Scan receipt QR</h3>
          <button type="button" onClick={handleClose} aria-label="Close" className="touch-target"
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>✕</button>
        </div>

        {supported ? (
          <>
            <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#000', border: '1px solid var(--border-md)' }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {!cameraOn && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button type="button" onClick={startCamera} className="touch-target"
                    style={{ padding: '12px 22px', minHeight: 48, borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#04121a', fontFamily: 'Geist, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                    Start camera
                  </button>
                </div>
              )}
            </div>
            <p style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.66rem', color: 'var(--text-4)', textAlign: 'center', marginTop: 10 }}>
              Point at the receipt&apos;s QR code
            </p>
          </>
        ) : (
          <div>
            <label style={{ fontFamily: 'Geist, sans-serif', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'block' }}>
              Paste the QR contents
            </label>
            <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={3}
              placeholder="Paste the decoded QR text / URL here"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-md)', borderRadius: 8, color: 'var(--text-1)', fontFamily: 'Geist, sans-serif', fontSize: '0.8rem', outline: 'none', resize: 'vertical' }} />
            <button type="button" onClick={() => paste.trim() && onResult(paste.trim())} disabled={!paste.trim()} className="touch-target"
              style={{ marginTop: 10, width: '100%', padding: '12px', minHeight: 48, borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#04121a', fontFamily: 'Geist, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: paste.trim() ? 'pointer' : 'default', opacity: paste.trim() ? 1 : 0.5 }}>
              Use this code
            </button>
          </div>
        )}

        {error && <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.8rem' }}>{error}</div>}

        {supported && (
          <button type="button" onClick={() => setSupported(false)}
            style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontFamily: 'Geist, sans-serif', fontSize: '0.7rem', textDecoration: 'underline' }}>
            Camera not working? Paste the code instead
          </button>
        )}
      </div>
    </div>
  );
}
