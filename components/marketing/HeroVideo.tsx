'use client';

/**
 * The hero's video: the AI-BOS UI kit in action, made from the real kit
 * components in aibos-film (npm run render:hero) and saved in
 * public/marketing/hero/. A laptop cut for screens 768px and wider, a phone
 * cut for phones, picked by the device and swapped on rotate or resize.
 *
 * The poster is the first paint (it is the video's own first frame), so the
 * page is never waiting on the video. The video is muted and loops, plays
 * only while it is on screen, and has a Pause button under it (WCAG 2.2.2). With
 * reduced motion it does not start on its own: the poster shows with Play.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

type Cut = 'desktop' | 'phone';
const SRC: Record<Cut, { mp4: string; webm: string; poster: string; w: number; h: number }> = {
  desktop: { mp4: '/marketing/hero/desktop.mp4', webm: '/marketing/hero/desktop.webm', poster: '/marketing/hero/desktop.jpg', w: 1920, h: 1200 },
  phone: { mp4: '/marketing/hero/phone.mp4', webm: '/marketing/hero/phone.webm', poster: '/marketing/hero/phone.jpg', w: 780, h: 1688 },
};
const WIDE = '(min-width: 768px)';
const STORY = 'AIBOS in action: recording a sale, getting paid by mobile money, asking AIBOS a question and the morning brief';

export default function HeroVideo() {
  const [cut, setCut] = useState<Cut | null>(null);
  const [reduced, setReduced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pausedByOwner = useRef(false);
  const onScreen = useRef(false);

  // Which cut, and whether the visitor asked for less motion. Both follow
  // changes (a phone turned on its side, a setting switched).
  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pick = () => setCut(wide.matches ? 'desktop' : 'phone');
    const still = () => setReduced(calm.matches);
    pick();
    still();
    wide.addEventListener('change', pick);
    calm.addEventListener('change', still);
    return () => { wide.removeEventListener('change', pick); calm.removeEventListener('change', still); };
  }, []);

  // Play while on screen, pause when scrolled away.
  useEffect(() => {
    const el = stage.current;
    if (!el || !cut) return;
    const io = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
      const v = video.current;
      if (!v) return;
      if (entry.isIntersecting && !reduced && !pausedByOwner.current) v.play().catch(() => { /* autoplay refused: the poster stays */ });
      else if (!entry.isIntersecting) v.pause();
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [cut, reduced]);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { pausedByOwner.current = false; v.play().catch(() => {}); }
    else { pausedByOwner.current = true; v.pause(); }
  }, []);

  return (
    <div ref={stage} className="hero-stage">
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
            muted
            loop
            playsInline
            preload="metadata"
            poster={SRC[cut].poster}
            disablePictureInPicture
            disableRemotePlayback
            aria-label={STORY}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedData={() => { if (onScreen.current && !reduced && !pausedByOwner.current) video.current?.play().catch(() => {}); }}
          >
            <source src={SRC[cut].webm} type="video/webm" />
            <source src={SRC[cut].mp4} type="video/mp4" />
          </video>
        )}
      </div>
      {/* Under the screen, so it never covers the app in the video. */}
      <div className="hero-controls">
        <button type="button" className="pill pill-quiet" onClick={toggle} aria-pressed={!playing}>
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  );
}
