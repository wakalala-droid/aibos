# AI-BOS — Landing & Pricing Page Execution Brief
**For a fresh Claude Code conversation. Read this entire file before writing any code.**
Goal: a top-notch, emotionally-converting marketing site for AI-BOS, built to the same
craft bar as **https://humblefactory.ai/** — adapted to AI-BOS (AI Business Operating
System for African SMEs, priced in ZMW). This is a *marketing* surface, separate from
the product app, but it must feel like the same company.

---

## 0. Read these first (binding context)
1. **The Design OS** — `C:\Users\User\Desktop\Elite Builder System V1.0\design os\` (10 files).
   Every screen must pass `critique_engine.md`'s six levels. Especially:
   - `conversion_psychology.md` — AI-BOS's *actual* pricing doctrine (tiers, ZMW, mobile
     money, locked-but-visible, banned dark patterns). **The pricing page must obey it.**
   - `visual_language_system.md`, `motion_governance.md` (see §4 — the landing page takes a
     **documented exception** to the in-product motion ban), `accessibility_system.md`
     (WCAG 2.1 AA, prefers-reduced-motion), `responsive_design_system.md` (375→1440px).
2. **The investor proposal** — `AIBOS_Business_Proposal.docx` content: the 5 engines, the
   "Without AI-BOS / With AI-BOS" table, the vision ("the brain behind every business").
   The before/after table is the emotional spine of the landing page — reuse it.
3. **Humble reference** — study every page of https://humblefactory.ai/ (home, /pricing,
   /about, /security, the "fit" page). The structural map is in §3. **Borrow the
   *structure and psychology*, not the copy or the manufacturing framing.**

---

## 1. Who we convert (the emotional target)
A Lusaka/African SME owner — restaurant, retailer, e-commerce, hospitality, mine, or
service business. They are **smart but flying blind**: decisions on gut, spreadsheets,
and expensive ad-hoc advice. They feel **anxious, reactive, behind**. They distrust
"enterprise software" (too expensive, too complex, not built for them) and are wary of
AI ("will it leak my numbers / hallucinate / replace me?").

The page must move them from **"I'm guessing and it's costing me"** → **"I have a CFO,
analyst and consultant in my pocket, in Kwacha, that I can afford."** Every section earns
the next scroll by resolving a specific fear or unlocking a specific desire.

---

## 2. Visual language (translate Humble → AI-BOS)
Humble's craft signals, and the AI-BOS analog:

| Humble device | What it does | AI-BOS translation |
|---|---|---|
| Warm off-white bg (#f4f3ef), black text, **orange** accent | Premium, human, un-corporate | **DECISION NEEDED — see §10.** Either (a) carry AI-BOS's product identity (deep navy/near-black + **cyan** `--cyan #00d4ff` + engine accents) for continuity, or (b) a warm "premium light" marketing skin. Recommendation: a **light, premium marketing theme** (warm paper bg, near-black ink, cyan + the 3 engine accents as highlights) — bright and trustworthy for first-time SME viewers, while the product stays dark. Reuse the exact Design OS tokens. |
| Painterly, anime-style hero illustration (factory in a green valley at sunset) | Aspirational, calm, "your world but better" | A painterly **African business scene** — a Lusaka high-street shop / market / restaurant at golden hour, warm and hopeful, with subtle data/light motifs. Commission or AI-generate at high res; one consistent illustrator style across all hero/footer scenes. |
| Glossy **3D floating chips** with iridescent edges (ERP/QMS/MES/XLSX) | "Powerful systems, made tangible" | The **5 engines as floating 3D objects**: Financial (AI CFO), Customer, Operations, Forecasting, Decision. Glassy, soft-blurred, slow float. Built in Spline/Three.js or pre-rendered PNG/WebP sprites with CSS transform float. (See §4 for motion + the in-product ban.) |
| Bold grotesque headlines, generous whitespace, centered sections | Confident, calm, scannable | Inter 800/900 for headlines (already the product font), JetBrains Mono for eyebrows/labels. Big type, lots of air, one idea per section. |
| Small accent **eyebrow labels** ("Where Humble Fits Best", "60 Seconds Flat") | Orient + add rhythm | Mono uppercase eyebrows in cyan/engine accent above each section. |
| Horizontal **feature/trust pill strip** under hero | Fast credibility | Pills: "Free to start · Priced in ZMW · MTN & Airtel Money · Upload & go · Your data stays yours". |
| Dark footer with brand mark + tagline | Anchor | Dark footer, AI-BOS mark, tagline ("The brain behind every business."), nav, contact. |

