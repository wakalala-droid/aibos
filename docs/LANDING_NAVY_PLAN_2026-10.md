# The website in navy, with the features shown working (10 Oct 2026)

The owner: "there is too much white going on. Add dynamic dark navy blue like on the AI section on most of the site, then add dynamic animations to introduce key features like PAYE payroll. Sell emotions and goals with the landing site."

## What a visitor should feel
1. **Seen:** "they know my week": the till at midnight, NAPSA penalties, chasing customers.
2. **Relief:** each of those jobs shown being done for them, with the real product.
3. **Ambition:** "I can run the business I meant to build." Then one clear action: Start free.

The order of the page follows that feeling: promise, pain named, jobs done, proof, how easy it is, who it is for, the goal, the action.

## 1. Navy across the site
- **One navy, set once.** A website navy in `app/(marketing)/marketing.css`: page `#050b18`, cards `#0b1629`, blue-tinted hairlines and greys. It applies to every dark surface on the website (the app stays as it is). All text keeps at least 4.5:1 and body text stays near 8:1.
- **The whole website sits on navy** (`data-theme="dark"` on the website root): home, Pricing, Trust and About, the menu bar and the footer. The legal pages (privacy, terms, refunds) keep a light reading panel, because long text reads better dark on light.
- **The product stays light.** The hero video, the feature scenes, the morning brief and the last card are the real light app floating on navy, as in the hero. White appears only as the product, never as the page.
- **Logos:** the white mark and the white wordmark on navy. The phone's browser bar turns navy.

## 2. The "dynamic" in the navy
- **A living sky behind the whole site:** three large soft lights (blue, cyan and indigo) drift slowly behind the page (40 to 70 seconds per drift) and shift a little as you scroll (Chrome and Edge; other browsers get the drift only).
- **Built to stay smooth on a cheap phone:** one fixed layer, moved only with GPU-friendly transforms, no blur filters, nothing measured while scrolling, no blurred sticky header (the owner's speed rule). It stops for anyone who asks their phone for less motion.

## 3. Jobs AIBOS takes off your hands (the new feature theatre)
A navy stage that plays five short scenes. They are made of real kit pieces with the product's real maths and each lasts about seven seconds. They move on to the next scene by themselves. A tab for each job shows its progress line. Tapping a tab jumps to it and stops the auto-play. Hovering pauses it. The theatre only plays while it is on screen.

| Job | The goal, in the owner's words | What plays | Plan |
| --- | --- | --- | --- |
| Payroll | Pay your people right, without the tax tables. | Payroll for October with three staff. **Run payroll** presses and Mwila's payslip builds line by line: K8,500.00, NAPSA K425.00, PAYE K792.50, NHIMA K85.00, take-home rolls to **K7,197.50**. Then a notice: PAYE K990.00 to ZRA and NAPSA K1,950.00, due 10 November, added to your schedule. | Pro |
| Get paid | Get paid the same day, not the same month. | Invoice 0142 to Lusaka Hotels for K4,800.00 goes out with its mobile money link. The customer pays, a notice arrives, the invoice turns to Paid and the money rolls up. | Free |
| Deadlines | No penalties, no "I forgot". | The Coming up list (NAPSA, PAYE, rent, a pick-up). A reminder lands days before NAPSA is due; **Mark paid** presses and it ticks off. | Pro |
| Stock | Never tell a customer "we've run out". | Cooking oil drains to 2 left, under its reorder level of 6. A reorder draft appears (10 × 20 L from Kasama Traders), **Approve** presses and it shows as arriving. | Pro+ |
| Rooms & Stays | Fill your rooms with the deposit already paid. | The week calendar: a dashed request from Mrs Tembo, her deposit arrives through the guest payment link, the stay turns solid navy and a reminder is set for her arrival. | Pro |

Every figure is checked against the product: the payslip comes from the payroll engine's 2026 Zambian rates (`aibos-api/payroll.py`). The reorder quantity follows the app's rule (back up to twice the reorder level). The ZRA and NAPSA payments are due on the 10th of the next month, as the app drafts them.

## 4. Emotion and goals
- **"You started a business, not a bookkeeping job."** Four lines of the owner's week, each struck through by a cyan line as it comes into view, with the AIBOS answer rising in its place: the till at midnight, then the day's numbers at 06:30. Guessing the month's profit, then profit to the Kwacha. NAPSA penalties, then reminders days before. Chasing debtors, then a payment link on every invoice.
- **"The goal."** Near the end, a large statement lights up line by line as you scroll: know your numbers, pay your people right, get paid on time, grow on purpose. It leads into the final Start free card.
- Nothing invented: no made-up customers, quotes or statistics.

## 5. The landing page, top to bottom
1. Hero: navy, no entrance animation (the speed rule), the video floating in light.
2. Pain to promise (new).
3. The feature theatre (new).
4. Ask AIBOS (navy).
5. The morning brief (light notices on navy).
6. Everything in one place: the full feature grid with plan tags, now on navy cards.
7. Reports.
8. How it works.
9. Built for Zambian businesses.
10. The goal (new).
11. Start free: the light notice with the art strip, on navy.

## 6. A speed bug fixed on the way
The theme switcher hid every page (`visibility:hidden`) until the page's scripts had loaded, seconds on a phone. The website's colours are already set before anything shows, so website pages now show straight away. The app keeps its opening screen.

## 7. Checks before it ships
- Types, lint, the design contract, the unbuilt-feature and tier-contract guards plus a production build.
- Real Edge against the local build, then against the live site, at 1280px, 390px and 320px: every section seen, the theatre plays and moves on by itself, tabs work, no sideways scroll and no console errors.
- Reduced motion: the sky is still, the scenes show their finished state and nothing moves on its own.
- Scroll smoothness on a phone with a 4x slower CPU (`agora-web/scripts/scrolljank.mjs`), three runs before and after, compared by median.
- Contrast of every text colour on navy.
- `docs/AIBOS_UI_KIT.md` gains "Website navy" and the theatre rules. Then commit, push to main and confirm it is live.
