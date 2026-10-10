# AI-BOS UI kit

The AIBOS x Mercury look, as one pack. Every page, notice, reminder, alert, toast, email and PDF is built from these pieces. Never a stock or library look.

Import: `import { Notice, BentoCard, NoticeArt, BrandMark } from '@/components/kit';`

## Brand elements
- **The mark** (`BrandMark`): white glyph on dark, navy on light. Files in `public/brand/`.
- **The splash art strip** (`NoticeArt`, `.notice-art-strip`): hairline tiles, the rising cyan money line with soft shading, the AIBOS mark in a white disc inside a dashed ring in the middle, a cyan point on the ring, and the rising double arrow at the top right in ink.
- **The corner wash**: one faint light from the top-left corner of every card (`--card-wash`).
- **Emails** use `public/brand/email-art.png` (the same strip as an image) and the grey mark in the footer. **PDFs** put the grey mark beside the footer words on every page.

## Pieces
| Piece | Use it for | Classes |
| --- | --- | --- |
| `Notice` | updates, payment and meeting reminders, low money, plan, install, offline | `.notice`, `.notice-floating`, `.notice-bad` |
| `BentoCard` + `bentoSpans` | findings, briefs, small cards, locked previews | `.bento`, `.bento-grid`, `.span-*` |
| `Panel`, `SectionCard` | report panels with a title and one action | `.panel`, `.panel-head` |
| `BigMoney`, `Stat` | headline figures | `.money` |
| `ChartKey` | the key above a chart | |
| Round icon | lucide icon in `.bento-icon` (48px, 44px in notices) | `.bento-icon` |
| Title and tag | spaced capitals title, small spaced tag | `.bento-title`, `.bento-tag` |
| Buttons | brand pill for the one action, quiet pill for the rest | `.pill-primary`, `.pill-quiet`, `.icon-pill` |
| Filters | rounded chips that wrap | `.chips`, `.chip` |
| Lists | a row with name, detail and amount | `.row`, `.row-title`, `.row-sub`, `.row-amount` |
| Small figures | side by side inside a card | `.mini-stats`, `.mini-stat` |

## Rules
- Geist only. Mercury-standard sizes (owner, 7 Oct 2026): body 15px, data and labels 14px, spaced capitals 12px, card titles 17px, page titles 22px. Taps at least 44px. Contrast at least 4.5:1.
- Numbers are ink. Red only for a figure that went the wrong way (`trendTone`, `signTone`).
- Charts use `--chart-1..6` and `--chart-muted`.
- No em-dashes, no comma before "and", no emoji. Plain owner words.
- No entrance animation on page content; icons move on hover only. No blurred sticky headers. (The public website has one scoped exception, below.)

## Website navy (the public website only)
The owner, 10 Oct 2026: "too much white going on, add dynamic dark navy blue like on the AI section on most of the site". The app keeps its own light and black themes; the website is navy.
- The website root carries `data-theme="dark"` and `app/(marketing)/marketing.css` turns the kit's dark tokens into the navy: page `#050b18`, cards `#0b1629`, blue-tinted hairlines and greys (text-3 8.5:1 and text-4 7.0:1 on cards). Every kit piece arrives in navy with no one-off class.
- **The product stays light.** The hero video, the feature theatre's scenes, the morning brief and the last Start free card are the light app floating on navy: give the block `data-theme="light"` (Rise takes `theme="light"`). White appears only as the product, never as the page.
- **The sky** (`.mkt-sky` in the website layout): three soft lights (blue, cyan, indigo) drifting on 46, 58 and 70 second clocks, sliding a little with the scroll where the browser supports it. Transforms only, on one fixed layer, no blur filters.
- Legal pages read on a light panel (`.mkt-paper` with `data-theme="light"`). The white mark and wordmark sit on navy. The phone's browser bar is navy.

## Website motion (the public website only)
The app stays still. The public website (`app/(marketing)`) may move, but only with the kit's own movements and timings from `globals.css`, so it feels like the app arriving:
- **Hero:** never animates. Its text is the largest paint on a phone and animating it delays it. The video does the moving.
- **Blocks coming into view, once (starting just before they reach the screen):** 12px over 200ms, like a notice (`update-in`); grids one card after another (`components/marketing/Rise.tsx`). Anything on screen at load just shows.
- **Lines:** the art strip's money line draws itself over 1.1s, like What's new (`whatsnew-draw`). Report bars and meters fill to their figure.
- **Notices:** the morning brief arrives like the update notice; a reminder slides in 24px from the right (`reminder-in`).
- **Hero video:** `components/marketing/HeroVideo.tsx` plays a video of the kit in action. It is made from these same kit pieces in `aibos-film` (`npm run render:hero`), with a laptop cut and a phone cut. It plays on its own, muted and looping, with no buttons (owner, 9 Oct 2026). MP4 (H.264) only, never WebM first (Edge on Windows froze on it), and written as plain HTML so the browser starts it before any script loads.
- **Feature theatre** (`components/marketing/FeatureTheatre.tsx`, scenes in `components/marketing/theatre/`): payroll, getting paid, deadlines, stock and Rooms & Stays, each a scene of about seven seconds built from kit pieces with the product's real figures (the payslip comes from `aibos-api/payroll.py`). A beat clock flips `is-on` on a few beats and CSS moves the pieces in kit timing. It plays only while a third of it is on screen, moves on by itself with a 2px line under the tab, pauses under a resting mouse and stops when a tab is chosen.
- **Pain to promise:** the brand line strikes each old job through and the answer rises in its place. **The goal:** four large lines light up once each reaches the middle of the screen.
- Only the video, the sky and the theatre loop, nothing floats over the content and nothing blocks the page. With `prefers-reduced-motion` none of the page motion runs (the sky is still and the scenes show their finished picture); the hero video still plays.
- Phones: everything fits at 320px. Long words wrap, never cut off; card contents use the full width under the icon and title.