---

## 3. Humble's structural map (the conversion skeleton to adapt)
From studying every page — replicate the *order and intent*, not the words:

**Home:** Hero (outcome promise + dual CTA) → "Meet [brand]" one-liner → **"Today's
Reality"** (before, pain, paper/chaos) → **"The Shift"** (after, live/validated) → feature
pillars each with a product video/visual ("built around your work", "zero distractions",
"data foundation", **"Your Everyday Genius — ask anything, get answers instantly"**) →
**competitive matrix** (vs Big-Box ERP / DIY / Do-Nothing) with risk-reversal row → final
CTA. Devices: problem-first, before/after, specificity (Day 3, 24h), risk reversal
("Paid First Sprint, 100% refund if we miss"), self-qualification ("60-Second Fit Test"),
founder story.

**Pricing & ROI:** "Choose your Plan (per site)" → 3 tiers as cards with check-list
inclusions + per-tier CTA → **"What counts as a workflow (plain English)"** → **"Generic
Examples — Pick yours"** photo grid → "What's included with each instance" icon row →
**"Timeline & Effort"** numbered steps with 3D objects → **"Effort Required from you"**
table (Champion / Operators / Decision cadence / IT) → final CTA "Ready to run the numbers?".

**Trust/Security ("Trust Center"):** hero ("One truth everyone trusts") → 3D floating
objects (ERP/QMS/MES/XLSX) → **Promise / How we do it** card grid (data stays yours, AI
without leak risk, no surprises in prod, enterprise foundations, data residency, plug into
what you run, prove it safely) → compliance badge → security@ contact.

**About ("Make every factory on Earth intelligent"):** big vision headline → founder
**video** ("Building the future / Our Story") → narrative arc: **Your Reality Today → Your
Factory Tomorrow → The World We're Building → Our Commitment to You → Ready?** → final CTA.

**"Where it fits" / Fit Test:** photo rows of ideal fits → industry examples (3D objects)
→ **self-qualification checklist** ("Is it right for you?") → "What we need from you" →
"Time at a glance" → de-risk dark cards.

---

## 4. Motion & animation (the important nuance)
`motion_governance.md` governs the **product** and explicitly **bans** parallax,
auto-playing decorative loops, floating shapes, and background video. **A marketing
landing page is a different surface** and needs richer, brand-building motion. This brief
grants a **scoped marketing-motion exception**, with non-negotiable guardrails:

- **Opening animation (hero):** a calm, ~1.2–2s reveal — the painterly scene settles in,
  headline rises (fade + slide-up, ease-out), the 5 engine objects drift in and begin a
  slow idle float. One-time on load; never loops aggressively.
- **3D floating engine objects:** slow idle float/rotate (gentle, 8–14s cycle), soft blur
  + depth, subtle parallax to cursor (not scroll-jacking). Use Spline embed or pre-rendered
  sprites; lazy-load; pause when offscreen.
- **Scroll reveals:** sections fade + 8–16px rise on enter (IntersectionObserver), staggered.
- **Product visuals:** short looping screen captures / Lottie of real AI-BOS tools (the AI
  CFO answering, a forecast drawing in, the dashboard lighting up).
