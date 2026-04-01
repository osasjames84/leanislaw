# Stripe setup — receive coaching payments

Your app already has Checkout + webhooks wired (`/api/v1/coaching/create-checkout-session` and `/api/v1/coaching/stripe-webhook`). Finish setup in the Stripe Dashboard and Railway.

## 1) Stripe account & payouts

1. Sign up at [stripe.com](https://stripe.com) and complete business details.
2. Under **Settings → Connect** / **Bank accounts and scheduling**, add the bank account where Stripe should pay out (UK: sort code + account). Until this is done you can still test; live charges need a verified account.

## 2) Use Test mode first

In the Dashboard, turn **Test mode** on (toggle top right).

1. **Developers → API keys** → copy the **Secret key** (`sk_test_...`).
2. In Railway (your backend service) add:
   - `STRIPE_SECRET_KEY` = that secret key  
   - `FRONTEND_URL` = your real Vercel URL, e.g. `https://your-app.vercel.app` — **no trailing slash**

## 3) Create three subscription prices (GBP)

**Product catalog → Add product** (you can use one product with three prices, or three products).

Each price must be **Recurring**, currency **GBP**, matching the app:

| Plan in app   | Billing in Stripe                     | Amount |
|---------------|----------------------------------------|--------|
| Monthly       | Every **1 month**                      | £60    |
| Every 6 months| Every **6 months**                     | £300   |
| 1 year        | Every **1 year**                       | £540   |

Copy each **Price ID** (`price_...`, not the product id).

Railway:

- `STRIPE_PRICE_ID_MONTHLY`  
- `STRIPE_PRICE_ID_SEMIANNUAL`  
- `STRIPE_PRICE_ID_YEARLY`  

**Important:** Test-mode price IDs only work with **test** secret keys. Live keys need **live** `price_...` IDs.

## 4) Webhook (so “premium” unlocks after payment)

1. **Developers → Webhooks → Add endpoint**
2. **Endpoint URL:**  
   `https://YOUR-RAILWAY-BACKEND-HOST/api/v1/coaching/stripe-webhook`  
   (Same host you use for `/health`; no `/api` prefix on Railway’s public URL — the path is exactly as above.)
3. **Events:** choose `checkout.session.completed` (or “Select events” and add that one).
4. After saving, open the endpoint → **Signing secret** → copy to Railway as `STRIPE_WEBHOOK_SECRET`.

Without this, customers can still pay in Checkout, but the app may not set `premium_coaching_active` until the webhook fires.

## 5) Redeploy & smoke test

1. **Redeploy** the Railway service (or restart) so env vars load.
2. On your site, open **Premium coaching**, pick a plan, **Pay with card**.
3. Stripe test card: **4242 4242 4242 4242**, any future expiry, any CVC, any postcode.

## 6) Go live (real money)

1. Complete Stripe **activation** and payout bank verification.
2. Turn **Test mode** **off**.
3. Create the **same three recurring GBP prices** in live mode; copy live `price_...` IDs.
4. **Developers → API keys** → use **live** Secret key (`sk_live_...`).
5. Add a **new webhook** endpoint pointing to the **same** URL, subscribe to `checkout.session.completed`, copy the **live** signing secret.
6. Update Railway:

   - `STRIPE_SECRET_KEY` (live)  
   - `STRIPE_WEBHOOK_SECRET` (live webhook signing secret)  
   - `STRIPE_PRICE_ID_MONTHLY`, `SEMIANNUAL`,-YEARLY (live price IDs)  
   - `FRONTEND_URL` (your production site, still no trailing slash)

7. Redeploy.

## Local dev (optional)

```bash
stripe listen --forward-to localhost:4000/api/v1/coaching/stripe-webhook
```

Put the CLI **signing secret** in `STRIPE_WEBHOOK_SECRET` in `backend/.env` while testing locally.

## Troubleshooting

- **Pay button greyed out:** Railway missing secret key, `FRONTEND_URL`, or one of the three price IDs.  
- **Checkout opens but access never turns on:** webhook URL wrong, wrong signing secret, or event not `checkout.session.completed`. Check **Developers → Webhooks** for delivery errors.  
- **Stripe error in app:** test vs live key mismatch, or price currency not GBP / not recurring subscription.
- **Checkout asks for name, address, phone:** Email is prefilled from the logged-in account. **Name on card** is normal for cards. Extra fields often come from **Stripe Tax** (Dashboard → Tax) or **Checkout** settings asking for phone/address — turn those off if you don’t need them. The backend session disables automatic tax, tax IDs, and phone collection where the API allows.
