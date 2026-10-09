'use client';

/**
 * The hero's video: the AI-BOS UI kit in action, made from the real kit
 * components in aibos-film (npm run render:hero) and saved in
 * public/marketing/hero/. A laptop cut for screens 768px and wider, a phone
 * cut for phones, picked by the device and swapped on rotate or resize.
 *
 * It plays on its own, muted and looping, with no buttons (owner, 9 Oct
 * 2026). The browser starts it itself (autoPlay); if a browser refuses to
 * autoplay (an iPhone in Low Power Mode), the first tap, click, key or scroll
 * on the page starts it. The poster is the video's own first frame, so the
 * stage is never empty.
 *
 * MP4 (H.264) only: it plays in every browser on every device. A WebM copy
 * used to come first and Edge on Windows could not decode it, so the video
 * froze on its first frame (9 Oct 2026). Never put a second format first.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type Cut = 'desktop' | 'phone';
const SRC: Record<Cut, { mp4: string; poster: string; w: number; h: number }> = {
  desktop: { mp4: '/marketing/hero/desktop.mp4', poster: '/marketing/hero/desktop.jpg', w: 1920, h: 1200 },
  phone: { mp4: '/marketing/hero/phone.mp4', poster: '/marketing/hero/phone.jpg', w: 780, h: 1688 },
};
const WIDE = '(min-width: 768px)';
const STORY = 'AIBOS in action: recording a sale, getting paid by mobile money, asking AIBOS a question and the morning brief';
// touchend and click count as a tap on a phone; touchstart and pointerdown
// from a finger do not, so they cannot start a held-back video.
const NUDGES = ['click', 'touchend', 'keydown', 'scroll'] as const;

export default function HeroVideo() {
  const [cut, setCut] = useState<Cut | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);

  // The laptop or the phone cut, following a phone turned on its side.
  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const pick = () => setCut(wide.matches ? 'desktop' : 'phone');
    pick();
    wide.addEventListener('change', pick);
    return () => wide.removeEventListener('change', pick);
  }, []);

  const play = useCallback(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => { /* refused for now: the next touch or scroll tries again */ });
  }, []);

  // Start it, and if the browser held it back, start it on the first touch,
  // click, key or scroll anywhere on the page.
  useEffect(() => {
    if (!cut) return;
    play();
    const nudge = () => {
      play();
      if (video.current && !video.current.paused) NUDGES.forEach((e) => window.removeEventListener(e, nudge));
    };
    NUDGES.forEach((e) => window.addEventListener(e, nudge, { passive: true }));
    return () => NUDGES.forEach((e) => window.removeEventListener(e, nudge));
  }, [cut, play]);

  // The app floats on the kit's dark surface with its blue light, so the
  // light product reads clearly against the page.
  return (
    <div className="hero-player">
      <div className="hero-stage" data-theme="dark">
        <div className="hero-screen">
          <picture className="hero-poster">
            <source media={WIDE} srcSet={SRC.desktop.poster} width={SRC.desktop.w} height={SRC.desktop.h} />
            {/* eslint-disable-next-line @next/next/no-img-element -- the poster must switch by device in plain HTML, before any script runs */}
            <img src={SRC.phone.poster} width={SRC.phone.w} height={SRC.phone.h} alt={STORY} fetchPriority="high" />
          </picture>
          {cut && (
            <video
              key={cut}
              ref={(el) => {
                video.current = el;
                // React sets muted as a property only; iPhone Safari needs the
                // attribute before it lets a video play on its own.
                if (el) { el.muted = true; el.defaultMuted = true; el.setAttribute('muted', ''); }
              }}
              className="hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={SRC[cut].poster}
              disablePictureInPicture
              disableRemotePlayback
              aria-label={STORY}
              onCanPlay={play}
            >
              <source src={SRC[cut].mp4} type="video/mp4" />
            </video>
          )}
        </div>
        <p className="hero-caption">A sample business, Zoe&apos;s Kitchen in Lusaka</p>
      </div>
    </div>
  );
}
