# AI-BOS Motion Design Video — Prompt for Claude Fable 5

Paste everything below the line into a fresh Fable 5 session (Claude Code recommended, so it can build and render the video as a Remotion project).

---

You are a world-class motion designer and Remotion engineer. Your mission: build a **75-second product motion-design film for AI-BOS** — cinematic, precise, Humble-grade craft — that shows off the platform's robust capabilities and ends with the viewer wanting to type their first question into it. You will produce a real, renderable video (Remotion + TypeScript → MP4), not a mockup or storyboard.

## 1. What AI-BOS is (ground truth — do not embellish beyond this)

AI-BOS is a financial-intelligence SaaS for African SMEs, built in Lusaka, priced in Zambian Kwacha, paid via mobile money (MTN MoMo, Airtel Money). Its core promise: **"Ask your business anything."**

Its real, shipped capabilities — this is your material:

- **The Spine (event-sourced nervous system):** any input becomes a Business Event, events fold into a live Digital Twin, the twin feeds every engine and dashboard. Pipeline: *any input → Business Event → Digital Twin → intelligence*. Replayable, auditable, nothing lost.
- **Multi-modal capture:** speak it (voice → structured event), photograph a receipt (vision OCR → proposed purchase), scan a QR code, import an Excel file with AI column-mapping, or just type a sentence in plain language. Every proposal is human-reviewed before it's saved — the human confirms, the system learns (corrections become Business Memory: aliases, category rules).
- **Five engines:** ① Financial (P&L, cashflow, runway) ② Market/Customer (segments, champions/loyal) ③ Operations/POS ④ Forecasting (honest, residual-based 95% prediction intervals — the band widens where uncertainty is real) ⑤ Decision (prioritized recommendations with expected ROI + what-if simulation: price, volume, cost, hiring).
- **Radical honesty as a feature:** a Data Manifest that "shows its working" — every number traceable to its source rows. Losses are not clamped. Anomalies are flagged with z-scores. Recommendations pass a validation gate before they're shown.
- **Scheduler & automation:** scheduled email briefs, recurring records, a morning brief.
- **Floating AI assistant:** ask anything, long-press any element to have it explained.

