'use client';

/**
 * The hero's video: the AI-BOS UI kit in action, made from the real kit
 * components in aibos-film (npm run render:hero) and saved in
 * public/marketing/hero/. A laptop cut for screens 768px and wider, a phone
 * cut for phones.
 *
 * It plays on its own, muted and looping, with no buttons (owner, 9 Oct
 * 2026). The video is plain HTML in the page, so the browser starts it the
 * moment the page arrives, without waiting for any script, and picks the cut
 * by screen size itself (<source media>). React leaves out the muted
 * attribute, and browsers only autoplay a video that is muted from the start,
 * so the tag is written out by hand. The script only helps: if a browser held
 * the video back (an iPhone in Low Power Mode), the first tap, click, key or
 * scroll starts it, and a phone turned on its side swaps the cut.
 *
 * MP4 (H.264) only: it plays in every browser on every device. A WebM copy
 * used to come first and Edge on Windows could not decode it, so the video
 * froze on its first frame (9 Oct 2026). Never put a second format first.
 */

import { useEffect, useRef } from 'react';

const SRC = {
  desktop: { mp4: '/marketing/hero/desktop.mp4', poster: '/marketing/hero/desktop.jpg', w: 1920, h: 1200 },
  phone: { mp4: '/marketing/hero/phone.mp4', poster: '/marketing/hero/phone.jpg', w: 780, h: 1688 },
};
const WIDE = '(min-width: 768px)';
const STORY = 'AIBOS in action: recording a sale, getting paid by mobile money, asking AIBOS a question and the morning brief';
// touchend and click count as a tap on a phone; touchstart and pointerdown
// from a finger do not, so they cannot start a held-back video.
const NUDGES = ['click', 'touchend', 'keydown', 'scroll'] as const;

const VIDEO_HTML =
  `<video class="hero-video" autoplay muted loop playsinline preload="auto" disablepictureinpicture disableremoteplayback aria-label="${STORY}">` +
  `<source media="${WIDE}" src="${SRC.desktop.mp4}" type="video/mp4">` +
  `<source src="${SRC.phone.mp4}" type="video/mp4">` +
  `</video>`;

export default function HeroVideo() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = box.current?.querySelector('video');
    if (!v) return;
    const play = () => { v.muted = true; v.play().catch(() => { /* held back: the next tap tries again */ }); };
    const nudge = () => {
      play();
      if (!v.paused) NUDGES.forEach((e) => window.removeEventListener(e, nudge));
    };
    if (v.paused) play();
    NUDGES.forEach((e) => window.addEventListener(e, nudge, { passive: true }));
    v.addEventListener('canplay', play);

    // A phone turned on its side, or a window dragged past 768px: the browser
    // picks the cut again when the video reloads.
    const wide = window.matchMedia(WIDE);
    const swap = () => { v.load(); play(); };
    wide.addEventListener('change', swap);

    return () => {
      NUDGES.forEach((e) => window.removeEventListener(e, nudge));
      v.removeEventListener('canplay', play);
      wide.removeEventListener('change', swap);
    };
  }, []);

  // The app floats on the kit's dark surface with its blue light, so the
  // light product reads clearly against the page. The poster sits under the
  // video, so the screen is never empty while the video loads.
  return (
    <div className="hero-player">
      <div className="hero-stage" data-theme="dark">
        <div className="hero-screen">
          <picture className="hero-poster">
            <source media={WIDE} srcSet={SRC.desktop.poster} width={SRC.desktop.w} height={SRC.desktop.h} />
            {/* eslint-disable-next-line @next/next/no-img-element -- the poster must switch by device in plain HTML, before any script runs */}
            <img src={SRC.phone.poster} width={SRC.phone.w} height={SRC.phone.h} alt={STORY} fetchPriority="high" />
          </picture>
          <div ref={box} className="hero-film" dangerouslySetInnerHTML={{ __html: VIDEO_HTML }} />
        </div>
        <p className="hero-caption">A sample business, Zoe&apos;s Kitchen in Lusaka</p>
      </div>
    </div>
  );
}
