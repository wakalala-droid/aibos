/**
 * Painterly scene illustrations for the Chanda story band (marketing only).
 *
 * Each scene is a hand-built layered SVG "painting": soft gradient washes,
 * silhouette layers passed through a turbulence-displacement filter for a
 * brushy, hand-painted edge, and a fractal-noise grain overlay for canvas
 * texture. Ambient motion (drifting dust, rising cyan data-light, twinkling
 * stars) is CSS-driven via the .sc-* classes in marketing.css and falls under
 * the documented marketing-motion exception — the global reduced-motion rule
 * in marketing.css collapses all of it.
 *
 * These are original in-code paintings in the art direction locked in
 * LANDING_PAGE_BRIEF.md §10.3 (golden-hour Zambian scenes, cyan data-light
 * motif). If owner-generated painterly WebP/MP4 assets land later, they can
 * replace these 1:1 inside the same .story-scene frames.
 */

/* Scene 1 — 04:42, the open pit before dawn. Indigo sky, ember horizon,
   headlight cones on the haul road, Chanda silhouetted on the rim. */
export function SceneDawn() {
  return (
    <svg viewBox="0 0 800 520" role="img" aria-label="Painterly scene: an open-pit mine in Kitwe before dawn — a tipper truck descends the haul road with headlights on, a lone lit window in the site office, and Chanda stands on the rim under a fading starfield.">
      <defs>
        <linearGradient id="s1sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="0.52" stopColor="#1b2150" />
          <stop offset="0.78" stopColor="#6b3a56" />
          <stop offset="1" stopColor="#d96a2f" />
        </linearGradient>
        <radialGradient id="s1amber" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff9a4d" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ff9a4d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="s1win" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffc887" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffc887" stopOpacity="0" />
        </radialGradient>
        <filter id="s1p" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="8" />
        </filter>
        <filter id="s1soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="s1g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
        </filter>
      </defs>

      {/* sky + ember horizon glow */}
      <rect width="800" height="520" fill="url(#s1sky)" />
      <ellipse cx="430" cy="322" rx="330" ry="86" fill="url(#s1amber)" />
      <ellipse cx="430" cy="330" rx="190" ry="38" fill="#ff7a30" opacity="0.35" filter="url(#s1soft)" />

      {/* fading stars */}
      <g fill="#cdd7ff">
        <circle className="sc-star" cx="86" cy="52" r="1.5" opacity="0.5" />
        <circle className="sc-star" cx="188" cy="96" r="1.1" opacity="0.5" style={{ animationDelay: '0.9s' }} />
        <circle className="sc-star" cx="292" cy="40" r="1.4" opacity="0.5" style={{ animationDelay: '2.1s' }} />
        <circle className="sc-star" cx="372" cy="118" r="0.9" opacity="0.5" style={{ animationDelay: '3.2s' }} />
        <circle className="sc-star" cx="468" cy="64" r="1.3" opacity="0.5" style={{ animationDelay: '1.4s' }} />
        <circle className="sc-star" cx="562" cy="34" r="1.6" opacity="0.5" style={{ animationDelay: '2.8s' }} />
        <circle className="sc-star" cx="642" cy="102" r="1.0" opacity="0.5" style={{ animationDelay: '0.4s' }} />
        <circle className="sc-star" cx="722" cy="58" r="1.4" opacity="0.5" style={{ animationDelay: '3.8s' }} />
        <circle className="sc-star" cx="518" cy="150" r="0.9" opacity="0.5" style={{ animationDelay: '1.9s' }} />
        <circle className="sc-star" cx="130" cy="150" r="1.0" opacity="0.5" style={{ animationDelay: '2.5s' }} />
        <circle className="sc-star" cx="234" cy="188" r="0.9" opacity="0.45" style={{ animationDelay: '4.4s' }} />
        <circle className="sc-star" cx="418" cy="176" r="1.1" opacity="0.45" style={{ animationDelay: '0.7s' }} />
        <circle className="sc-star" cx="606" cy="166" r="0.9" opacity="0.45" style={{ animationDelay: '3.5s' }} />
        <circle className="sc-star" cx="756" cy="126" r="1.2" opacity="0.5" style={{ animationDelay: '2.2s' }} />
      </g>

      {/* far ridge */}
      <path d="M0,318 C120,306 210,322 330,312 C470,300 570,318 690,308 C740,304 780,308 800,304 L800,344 L0,344 Z" fill="#141838" filter="url(#s1p)" />

      {/* pit benches (terraced silhouettes with ember rim highlights) */}
      <g filter="url(#s1p)">
        <path d="M0,336 C160,328 400,340 620,330 C700,326 760,330 800,326 L800,368 C600,376 240,380 0,372 Z" fill="#121738" />
        <path d="M30,372 C260,382 540,378 800,366 L800,410 C560,420 260,422 60,412 Z" fill="#0e1230" />
        <path d="M90,412 C300,422 560,418 770,406 L750,450 C540,458 300,460 130,450 Z" fill="#0b0f28" />
        <ellipse cx="430" cy="470" rx="270" ry="30" fill="#080b1e" />
        {/* haul road sweeping down from the right rim */}
        <path d="M800,356 C700,372 620,400 560,436 C540,448 520,458 505,462 L545,468 C580,452 650,412 730,384 C762,373 786,366 800,364 Z" fill="#141a40" />
      </g>
      <g fill="none" stroke="#e58a4e" strokeWidth="2" opacity="0.45" filter="url(#s1p)">
        <path d="M0,336 C160,328 400,340 620,330 C700,326 760,330 800,326" />
        <path d="M30,372 C260,382 540,378 800,366" />
        <path d="M90,412 C300,422 560,418 770,406" />
      </g>

      {/* site office on the left rim — one warm window */}
      <g transform="translate(96,336)">
        <circle cx="12" cy="-12" r="18" fill="url(#s1win)" filter="url(#s1soft)" />
        <g filter="url(#s1p)">
          <rect x="0" y="-22" width="42" height="22" rx="2" fill="#0a0d22" />
          <path d="M-3,-22 L45,-22 L42,-27 L0,-27 Z" fill="#090c1e" />
          <line x1="36" y1="-22" x2="36" y2="-46" stroke="#0a0d22" strokeWidth="2" />
        </g>
        <rect x="7" y="-16" width="9" height="8" rx="1" fill="#ffc887" />
        <circle className="sc-star" cx="36" cy="-48" r="2.2" fill="#ff5a4e" opacity="0.8" />
      </g>

      {/* tipper truck on the haul road, headlights down-slope */}
      <g transform="translate(596,412) scale(1.25)">
        <polygon className="sc-beam" points="-34,-4 -84,8 -84,18 -34,3" fill="#ffd9a0" opacity="0.45" filter="url(#s1soft)" />
        <circle cx="-33" cy="-2" r="2.2" fill="#ffe9c4" />
        <g fill="#06080f" filter="url(#s1p)">
          <rect x="-32" y="-11" width="13" height="10" rx="1.5" />
          <path d="M-18,-13 L28,-16 L32,-3 L-19,-1 Z" />
          <circle cx="-24" cy="1.5" r="4.6" />
          <circle cx="-4" cy="1" r="4.6" />
          <circle cx="24" cy="0" r="4.6" />
        </g>
      </g>

      {/* Chanda on the right rim, ember rim-light on his back */}
      <g transform="translate(694,334)">
        <g fill="#0a0d1f" filter="url(#s1p)">
          <path d="M-7,-38.5 Q0,-46 7,-38.5 L8.5,-37.4 Q0,-40.4 -8.5,-37.4 Z" />
          <circle cx="0" cy="-33" r="5" />
          <path d="M-5.5,-28 C-7,-22 -7.5,-14 -6.5,-7 L-6,0 L-2.5,0 L-2,-7 L2,-7 L2.5,0 L6,0 L6.5,-7 C7.5,-16 6.5,-24 4.5,-28 C2,-30.5 -3,-30.5 -5.5,-28 Z" />
        </g>
        <g fill="none" stroke="#e58a4e" strokeWidth="1.6" opacity="0.6">
          <path d="M4.5,-28 C6.5,-24 7.5,-16 6.5,-7" />
          <path d="M3.2,-36.6 A5,5 0 0 1 4.8,-31.8" />
        </g>
      </g>

      {/* foreground rim */}
      <path d="M0,488 C220,478 560,484 800,474 L800,520 L0,520 Z" fill="#070a1c" filter="url(#s1p)" />

      {/* drifting dust motes */}
      <g fill="#caa27e">
        <circle className="sc-dust" cx="300" cy="436" r="2" />
        <circle className="sc-dust" cx="362" cy="458" r="1.6" style={{ animationDelay: '1.6s' }} />
        <circle className="sc-dust" cx="472" cy="444" r="2.2" style={{ animationDelay: '3.4s' }} />
        <circle className="sc-dust" cx="560" cy="424" r="1.5" style={{ animationDelay: '5s' }} />
        <circle className="sc-dust" cx="642" cy="402" r="2" style={{ animationDelay: '6.8s' }} />
        <circle className="sc-dust" cx="244" cy="462" r="1.7" style={{ animationDelay: '8.2s' }} />
        <circle className="sc-dust" cx="702" cy="434" r="1.5" style={{ animationDelay: '9.6s' }} />
        <circle className="sc-dust" cx="414" cy="470" r="2.3" style={{ animationDelay: '11s' }} />
      </g>

      <rect width="800" height="520" filter="url(#s1g)" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

/* Scene 2 — 21:15, inside the site office. One lamp, two exercise books,
   Chanda hunched over the ledger, coffee going cold. */
export function SceneLedger() {
  return (
    <svg viewBox="0 0 800 520" role="img" aria-label="Painterly scene: the site office at night — Chanda hunched under a desk lamp over open exercise books and loose papers, steam rising from a cooling mug, the pit lights faint through the window.">
      <defs>
        <linearGradient id="s2wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151122" />
          <stop offset="1" stopColor="#221720" />
        </linearGradient>
        <radialGradient id="s2warm" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb96b" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffb96b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="s2pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffc37a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffc37a" stopOpacity="0" />
        </radialGradient>
        <filter id="s2p" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.013 0.019" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
        </filter>
        <filter id="s2soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="s2g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="4" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
        </filter>
      </defs>

      <rect width="800" height="520" fill="url(#s2wall)" />
      {/* warm lamp atmosphere */}
      <ellipse cx="565" cy="230" rx="330" ry="250" fill="url(#s2warm)" />

      {/* window onto the night pit */}
      <g filter="url(#s2p)">
        <rect x="58" y="66" width="156" height="176" rx="5" fill="#0c1130" />
        <rect x="58" y="66" width="156" height="176" rx="5" fill="none" stroke="#2b2136" strokeWidth="5" />
        <line x1="136" y1="70" x2="136" y2="238" stroke="#2b2136" strokeWidth="4" />
        <line x1="62" y1="154" x2="210" y2="154" stroke="#2b2136" strokeWidth="4" />
        <rect x="50" y="242" width="172" height="8" rx="2" fill="#2b2136" />
      </g>
      {/* distant pit lights through the glass */}
      <g fill="#ffc37a">
        <circle className="sc-star" cx="92" cy="206" r="1.6" opacity="0.7" />
        <circle className="sc-star" cx="118" cy="214" r="1.2" opacity="0.6" style={{ animationDelay: '1.7s' }} />
        <circle className="sc-star" cx="172" cy="200" r="1.4" opacity="0.7" style={{ animationDelay: '3.1s' }} />
      </g>

      {/* wall clock — 21:15 */}
      <g transform="translate(330,96)">
        <circle r="18" fill="#2a2242" stroke="#57466b" strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2="-8" stroke="#ffd9a0" strokeWidth="2.4" transform="rotate(278)" />
        <line x1="0" y1="0" x2="0" y2="-13" stroke="#ffd9a0" strokeWidth="1.6" transform="rotate(90)" />
        <circle r="1.6" fill="#ffd9a0" />
      </g>

      {/* desk */}
      <path d="M0,392 L800,372 L800,520 L0,520 Z" fill="#251a17" filter="url(#s2p)" />
      <path d="M0,392 L800,372" stroke="#4a3122" strokeWidth="2" opacity="0.6" fill="none" filter="url(#s2p)" />
      <ellipse cx="590" cy="398" rx="170" ry="30" fill="url(#s2pool)" />

      {/* lamp + light cone */}
      <polygon className="sc-beam" points="612,208 500,384 716,378" fill="#ffc37a" opacity="0.26" filter="url(#s2soft)" />
      <g filter="url(#s2p)">
        <path d="M604,206 L638,196 L646,214 L616,224 Z" fill="#171021" />
        <path d="M640,206 L668,278 L678,342 L672,378" fill="none" stroke="#171021" strokeWidth="6" />
        <ellipse cx="672" cy="380" rx="26" ry="6" fill="#171021" />
      </g>

      {/* ledgers, papers, phone in the pool of light */}
      <g filter="url(#s2p)">
        <path d="M498,368 L568,362 L586,384 L512,392 Z" fill="#e8d9b8" />
        <path d="M568,362 L634,364 L646,388 L586,384 Z" fill="#d9c7a2" />
        <line x1="522" y1="372" x2="566" y2="368" stroke="#8a7a5c" strokeWidth="1.2" opacity="0.7" />
        <line x1="526" y1="378" x2="572" y2="374" stroke="#8a7a5c" strokeWidth="1.2" opacity="0.7" />
        <line x1="596" y1="372" x2="632" y2="373" stroke="#8a7a5c" strokeWidth="1.2" opacity="0.7" />
        <line x1="600" y1="379" x2="638" y2="380" stroke="#8a7a5c" strokeWidth="1.2" opacity="0.7" />
        {/* stacked closed books */}
        <rect x="676" y="336" width="86" height="12" rx="2" fill="#3d2b4e" />
        <rect x="682" y="324" width="76" height="12" rx="2" fill="#5c3a34" />
        <rect x="688" y="312" width="66" height="12" rx="2" fill="#2f3b55" />
        {/* loose papers */}
        <path d="M420,382 L478,376 L488,394 L428,400 Z" fill="#cbbb98" opacity="0.85" />
        <path d="M448,396 L502,392 L508,406 L454,410 Z" fill="#bdae8d" opacity="0.7" />
        {/* phone-calculator */}
        <rect x="530" y="398" width="34" height="20" rx="3" fill="#0a0a14" />
        <rect x="534" y="401" width="26" height="8" rx="1" fill="#2c3f57" />
      </g>

      {/* mug + steam */}
      <g transform="translate(452,352)">
        <g filter="url(#s2p)">
          <rect x="-11" y="0" width="24" height="22" rx="4" fill="#47313f" />
          <path d="M13,5 a7,7 0 0 1 0,13" fill="none" stroke="#47313f" strokeWidth="4" />
        </g>
        <path className="sc-steam" d="M-2,-4 C-6,-12 2,-16 -2,-24" fill="none" stroke="#f0dcc4" strokeWidth="2" strokeLinecap="round" />
        <path className="sc-steam" d="M6,-4 C2,-10 10,-16 6,-22" fill="none" stroke="#f0dcc4" strokeWidth="1.6" strokeLinecap="round" style={{ animationDelay: '2.8s' }} />
      </g>

      {/* Chanda, hunched over the ledger, lamp light on his back */}
      <g transform="translate(384,382)">
        <g fill="#0f0a19" filter="url(#s2p)">
          <path d="M-30,2 C-34,-22 -28,-46 -12,-56 C-2,-62 10,-60 17,-51 C24,-42 26,-22 23,2 Z" />
          <circle cx="14" cy="-60" r="12.5" />
          <path d="M18,-40 C30,-34 42,-28 54,-23 L51,-14 C39,-19 27,-25 15,-30 Z" />
        </g>
        <g fill="none" stroke="#ffb96b" strokeWidth="2" opacity="0.5">
          <path d="M17,-51 C24,-42 26,-22 23,2" />
          <path d="M22,-66 A12.5,12.5 0 0 1 26,-57" />
        </g>
      </g>

      <rect width="800" height="520" filter="url(#s2g)" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

/* Scene 3 — Sunday 19:40, the kitchen table at home. The upload: laptop glow,
   cyan data-light rising, dusk through the window. */
export function SceneUpload() {
  return (
    <svg viewBox="0 0 800 520" role="img" aria-label="Painterly scene: Chanda at his kitchen table on a Sunday evening — a laptop showing a small glowing chart lights his face while soft cyan data-light drifts up from the screen; a violet-and-amber dusk stands in the window behind him.">
      <defs>
        <linearGradient id="s3wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1e33" />
          <stop offset="1" stopColor="#3a2430" />
        </linearGradient>
        <linearGradient id="s3dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5d4b8c" />
          <stop offset="0.45" stopColor="#b56a56" />
          <stop offset="0.8" stopColor="#eda667" />
          <stop offset="1" stopColor="#f4c07d" />
        </linearGradient>
        <radialGradient id="s3glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#35d4ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#35d4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="s3lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb96b" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffb96b" stopOpacity="0" />
        </radialGradient>
        <filter id="s3p" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.013 0.02" numOctaves="2" seed="19" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
        </filter>
        <filter id="s3soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="s3g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="9" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.055 0" />
        </filter>
      </defs>

      <rect width="800" height="520" fill="url(#s3wall)" />

      {/* pendant lamp, top-left, warm counterpoint to the cool screen */}
      <g filter="url(#s3p)">
        <line x1="150" y1="0" x2="150" y2="66" stroke="#1d1526" strokeWidth="3" />
        <path d="M126,66 L174,66 L162,92 L138,92 Z" fill="#1d1526" />
      </g>
      <ellipse cx="150" cy="116" rx="88" ry="64" fill="url(#s3lamp)" opacity="0.7" />
      <circle cx="150" cy="80" r="7" fill="#ffd9a0" opacity="0.85" />

      {/* window with the dusk — rooftops and a msasa tree */}
      <g filter="url(#s3p)">
        <rect x="466" y="62" width="238" height="198" rx="6" fill="url(#s3dusk)" />
        <path d="M466,214 L520,214 L520,196 L560,196 L560,208 L618,208 L618,190 L664,190 L664,204 L704,204 L704,260 L466,260 Z" fill="#3a2338" />
        <rect x="626" y="176" width="14" height="16" fill="#3a2338" />
        <circle cx="500" cy="184" r="22" fill="#432840" />
        <rect x="497" y="196" width="6" height="20" fill="#432840" />
        <rect x="460" y="56" width="250" height="210" rx="8" fill="none" stroke="#1d1526" strokeWidth="9" />
        <line x1="585" y1="60" x2="585" y2="258" stroke="#1d1526" strokeWidth="6" />
      </g>
      {/* first stars in the dusk */}
      <circle className="sc-star" cx="540" cy="92" r="1.4" fill="#fff2d9" opacity="0.7" />
      <circle className="sc-star" cx="668" cy="108" r="1.2" fill="#fff2d9" opacity="0.6" style={{ animationDelay: '2.2s' }} />

      {/* table */}
      <path d="M0,362 L800,348 L800,520 L0,520 Z" fill="#31221d" filter="url(#s3p)" />
      <path d="M0,362 L800,348" stroke="#57392a" strokeWidth="2" opacity="0.5" fill="none" filter="url(#s3p)" />

      {/* laptop — a hint of the real dashboard, cyan on dark */}
      <g transform="translate(295,330)">
        <ellipse className="sc-beam" cx="0" cy="-16" rx="128" ry="84" fill="url(#s3glow)" filter="url(#s3soft)" />
        <g filter="url(#s3p)">
          <path d="M-62,-58 L62,-58 L70,24 L-70,24 Z" fill="#0a0e1c" stroke="#1f2b3f" strokeWidth="2" />
          <path d="M-70,26 L70,26 L84,42 L-84,42 Z" fill="#131826" />
        </g>
        <path d="M-54,-50 L54,-50 L60,17 L-60,17 Z" fill="#0d2033" />
        <g>
          <rect x="-46" y="-42" width="16" height="5" rx="1" fill="#17405a" />
          <rect x="-24" y="-42" width="16" height="5" rx="1" fill="#17405a" />
          <rect x="-2" y="-42" width="16" height="5" rx="1" fill="#17405a" />
          <path d="M-44,2 L-26,-6 L-8,-16 L12,-9 L36,-25" fill="none" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M-44,2 L-26,-6 L-8,-16 L12,-9 L36,-25 L36,12 L-44,12 Z" fill="#00d4ff" opacity="0.14" />
        </g>
      </g>

      {/* mug + phone */}
      <g filter="url(#s3p)">
        <rect x="168" y="338" width="22" height="20" rx="4" fill="#4a2f3a" />
        <path d="M190,342 a6,6 0 0 1 0,12" fill="none" stroke="#4a2f3a" strokeWidth="4" />
        <rect x="404" y="368" width="36" height="18" rx="3" fill="#0d0d16" />
      </g>

      {/* Chanda in profile, face lit by the screen */}
      <g transform="translate(478,356)">
        <g fill="#150e1e" filter="url(#s3p)">
          <circle cx="-4" cy="-64" r="13" />
          <path d="M-16,-52 C-24,-40 -27,-24 -25,-4 L-23,26 L23,26 L21,2 C23,-18 18,-40 6,-53 C-2,-59 -10,-58 -16,-52 Z" />
          <path d="M-20,-32 C-42,-26 -62,-16 -76,-6 L-72,3 C-54,-5 -36,-13 -18,-19 Z" />
        </g>
        <g fill="none" stroke="#7fe9ff" strokeWidth="2" opacity="0.55">
          <path d="M-14,-72 A13,13 0 0 0 -17,-59" />
          <path d="M-16,-52 C-24,-40 -27,-24 -25,-4" />
        </g>
      </g>

      {/* cyan data-light rising from the upload */}
      <g fill="#57e3ff">
        <circle className="sc-data" cx="258" cy="292" r="2.2" />
        <circle className="sc-data" cx="292" cy="276" r="1.7" style={{ animationDelay: '1.3s' }} />
        <circle className="sc-data" cx="322" cy="296" r="2.6" style={{ animationDelay: '2.7s' }} />
        <circle className="sc-data" cx="352" cy="282" r="1.6" style={{ animationDelay: '4.1s' }} />
        <circle className="sc-data" cx="276" cy="304" r="1.9" style={{ animationDelay: '5.4s' }} />
        <circle className="sc-data" cx="338" cy="308" r="2.1" style={{ animationDelay: '6.6s' }} />
        <circle className="sc-data" cx="308" cy="270" r="1.5" style={{ animationDelay: '7.8s' }} />
      </g>

      <rect width="800" height="520" filter="url(#s3g)" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

/* Scene 4 — 17:58, golden hour over the pit. The mine runs; the data-light
   now rises from the weighbridge. Chanda walks home. */
export function SceneGoldenHour() {
  return (
    <svg viewBox="0 0 800 520" role="img" aria-label="Painterly scene: the open pit at golden hour — terraces glowing amber under a low sun, a loaded tipper climbing the haul road, cyan data-light rising over the weighbridge office, and Chanda walking home in warm light.">
      <defs>
        <linearGradient id="s4sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d4a86" />
          <stop offset="0.38" stopColor="#c76a48" />
          <stop offset="0.72" stopColor="#efab62" />
          <stop offset="1" stopColor="#f7c87e" />
        </linearGradient>
        <radialGradient id="s4sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffdf9e" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffdf9e" stopOpacity="0" />
        </radialGradient>
        <filter id="s4p" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="23" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="8" />
        </filter>
        <filter id="s4soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="s4g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="14" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.055 0" />
        </filter>
      </defs>

      <rect width="800" height="520" fill="url(#s4sky)" />

      {/* sun + bloom */}
      <circle cx="545" cy="252" r="86" fill="url(#s4sun)" />
      <circle cx="545" cy="252" r="24" fill="#fff0c9" />

      {/* drifting clouds */}
      <g fill="#f4c692" opacity="0.4">
        <g className="sc-cloud">
          <ellipse cx="150" cy="118" rx="74" ry="12" />
          <ellipse cx="192" cy="108" rx="44" ry="9" />
        </g>
        <g className="sc-cloud" style={{ animationDuration: '46s', animationDelay: '-12s' }}>
          <ellipse cx="430" cy="76" rx="90" ry="11" />
          <ellipse cx="470" cy="66" rx="48" ry="8" />
        </g>
        <g className="sc-cloud" style={{ animationDuration: '40s', animationDelay: '-24s' }}>
          <ellipse cx="668" cy="150" rx="64" ry="10" />
        </g>
      </g>

      {/* birds */}
      <g fill="none" stroke="#58384a" strokeWidth="2" strokeLinecap="round">
        <path d="M250,142 q5,-5 10,0 q5,-5 10,0" />
        <path d="M288,128 q4,-4 8,0 q4,-4 8,0" />
        <path d="M318,146 q4,-4 8,0 q4,-4 8,0" />
      </g>

      {/* far ridge */}
      <path d="M0,296 C140,286 260,300 420,290 C560,282 660,296 800,288 L800,326 L0,326 Z" fill="#9a5c3b" filter="url(#s4p)" />

      {/* warm terraces */}
      <g filter="url(#s4p)">
        <path d="M0,318 C160,310 400,322 620,312 C700,308 760,312 800,308 L800,352 C600,360 240,364 0,356 Z" fill="#b5764a" />
        <path d="M30,356 C260,366 540,362 800,350 L800,396 C560,406 260,408 60,398 Z" fill="#93583a" />
        <path d="M90,398 C300,408 560,404 770,392 L750,438 C540,446 300,448 130,438 Z" fill="#74422c" />
        <ellipse cx="430" cy="458" rx="270" ry="30" fill="#6b3d28" />
        <path d="M800,340 C700,356 620,386 560,422 C540,434 520,444 505,448 L545,454 C580,438 650,398 730,370 C762,359 786,352 800,350 Z" fill="#a86a42" />
      </g>
      <g fill="none" stroke="#ffd9a0" strokeWidth="2" opacity="0.45" filter="url(#s4p)">
        <path d="M0,318 C160,310 400,322 620,312 C700,308 760,312 800,308" />
        <path d="M30,356 C260,366 540,362 800,350" />
        <path d="M90,398 C300,408 560,404 770,392" />
      </g>

      {/* conveyor rising out of the pit to a stockpile beside the office */}
      <g filter="url(#s4p)">
        <path d="M160,334 L232,334 L196,296 Z" fill="#6e402a" />
        <line x1="420" y1="446" x2="206" y2="334" stroke="#402818" strokeWidth="5" />
        <line x1="360" y1="415" x2="360" y2="446" stroke="#402818" strokeWidth="3" />
        <line x1="300" y1="384" x2="300" y2="422" stroke="#402818" strokeWidth="3" />
        <line x1="252" y1="358" x2="252" y2="394" stroke="#402818" strokeWidth="3" />
      </g>

      {/* weighbridge office, cyan data-light above it */}
      <g transform="translate(104,318)">
        <g filter="url(#s4p)">
          <rect x="0" y="-24" width="46" height="24" rx="2" fill="#7c4a30" />
          <path d="M-3,-24 L49,-24 L46,-30 L0,-30 Z" fill="#5e3722" />
          <line x1="40" y1="-24" x2="40" y2="-50" stroke="#5e3722" strokeWidth="2" />
        </g>
        <rect x="8" y="-17" width="10" height="9" rx="1" fill="#fff3d6" />
        <g fill="#18d7ff">
          <circle className="sc-data" cx="12" cy="-38" r="2.6" />
          <circle className="sc-data" cx="26" cy="-46" r="2.2" style={{ animationDelay: '1.8s' }} />
          <circle className="sc-data" cx="38" cy="-34" r="2.8" style={{ animationDelay: '3.6s' }} />
          <circle className="sc-data" cx="20" cy="-28" r="2" style={{ animationDelay: '5.6s' }} />
          <circle className="sc-data" cx="32" cy="-56" r="2" style={{ animationDelay: '7.2s' }} />
        </g>
      </g>

      {/* loaded tipper climbing out, dust behind it */}
      <g transform="translate(646,384)">
        <g fill="#2f1c14" filter="url(#s4p)">
          <rect x="18" y="-12" width="13" height="10" rx="1.5" />
          <path d="M-28,-15 L17,-13 L18,-2 L-30,-2 Z" />
          <path d="M-26,-15 L14,-13 L8,-20 L-20,-21 Z" fill="#402617" />
          <circle cx="-20" cy="0.5" r="4.6" />
          <circle cx="-2" cy="0.5" r="4.6" />
          <circle cx="24" cy="0" r="4.6" />
        </g>
        <path d="M18,-12 L31,-12" stroke="#ffca8f" strokeWidth="2" opacity="0.7" fill="none" />
        <g fill="#e8c49a">
          <circle className="sc-dust" cx="-42" cy="0" r="2.4" />
          <circle className="sc-dust" cx="-54" cy="4" r="1.8" style={{ animationDelay: '2.4s' }} />
          <circle className="sc-dust" cx="-66" cy="2" r="2" style={{ animationDelay: '4.8s' }} />
        </g>
      </g>

      {/* Chanda walking home, sun at his back */}
      <g transform="translate(628,474)">
        <g fill="#2a1620" filter="url(#s4p)">
          <path d="M-8.5,-60 Q-1,-68 7,-60 L8.5,-58.8 Q-1,-62.4 -9.5,-58.8 Z" />
          <circle cx="-1" cy="-54" r="6.5" />
          <path d="M-7,-46 C-9,-38 -10,-26 -6,-16 L4,-14 C8,-26 8,-40 4,-46 C0,-50 -4,-50 -7,-46 Z" />
          <path d="M-4,-17 L-12,-9 L-15,1 L-10,2 L-3,-8 Z" />
          <path d="M1,-17 L8,-8 L12,1 L7,2 L0,-10 Z" />
          <path d="M-5,-42 C-12,-36 -16,-29 -18,-21 L-14,-19 C-10,-27 -7,-33 -3,-38 Z" />
        </g>
        <g fill="none" stroke="#ffca8f" strokeWidth="2" opacity="0.7">
          <path d="M-7,-46 C-9,-38 -10,-26 -6,-16" />
          <path d="M-7.5,-56 A6.5,6.5 0 0 1 -4,-60" />
        </g>
      </g>

      {/* foreground ground */}
      <path d="M0,486 C240,476 560,482 800,472 L800,520 L0,520 Z" fill="#4a2b1f" filter="url(#s4p)" />

      <rect width="800" height="520" filter="url(#s4g)" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}