Demo dataset to reuse everywhere (it's coherent — keep it consistent): **Zoe's Kitchen, Lusaka** — K3.71M revenue, K1.12M profit, 30.2% margin, business health 75, best month December, worst September.

## 2. Brand system (NON-NEGOTIABLE — violating these fails the deliverable)

- **Typography: Geist is the ONLY typeface. Everywhere. Including every number** (use Geist's tabular figures for counters and KPIs). No mono fonts, no serif accents, no exceptions.
- **Palette:** dark navy base `#0a0e1a` (deep end `#06090f`), warm paper light `#f4f3ef` / `#EAE5DB` for interlude beats, and **cyan `#00d4ff` as the single accent**. No other accent colors. Semantic amber/red allowed only for the anomaly beat.
- **The signature gradient:** cyan area-fill falling from under a chart line — line at full `#00d4ff`, fill fading from ~0.34 opacity to transparent. This is THE brand motif. Never a white→dark fade (it reads as grey mud). Use it as the recurring visual thread of the film.
- **Lines are 2px solid.** No 3px ribbons, no thick borders. Radius scale: 6 / 10 / 16 only. Spacing scale: 4·8·12·16·24·32·48·64.
- **Card language:** dark cards with a subtle cursor-glow edge; warning/critical states get a pulsing amber/red ring (use this exactly once, for the anomaly moment).
- **No hero-character narrative.** No fictional protagonist story, no painterly illustration scenes. This film is product-led: the interface, the data, and the type do the acting.

## 3. Honesty rules (the brand's soul — enforce them in the film itself)

- Show only capabilities listed in §1. Do not invent features, integrations, or claims.
- All numbers on screen come from the Zoe's Kitchen dataset and must stay internally consistent across scenes.
- The forecast scene MUST show the uncertainty band honestly — a confident line inside a visibly widening interval. Never depict the future as a single certain line.
- No fake testimonials, no fabricated customer counts, no "trusted by 10,000 businesses."

## 4. The film — narrative arc and storyboard (75s @ 30fps, 1920×1080)

Arc: *name the pain → the business speaks → the spine listens → the twin lights up → the engines think → the decision lands → aspire.*

**Scene 1 — The Pain (0:00–0:07), dark navy.**
Kinetic typography, Geist, huge: "You're not making bad decisions." — beat — "You're just deciding without the numbers." Words assemble with staggered spring easing; a faint 2px cyan line begins drawing at the bottom edge — it will persist and grow through the entire film.

**Scene 2 — The Business Speaks (0:07–0:16).**
Fast, rhythmic montage of abstract input glyphs on navy: a pulsing mic waveform, a camera flash framing a receipt, a QR matrix resolving, an Excel grid of raw rows, a chat bubble with a plain sentence ("sold 40 crates to Mrs Banda, K2,800"). Each input rendered as clean geometric UI, not photos. Caption: "Your business already speaks. Voice. Photo. QR. Excel. Chat."

**Scene 3 — The Spine (0:16–0:28).**
The hero mechanism. All five input glyphs are pulled into a single horizontal event stream — each becomes an identical glowing event chip flowing left→right along the persistent cyan line. Chips stamp through three gates labelled in small Geist caps: BUSINESS EVENT → DIGITAL TWIN → INTELLIGENCE. On the twin gate, a wireframe of the business "inflates" from the events. Caption: "One nervous system. Everything becomes an event. Nothing is lost."

**Scene 4 — The Twin Lights Up (0:28–0:42).**
The event stream flows into a dark dashboard that builds itself: four KPI cards spring in (Revenue K3.71M, Profit K1.12M, Margin 30.2%, Health 75 — Geist tabular numbers counting up), then the revenue line draws across the full frame with the **signature cyan area-fill** blooming beneath it. One card's edge pulses amber — an anomaly flagged on a z-score spike — and a small honest annotation pins to it. Caption: "A live digital twin of your business. It even tells you when something looks wrong."

**Scene 5 — Five Engines (0:42–0:54).**
Camera pulls back: the dashboard becomes one of five panels arranged along the cyan line — Financial, Customer, Operations, Forecasting, Decision — each panel a miniature living chart (cashflow bars, customer segment donut, ops throughput, forecast line inside a widening 95% band, a ranked recommendation list). The forecast band visibly widens into the future. Caption: "Five engines. One answer away."

**Scene 6 — The Decision (0:54–1:06), the emotional peak.**
A single Decision card fills the frame: a recommendation with expected ROI, then a what-if slider drags ("price +5%") and downstream numbers re-flow live along connecting 2px lines. Below it, Data Manifest rows tick in one by one — the proof trail. Caption: "Not just charts. Decisions — with the working shown."

**Scene 7 — Aspire (1:06–1:15), close.**
Cut to warm paper `#f4f3ef` for the first time — daylight after the deep navy. The persistent cyan line resolves into an underline beneath giant Geist type: **"Ask your business anything."** Then the AI-BOS wordmark, small line "Built in Lusaka. Priced in Kwacha. Paid by mobile money." End card: the URL. Hold 2 seconds.

## 5. Motion language

- Easing: springs for entrances (damping ~14), `cubic-bezier(0.22, 1, 0.36, 1)` for moves; nothing linear except the event-stream flow.
- Continuity device: the single cyan line that starts in Scene 1 and becomes the underline in Scene 7 — every scene transition happens ALONG it (the camera travels the line; scenes don't hard-cut, they slide).
- Numbers always animate as counting tabular-figure Geist, never fade in pre-formed.
- Charts always draw on (pathLength-style), with the cyan area-fill revealing beneath the line as it draws.
- Type is huge and confident (display sizes ~90–120px at 1080p), tight leading, generous negative space. Small caps labels at 12–14px with letter-spacing for system labels only.
- Rhythm: Scenes 2–3 are fast (beats every ~0.8s); Scenes 4–6 breathe; Scene 7 is still.

## 6. Technical spec

- **Remotion 4 + TypeScript + React.** One master `Composition` (2250 frames, 30fps, 1920×1080) sequencing seven scene components. Shared `theme.ts` exporting the exact color/spacing/radius tokens from §2.
- Bundle Geist locally (woff2, weights 400/500/700, tabular-nums feature enabled) — do not fall back to system fonts.
- Charts hand-built in SVG inside Remotion (interpolate pathLength/points per frame) — no chart library needed; you control every pixel.
- Deliver: `npx remotion render` → `out/aibos-film.mp4` (H.264, high bitrate). Also register a 1080×1920 vertical composition reusing the same scenes recomposed for social.
- Verify your work: render at least 6 spot-frames (`npx remotion still`) across the timeline — one per scene — and inspect them against §2 before declaring done. Check: Geist everywhere, cyan-only accent, area-fill correct, no grey gradients, numbers tabular.

## 7. Quality bar

This must look like it came from the same studio as the best product films from Vercel or Linear: restrained, typographic, physics-perfect, zero clip-art energy. If a frame would embarrass a design-obsessed founder showing investors, redo it. When in doubt: fewer elements, bigger type, more darkness, one cyan line.
