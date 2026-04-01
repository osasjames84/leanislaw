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

