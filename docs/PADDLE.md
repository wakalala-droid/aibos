# Card payments through Paddle

Set up 21 September 2026. Mobile money stays the main way to pay; a card is
the second way, for anyone who would rather.

## What the customer gets

- **Prices in US dollars**, because Paddle cannot charge in Kwacha:
  Pro $25, Pro+ $39, Growth $79 a month. A year costs ten months
  ($250, $390, $790).
- **The plan renews by itself** on the card each month or year until they
  cancel. Cancelling takes two clicks on Plan & billing; the plan stays on
  to the end of what they paid.
- **30-day money-back guarantee** on every card payment (see /refunds).
- Paddle is the **Merchant of Record**: it sells the plan in its own name
  and adds any sales tax. It emails the receipt and the invoice. It also
  handles refunds and chargebacks. Card statements show PADDLE.NET.

## What happens by itself

With `PADDLE_API_KEY` set on Render, the API (aibos-api/paddle.py) makes sure
Paddle has everything, creating only what is missing:

1. The three plans (AIBOS Pro, Pro+ and Growth), each with a monthly and a
   yearly price.
2. The webhook, pointing at `<API>/payments/paddle/webhook`. Its signing
   secret is read back from Paddle, so it is never copied by hand.
3. The public checkout token the website opens Paddle's card form with.

The key says whether it is a sandbox (test) or live key. Check the result at
`GET /health/setup` (the `card_payments` row) or `GET /payments/paddle/config`.

A payment is the only thing that switches a plan on or extends it. It counts
only when Paddle signed the message. A full refund or chargeback stops the
renewal and ends the plan at once.

## What the owner does by hand

1. **Run migration 0037** (`supabase/migrations/0037_card_subscriptions.sql`)
   in the Supabase SQL editor. `/health` lists it under `migrations_missing`
   until then.
2. **Make an API key** in Paddle: Developer tools, Authentication, API keys,
   New API key. Name it "AIBOS server". Give it read and write on products,
   prices, customers, transactions, subscriptions, client-side tokens and
   notification settings. Also give it write on customer portal sessions.
   Choose the longest expiry offered. Put a reminder in the calendar before
   it runs out: when it expires, card payments stop.
3. **Paste the key on Render** (aibos-api, Environment) as `PADDLE_API_KEY`
   and save. Render restarts the API with it.
4. **Default payment link**: in Paddle, Checkout, Checkout settings, set it
   to `https://ai-bos.website/pricing`. Paddle's own emails (for example "update
   your card") link there. The pricing page opens the card form for them.
5. **Verify the account** in Paddle (identity, business, payout bank) and
   submit `ai-bos.website` for review. The site already has what reviewers
   check: pricing, Terms (business name, email, phone and Paddle's reseller
   wording), Refund Policy and Privacy Policy, all linked in the footer.
6. **Make sure hello@ai-bos.website receives mail.** It is on the Terms and
   Refund Policy. Paddle's reviewers and card customers write to it.

## Going live

On a live key the card option is shown to admins only, because Paddle refuses
every checkout until it has approved the account and its API cannot say
whether it has. Your own first real card payment is the switch: buy a plan by
card as the admin (refund it afterwards if you like) and from then on every
customer sees the card option and the card prices on the pricing page. To
skip that, set `PADDLE_OPEN=1` on Render.

## Testing before going live

Paddle's sandbox is a separate account at sandbox-vendors.paddle.com. Put a
sandbox key (it starts `pdl_sdbx_`) in `PADDLE_API_KEY` and the API sets up
the sandbox the same way. While a sandbox key is in, the Card option shows
only to admins and only `PADDLE_TESTERS` (default: the admin email, proven by
Google) get a plan from a test payment, because test cards work for anyone.
Test card: 4242 4242 4242 4242, any future date, any CVC.

Try: buy Pro monthly, see Plan & billing, change to Growth (a price preview
first), cancel the renewal, keep it, open the card page. Then swap in the
live key.

## Refunds

Refund in the Paddle dashboard (Transactions, the payment, Refund). Once
Paddle approves a full refund, AIBOS marks the payment Refunded, stops the
renewal, moves the account to Free and tells the owner in the bell.
A partial refund changes nothing in AIBOS.

## Changing prices later

Add the new price to the plan in Paddle and archive the old one. The newest
active monthly and yearly price is what is sold (the pricing page catches up
within ten minutes). Customers already paying keep the price they bought at.

## Where it lives

- aibos-api: `paddle.py` (Paddle itself), the "Cards, through Paddle" block
  in `main.py` (webhook and routes), `billing.py` (what the owner is told,
  no reminders for card plans), `test_paddle.py`.
- aibos: `lib/paddle.ts` (Paddle.js), `app/checkout/page.tsx`,
  `app/dashboard/billing/page.tsx`, `components/marketing/PricingTiers.tsx`,
  `app/(marketing)/terms` and `refunds`, `lib/legal.ts` (name, email, phone),
  CSP in `next.config.js`.