- **GUARDRAILS (non-negotiable, from the doctrine's spirit):**
  - `prefers-reduced-motion: reduce` → all of the above collapse to instant/opacity-only.
  - Motion **never blocks interaction or content**; the page is fully usable if JS/animation
    fails. No scroll-jacking. Keep it tasteful, not a tech demo.
  - Performance budget: LCP < 2.5s, hero usable without waiting on the 3D. Defer/lazy 3D.
- Document this exception at the top of the landing code so it's clearly *intentional* and
  doesn't get "corrected" against the in-product rule.

---

## 5. Page-by-page spec

### 5.1 Home (`/` marketing — note: product currently redirects `/`→dashboard; the
marketing site likely lives on the apex domain / a separate route or app. Decide hosting
in §9.)
1. **Hero.** Eyebrow ("THE BRAIN BEHIND EVERY BUSINESS"). Headline: outcome, not features
   — e.g. *"Ask your business anything. Get the answer, in Kwacha, instantly."* Sub: one
   sentence on what it is + who it's for. Dual CTA: **primary "Start free — upload your
   data"**, secondary **"See pricing"** (prices are public — `conversion_psychology.md`).
   Painterly scene + the 5 floating engine objects.
2. **Trust pill strip** (see §2).
3. **"Your business today"** (BEFORE) — the anxious reality: month-old numbers, guessing
   inventory, discovering cashflow problems when they hit, generic decisions. Pull verbatim
   from the proposal's "Without AI-BOS" column.
4. **"Your business with AI-BOS"** (AFTER) — the proposal's "With AI-BOS" column, as a
   visual contrast (split or toggle). This is the emotional turn.
5. **The 5 engines** — each as a 3D object + one-line value + a real product visual:
   Financial/AI-CFO, Customer, Operations, Forecasting, Decision. "Five expert departments
   reporting to one AI command center."
6. **"Ask your business anything"** — showcase the AI CFO chat with a real Q&A
   (*"Which product made the most money last month?"* → real answer). This is the wow.
7. **"How it works"** — 3 steps: Upload your data → AI-BOS reads & analyses it (show the
   read-fidelity manifest!) → Get answers, briefs, decisions.
8. **Who it's for** — industry tiles (Restaurants, Retail/E-com, Hospitality, Mining,
   Services) with one painted scene each.
