# Backend Hosting (Railway/Render)

## 1) Create a managed Postgres
- Use Railway Postgres, Neon, or Supabase.
- Copy the connection string as `DATABASE_URL`.

## 2) Deploy this repo as a Web Service
- Root directory: `leanislaw`
- Build command: `npm install`
- Start command: `npm run start`

## 3) Set environment variables
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default is `gpt-4o-mini`)
- `USDA_API_KEY`
- `PORT` (host usually injects this automatically)
- `CORS_ORIGINS` (comma-separated frontend domains)

Example:
`CORS_ORIGINS=https://your-frontend.vercel.app,https://www.yourdomain.com`

## 4) Verify
- Health endpoint: `GET /health`
- Should return:
`{ "ok": true, "service": "leanislaw-backend" }`

## 5) Frontend integration
- Set frontend API base URL to your deployed backend domain.
- Ensure frontend uses that base URL for all `/api/v1/*` calls.

## 6) Stripe (premium coaching checkout)

Step-by-step (test mode, webhooks, go live): see **`STRIPE_SETUP.md`** in this folder.

1. In [Stripe Dashboard](https://dashboard.stripe.com/), create **Products** with **recurring** prices in **GBP** that match your app (£60/mo, £300 every **6 months**, £540/year). For the 6‑month plan use billing period **every 6 months** (or monthly with interval count 6, depending on the Dashboard UI).
2. Copy each **Price ID** (`price_...`) and set on Railway:
   - `STRIPE_SECRET_KEY` — secret key (live or test).
   - `STRIPE_WEBHOOK_SECRET` — from **Developers → Webhooks** after you add an endpoint:
     - URL: `https://<your-railway-backend-host>/api/v1/coaching/stripe-webhook`
     - Events: at least `checkout.session.completed`
   - `FRONTEND_URL` — your Vercel site, e.g. `https://your-app.vercel.app` (no trailing slash).
   - `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_SEMIANNUAL`, `STRIPE_PRICE_ID_YEARLY`
3. Redeploy the backend. **Pay with card** enables when `STRIPE_SECRET_KEY`, `FRONTEND_URL`, and all three `STRIPE_PRICE_ID_*` are set (webhook secret is **not** required to open Checkout). Successful checkout must reach **`stripe-webhook`** so `premium_coaching_active` is set on the user.

**Local testing:** use Stripe CLI `stripe listen --forward-to localhost:4000/api/v1/coaching/stripe-webhook` and put the printed signing secret in `STRIPE_WEBHOOK_SECRET`.

