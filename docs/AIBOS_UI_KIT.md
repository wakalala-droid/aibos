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
- Geist only. Nothing in a sentence under 18px; spaced capitals at least 16px. Taps at least 44px. Contrast at least 4.5:1.
- Numbers are ink. Red only for a figure that went the wrong way (`trendTone`, `signTone`).
- Charts use `--chart-1..6` and `--chart-muted`.
- No em-dashes, no comma before "and", no emoji. Plain owner words.
- No entrance animation on page content; icons move on hover only. No blurred sticky headers.
- Phones: everything fits at 320px. Long words wrap, never cut off; card contents use the full width under the icon and title.