9. **Self-qualification** — "Is AI-BOS right for you?" checklist (mirrors Humble's fit test).
10. **Trust strip** — "Your data stays yours · private AI · export anytime" (ties to Trust
    Center + the banned-dark-patterns list as *positive* trust signals).
11. **Final CTA** — "Ready to see your numbers think?" → Start free / See pricing.
12. **Footer.**

### 5.2 Pricing & ROI (the page the user wants most detailed + animated)
Match the screenshot's density and polish, but **obey `conversion_psychology.md`**:
- **Three tiers** = AI-BOS's real tiers (`lib/tiers.ts`): **Free / Pro / Growth**, **in
  ZMW** (USD secondary only). Each as a card with a checkmark inclusion list and its own
  CTA. Free = "proves it's real" (Engine 1, locked-but-visible previews). Pro = default
  paid. Growth = multi-location + cross-engine.
- **Mobile money is first-class** at checkout (MTN MoMo, Airtel Money) — show the logos on
  the pricing page, not buried. Annual = transparent "2 months free", never pre-selected.
- **Animated, with REAL AI-BOS tool screenshots** (capture list in §6): as each tier/feature
  is described, show the actual dashboard / AI CFO / forecast / manifest, animating in on
  scroll. No mockups — real product.
- **"What counts as a feature (plain English)"** — demystify, like Humble's "what counts as
  a workflow".
- **Interactive ROI calculator** — the emotional+rational close: user enters monthly
  revenue / # products / hours spent on spreadsheets → estimated time saved + decisions
  improved + payback. (Humble's "Ready to run the numbers?" made literal.) Keep claims
  honest and ranged — no fabricated precision (ties to the SAFEGUARD no-fabrication ethos).
- **Timeline & effort** — "From upload to first insight in minutes; full picture in a day."
- **Locked-but-visible** teasers consistent with the in-product pattern.
- Banned (from doctrine): countdown timers, fake "X viewing", drip fees, pre-selected
  add-ons, hidden cancellation. These FAIL critique Level 4.

### 5.3 Trust Center (`/trust` or `/security`)
Promise / How-we-do-it card grid adapted to AI-BOS reality: **"Your data stays yours"**
(export anytime, even after cancel — it's in the banned-patterns list, sell it as a
promise), **"AI without the leak risk"** (how Groq is used; no training on your data),
**"No fabrication"** (cite the SAFEGUARD — AI-BOS refuses to invent trends; show the
manifest), **"Built on Supabase + enterprise auth"**, **data residency**, **"Prove it
safely"** (free tier = try before paying). Contact: a real security email.

### 5.4 About / Story
Vision headline ("Make every African business intelligent"), founder video/story, the
proposal's narrative arc (Reality Today → Tomorrow → The World We're Building → Our
Commitment → Ready). Authentic, first-person, Lusaka-rooted.

---

## 6. Real assets to capture (no mockups — use the live product)
Screen-record / screenshot at 2x on a seeded demo account:
- Dashboard overview (KPIs + Unified Engine Intelligence + cursor glow).
- AI CFO chat answering a real business question.
- Forecast drawing in (time-series file) — and the honest "no time axis" state as a *trust*
  proof.
- The read-fidelity manifest ("How AI-BOS read your file") + per-item economics.
- A scheduled AI brief (email/WhatsApp mock from real content).
- Mobile views (the product is mobile-first).
Store under `public/marketing/` as optimized WebP + short MP4/Lottie. Alt text required.

---

## 7. Conversion-psychology checklist (map Humble → AI-BOS, doctrine-compliant)
- Problem-first before/after ✓ (proposal table)
- Specificity ✓ ("answers in seconds", "minutes to first insight" — only true numbers)
- Risk reversal ✓ (free tier = the honest version of "100% refund"; "export anytime")
- Self-qualification ✓ (fit checklist)
- Founder authenticity ✓ (story/video)
- Aspirational vision ✓ ("the brain behind every business")
- Local trust ✓ (named Lusaka testimonials once 3–5 customers exist; placeholder slot now)
- Prices public, ZMW-first, mobile money ✓
- **No banned tactics** (see `conversion_psychology.md` EXPLICITLY BANNED) — reviewed at
  critique Level 4.

---

## 8. Accessibility & quality bar (non-negotiable)
WCAG 2.1 AA, keyboard operable, visible focus, one `<h1>`/page, semantic landmarks,
`prefers-reduced-motion`, alt text on every image, colour-contrast ≥ 4.5:1 for text.
Works 375 / 768 / 1024 / 1440px. `next build` clean (the gate is enforced). Run the
critique_engine's six levels before "done".

---

## 9. Tech & hosting
- Next.js 14 App Router + TypeScript + Framer Motion (already in stack). 3D via
  `@splinetool/react-spline` or a lightweight Three.js scene, lazy-loaded.
- **Hosting decision:** the product app redirects `/`→`/login`→`/dashboard`. Options: (a)
  marketing at the apex with the app on `/app` or `app.` subdomain; (b) a separate Next app
  for marketing. Recommend a separate route group `app/(marketing)/` with its own layout
  (no AppShell/sidebar) and the marketing theme, OR a dedicated subdomain. Decide before build.
- SEO: real metadata, OG images (use a hero render), sitemap, fast LCP. Marketing pages are
  public (not behind `middleware.ts` auth — update the matcher).

---

## 10. OPEN QUESTIONS — discuss before building
1. **Identity:** keep AI-BOS dark-cyber for the landing, or a warm "premium light" marketing
   skin (recommended)? This sets everything else.
2. **Illustration:** painterly African-business scenes — commission, AI-generate, or stock?
   Need one consistent style + source.
3. **3D engines:** Spline (live, heavier) vs pre-rendered sprites (lighter)? Performance vs wow.
4. **Hosting:** apex marketing + app subdomain, separate route group, or separate app?
5. **ROI calculator:** how aggressive on claims? (Doctrine says honest/ranged only.)
6. **Testimonials:** none yet — placeholder slots now, or omit until real ones exist?

---

## 11. Definition of done
A first-time SME visitor, in under one scroll, understands what AI-BOS is, feels their
current pain named precisely, sees the after-state, trusts it with their data, sees the
price in Kwacha with mobile money, and can start free — all on a page that loads fast, works
on a 375px phone, respects reduced-motion, and passes the critique engine. The pricing page
shows the *real* product, animated, and the ROI calculator makes paying the obviously
rational choice — without a single banned tactic.
