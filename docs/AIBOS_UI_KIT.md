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

## Website motion (the public website only)
The app stays still. The public website (`app/(marketing)`) may move, but only with the kit's own movements and timings from `globals.css`, so it feels like the app arriving:
- **Hero, once on load:** the brand curve `cubic-bezier(0.2, 0.7, 0.2, 1)` over 0.7s (`brand-rise`). The headline and the video rise without fading, so the largest paint is never held back.
- **Blocks scrolling into view, once:** 12px over 200ms, like a notice (`update-in`); grids one card after another (`components/marketing/Rise.tsx`). Anything on screen at load just shows.
- **Lines:** the art strip's money line draws itself over 1.1s, like What's new (`whatsnew-draw`). Report bars and meters fill to their figure.
- **Notices:** the morning brief arrives like the update notice; a reminder slides in 24px from the right (`reminder-in`).
- **Hero video:** `components/marketing/HeroVideo.tsx` plays a video of the kit in action. It is made from these same kit pieces in `aibos-film` (`npm run render:hero`), with a laptop cut and a phone cut. It is muted, loops, pauses off screen and has a Pause button.
- Nothing loops on its own except the video, nothing floats and nothing blocks the page. With `prefers-reduced-motion` none of it runs and the video waits for Play.
- Phones: everything fits at 320px. Long words wrap, never cut off; card contents use the full width under the icon and title.
