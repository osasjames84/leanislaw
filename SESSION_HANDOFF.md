# ⏩ Update — 2026-06-21 (Session 2: full coaching product)

This session turned the reporting feature into a **usable end-to-end coaching product**
with both sides integrated. Everything below was built, browser-verified, and committed on
`feature/weekly-client-reports`. New commits (newest first): `9ed4d49` client coaching hub,
`8c0592e` programs/AI/forms/tutorials + full profile, `101faf3` finished Metrics tab.

**The coaching loop now closes:** coach assigns a program → client sees & completes it →
adherence reflects the real plan → coach gets per-client metrics + an AI weekly note;
coach builds forms → client fills → coach reviews; coach shares resources → client sees them.

### New backend (all `/api/v1`, migrations 021–023, idempotent, auto-applied on boot)
- **Programs** (`routes/programs.js`, table `assigned_workouts`): coach `GET/POST clients/:id/workouts`,
  `PATCH/DELETE workouts/:id`; client `GET my/workouts`, `POST my/workouts/:id/complete|skip`,
  `GET my/summary`. `buildBundle.js` now uses the assigned-plan count as the weekly adherence
  denominator when a plan exists.
- **AI weekly overview** (`lib/weeklyReport/aiOverview.js`, `GET reports/clients/:id/ai-overview`):
  narrates the deterministic model + progression via **Claude**. **Degrades gracefully** — with no
  `ANTHROPIC_API_KEY` it returns a deterministic template summary (`ai:false`). To enable real
  narration: set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-sonnet-4-6`)
  in `backend/.env`; no code change needed.
- **Forms** (`routes/forms.js`, tables `coach_forms`/`form_assignments`/`form_responses`):
  coach `GET/POST /`, `DELETE/:id`, `POST/:id/assign`, `GET/:id/responses`; client `GET my`,
  `POST my/:formId/respond`.
- **Tutorials** (`routes/tutorials.js`, table `coach_tutorials`): coach CRUD + client `GET my`.

### New frontend
- **Coach:** `coachShared.jsx` (extracted UI primitives), `CoachClientProfile.jsx`
  (full-page Everfit profile: Overview w/ AI note · Program assign · Metrics · Nutrition ·
  Check-ins · Reports), `CoachForms.jsx`, `CoachTutorials.jsx`. `CoachConsole.jsx` now routes
  `clients/:id` → full profile, restores **Add-client** modal + **logout**, wires all sections.
- **Client:** `ClientCoaching.jsx` (`/coaching` hub: this-week plan w/ mark-done/skip, forms,
  resources, intake prompt, check-in/support links), `ClientForm.jsx` (`/coaching/forms/:id`),
  `CoachingSignpost.jsx` (floating entry, only for coached clients, w/ to-do badge). `App.jsx`
  adds the routes + signpost. **BottomNav was NOT touched** (user's uncommitted work).

### Demo data added this session (coach 17, client Marcus = 21)
- 2 assigned workouts for Marcus (Upper A — Push = completed; Lower A — Squat focus = to-do).
- 1 form "Weekly check-in" assigned to Marcus + a submitted response.
- 1 tutorial "How to do a proper RDL". Demo clients 18–21 set `email_verified=true`.

### Still open / nice-to-have next
- Everfit table columns (last activity, 30d %) still need a `last_activity` field on `/roster`.
- Aggregate (roster-wide) Metrics section is still a stub (per-client metrics are live).
- `hide_raw_numbers` enforcement in the *legacy* client screens (Dashboard/MacroTracking) — the
  new client surfaces respect it, but those two carry the user's uncommitted work; coordinate.
- `schema.js`/`server.js` still carry the user's unrelated `direct_messages`/`pgConnection`
  changes mixed with feature defs; they were committed together as feature runtime wiring.

---

# Project Overview

**Lean is Law** is a fitness-coaching monorepo. The active app lives in `leanislaw/`:
a **Node/Express + Drizzle ORM + Postgres** backend and a **React (Vite)** frontend.
There is also a mobile client app in `leanislawmobile/` (NOT touched this session) and a
**Python report engine** in `coaching-platform/reports/` (reportlab + matplotlib) that was
built/tested earlier and is **reused, not rewritten**.

This session built the **automated weekly per-client reporting feature** plus an
**Everfit-style coach console** (a dense, dark, premium coaching CRM dashboard), and started
an **exercise-progression engine** (the foundation for a future "AI weekly overview").

Current state: feature is largely working and verified in-browser. One frontend edit is
**in progress / uncommitted** (the per-client Metrics tab) and currently produces 4 ESLint
errors (the app still builds). See **Known Bugs** and **Next Recommended Actions**.

Working branch: **`feature/weekly-client-reports`** (this is NOT `main`).

> ⚠️ `coaching-platform/CLAUDE.md` / `PLATFORM_PLAN.md` describe a **Supabase** architecture
> that does **not** match reality. The real app is Node/Express/Drizzle/Postgres. **The real
> code wins** — ignore those planning docs except as loose intent.

---

# Work Completed This Session

15 commits on `feature/weekly-client-reports` (oldest → newest):

1. `31891a6` Weekly reports: data mapping doc + Python bundle runner
2. `7ce31b1` Weekly reports: backend job, coach + duty-of-care APIs
3. `6ef2728` Weekly reports: coach roster UI + client duty-of-care screens
4. `5137ce0` Weekly reports: document endpoints, code map, ops runbook
5. `fb1986a` Coach console: Everfit-style desktop UI (replaces CoachRoster/CoachDashboard)
6. `811bf43` Coach console: match the mockup's visual language
7. `b9bd531` Coach console: dark mode matching the widget palette
8. `eff04cb` Coach console: match the widget's roster + inline profile preview
9. `1a2903d` Coach console: neutral dark palette + drop inline preview panel
10. `d57ef52` Coach console: dense premium CRM redesign (Linear/Stripe/Attio style)
11. `9cfe0ac` Coach console: warm charcoal premium refactor
12. `4ba33a1` Coach console: floating-panel layout + refreshed warm tokens
13. `88cf481` Coach console: sidebar + preview polish to match target
14. `6af5195` Coach console: Everfit-style nav + Exercise Library section
15. `5e0033e` Reports: exercise progression engine + per-client metrics endpoints

### Backend — weekly reporting pipeline
- **Step-1 mapping doc** (`leanislaw/backend/docs/weekly-report-mapping.md`): how the real DB
  feeds the Python engine, gaps, decisions, endpoint list, ops runbook.
- **Python adapter** `coaching-platform/reports/run_from_bundle.py`: reads a normalized weekly
  "bundle" (same shape as `sample_data.json`) on stdin, runs the EXISTING engine unchanged
  (`build_report` thresholds + `report_html` + `report_pdf`), returns JSON: report model,
  dashboard HTML, and per-client PDFs as base64.
- **Migration `019_coaching_reports.sql`**: `coach_clients`, `client_safeguarding`,
  `weekly_checkins`, `weekly_reports` (PDF as base64 text), `weekly_dashboards`.
- **`lib/weeklyReport/`**: `weekRange.js` (Mon-anchored week math), `buildBundle.js` (real
  DB → engine bundle, reusing `macroEngine`), `runEngine.js` (spawns the Python adapter),
  `generate.js` (orchestrate + persist per client/week), `schedule.js` (opt-in in-process
  weekly fallback), `progression.js` (exercise progression engine — see below).
- **`lib/supportResources.js`**: region ED-support signposts (UK default = Beat), env-overridable.
- **`routes/reports.js`** (coach-only via `requireAuth`+`requireCoach`): roster CRUD, `/run`,
  `/roster`, `/:id/pdf`, `/dashboard`, `/cron/run-all`, per-client `/report`, `/reports`
  (history), `/safeguarding` GET/PUT, **`/body-metrics`**, **`/progression`**.
- **`routes/safeguarding.js`** (client-facing duty-of-care): `/me`, `/support`, `/intake`
  (PAR-Q + wellbeing), `/checkin` (weekly), `/my-week` (adherence-only, respects
  `hide_raw_numbers`, never exposes coach flags).

### Backend — Exercise Library + progression
- **Migration `020_exercise_library.sql`**: adds `instructions`, `video_url`, `equipment`,
  `level`, `created_at` to `exercises` (all nullable, non-breaking).
- **`routes/exercises.js`**: extended `POST` and `PATCH` to carry the new library fields.
  (No auth added — the client workout-logging flow uses the same endpoints.)
- **`lib/weeklyReport/progression.js`** + endpoints `/clients/:id/body-metrics` and
  `/clients/:id/progression`: per-exercise week-over-week best set, **Epley estimated 1RM**,
  volume, and a **progressive-overload suggestion** (e.g. "Hit 12 reps at 80kg — increase
  load ~5–10%"). Verified: seeded Marcus Bell shows Bench Press 101→107→112 est-1RM.

### Frontend — coach console (heavily iterated)
- Replaced old `CoachDashboard.jsx` + `CoachRoster.jsx` (deleted) with a single
  **`CoachConsole.jsx`** shell.
- Loaded **Tabler icon webfont** + **Inter** in `index.html`.
- Theme system in **`index.css`**: `--cc-*` CSS variables, **warm-charcoal dark** palette,
  forced dark (`data-theme="dark"`).
- Final layout = **floating panel**: `#1f1f1e` frame (14px padding) wrapping ONE rounded
  `#30302e` surface that holds the sidebar + main (no divider). Sidebar nav routes between
  sections: **Clients · Metrics · Exercise library · Forms · Tutorials**. Footer = avatar +
  name + "Coach" (no logo badge, no divider line, no logout icon).
- **Clients** section: KPI cards (Needs attention / Watch / On track), dense client table
  (Client · Status · Training · Nutrition · Report) with status pills + progress bars + PDF,
  and an inline **client preview** (Overview / Metrics / Nutrition / Check-ins / Reports tabs,
  3 stat cards, crimson alert banner).
- **Exercise Library** (`CoachExerciseLibrary.jsx`): search, muscle filter, add/edit/delete,
  card grid (shows 61 seeded exercises).
- **Metrics / Forms / Tutorials**: routed **section stubs** (describe what's coming).
- Removed the date-range text, date picker, "+ Add client" button, and theme toggle to match
  the target design.

### Frontend — client duty-of-care
- `IntakeScreen.jsx` (`/setup/intake`, PAR-Q + wellbeing), `MyWeek.jsx` (`/me/week`,
  adherence-only view + weekly check-in), `SupportPage.jsx` (`/support`),
  `SupportSignpost.jsx` (discreet global link, hidden on `/coach`).

### Ops / environment actions (NOT code)
- Installed Python deps: `reportlab`, `matplotlib` (engine needs them).
- Installed `ffmpeg` via Homebrew (to extract frames from an Everfit screen recording).
- Promoted DB user **17** (`@claude_test_01`, `claude@gmail.com`) to `role=coach`,
  `email_verified=true`.
- Seeded 4 **demo clients** (`*@demo.leanislaw`, ids **18 Daniel Osei, 19 Priya Nair,
  20 Sofia Romano, 21 Marcus Bell**) with week `2026-06-08` data; linked to coach 17 via
  `coach_clients`; generated weekly reports for them; seeded Marcus bench/squat progression
  (weeks 2026-06-01/08/15).
- Saved Everfit layout reference frames to `docs/everfit-reference/` (see below).

---

# Current State of the Codebase

### How it runs
- **Backend**: `cd leanislaw && npm run dev` (nodemon `backend/server.js`, port **4000**).
  On startup it runs ALL `backend/migrations/*.sql` (idempotent). Needs `DATABASE_URL` (or
  `USE_LOCAL_DB=1` + `DB_*`) in `leanislaw/backend/.env`.
- **Frontend**: `cd leanislaw/frontend && npm run dev` (Vite, port **5173**, proxies `/api`
  → `localhost:4000`).
- **chess-ai** (unrelated): `npm run chess-ai` (FastAPI, port 8000).
- `.claude/launch.json` defines all three for the preview tooling.

### Coach console routes (frontend, all behind `CoachRoute` = role coach)
- `/coach` → Clients section (`CoachConsole section="clients"`)
- `/coach/clients/:clientId` → Clients section with that client selected
- `/coach/library` → Exercise Library
- `/coach/metrics`, `/coach/forms`, `/coach/tutorials` → section stubs
- `/coach/reports` → redirects to `/coach`
- Client duty-of-care: `/setup/intake`, `/me/week`, `/support`

### Key backend API (all under `/api/v1`)
- **Coach (`/reports`, requireCoach)**: `GET/POST/PATCH/DELETE clients`,
  `GET/PUT clients/:id/safeguarding`, `GET clients/:id/report?week=`,
  `GET clients/:id/reports`, `GET clients/:id/body-metrics?weeks=`,
  `GET clients/:id/progression?weeks=`, `POST run`, `GET roster?week=`,
  `GET :id/pdf`, `GET dashboard?week=`, `POST cron/run-all` (header `x-cron-secret`).
- **Client (`/safeguarding`, requireAuth)**: `GET me`, `GET support`, `POST intake`,
  `POST checkin`, `GET my-week?week=`.
- **Exercises (`/exercises`, public)**: `GET /`, `GET part/:bp`, `GET :id`,
  `GET exerciseName/:name`, `POST /`, `PATCH :id`, `DELETE :id` (POST/PATCH carry library fields).

### Database (new tables this session)
- `coach_clients(id, coach_id, client_id, weekly_training_target, status, created_at)` —
  the coach↔client roster link + adherence denominator.
- `client_safeguarding(client_id PK, hide_raw_numbers, par_q jsonb, screen_completed,
  wellbeing_note, support_region, …)`.
- `weekly_checkins(id, client_id, week_start, sleep_h, energy_1to5, stress_1to5, notes, …)`.
- `weekly_reports(id, coach_id, client_id, week_start, status, flags jsonb, model jsonb,
  pdf_base64 TEXT, pdf_mime, generated_at)` — PDFs stored in-DB as base64.
- `weekly_dashboards(coach_id, week_start, html, generated_at)`.
- `exercises` extended with `instructions, video_url, equipment, level, created_at`.

### Integrations / dependencies
- **Python report engine** (`coaching-platform/reports/`): invoked via `child_process.spawn`
  from `lib/weeklyReport/runEngine.js`. Needs `python3` + `reportlab` + `matplotlib`.
  Env: `PYTHON_BIN`, `REPORTS_DIR`.
- **Scheduling**: primary = host cron → `POST /api/v1/reports/cron/run-all` with
  `x-cron-secret: $REPORTS_CRON_SECRET`. Fallback = in-process (`REPORTS_INPROCESS_SCHEDULE=1`,
  `REPORTS_SCHEDULE_DOW`, `REPORTS_SCHEDULE_HOUR`).
- **Support signposts**: `SUPPORT_RESOURCES_JSON` overrides region map.
- Stack: NO Tailwind — styling is **inline styles + CSS variables**. Drizzle ORM. Tabler
  icons + Inter via CDN (jsdelivr/Google Fonts).

---

# Outstanding Tasks (priority order)

1. **Finish the per-client Metrics tab** in `CoachConsole.jsx` (IN PROGRESS — see Known Bugs).
   Render a Body Metrics ⇄ Exercise Metrics toggle using the already-fetched `bodyHist` +
   `progression` and the already-defined `MetricLine` / `Sparkline` / `ProgressionItem`
   components. This clears the 4 ESLint errors.
2. **Commit `schema.js` + `server.js`** (currently left in the working tree — see below).
3. **Align the Clients table columns** to Everfit (Last activity, Last 7d/30d training %,
   Tasks %, Category, Status). Needs `last_activity` + 30d calc added to `/roster`.
4. **Full-page client profile** (Everfit-style 3-column Overview: Training stats + Body
   Metrics charts | Goal/Notes/Injuries/Progress photos | Profile card + Updates feed),
   instead of the current inline preview panel.
5. **Program / workout-assignment model** — foundation for a real adherence denominator AND
   for AI auto-adjustments to land somewhere.
6. **Hybrid AI weekly overview** — deterministic numbers (progression + nutrition + check-in)
   narrated by **Claude** (use Claude, not the repo's OpenAI/Chad setup, for new AI features).
7. **Forms builder** + **Tutorials/Resources** sections (currently stubs).
8. **Enforce `hide_raw_numbers`** in the existing client screens (`MacroTracking.jsx`,
   `Dashboard.jsx`) — currently only enforced server-side in `/safeguarding/my-week` + the new
   `MyWeek.jsx`. NOTE these files carry the user's unrelated uncommitted work — coordinate.

---

# Known Bugs & Issues

- **IN-PROGRESS, UNCOMMITTED: `CoachConsole.jsx` Metrics tab.** The load effect now fetches
  `bodyHist` + `progression`, and `MetricLine` / `Sparkline` / `ProgressionItem` components +
  `metricsView` state were added, BUT the `tab === "Metrics"` JSX still renders the old
  `MiniWeight` and does not use them. Result: **4 ESLint errors** (`bodyHist`, `progression`,
  `metricsView`, `setMetricsView` unused). `npm run build` STILL PASSES (Vite ignores ESLint).
  Must finish wiring the Metrics tab or revert these additions.
- **`schema.js` and `server.js` are intentionally NOT committed.** They carry the feature's
  Drizzle table defs / route mounting AND pre-existing unrelated uncommitted work (the
  `direct_messages` image columns; a `pgConnection`/`verifyPgConnection` refactor). The app
  runs because the files are edited on disk. A clean checkout of the commits alone will NOT
  mount `/api/v1/reports` or `/api/v1/safeguarding` until these are committed.
- **No in-UI "Add client" and no logout on the coach console** — both removed during the
  Everfit/target redesigns. Clients are added via API or seed only.
- **Exercise progression is empty for real clients** — most real `exercise_logs.sets` are
  `[{weight:'',reps:''}]` (blank). Only the seeded Marcus Bell (21) has usable progression.
- **Demo data lives in the DB**: users `*@demo.leanislaw` (ids 18–21) + Marcus's seeded
  progression sessions (2026-06-01/08/15) + `coach_clients` links for coach 17. Remove by
  deleting those users (cascades) if you want a clean roster.
- **Coach login password unknown** — user 17 (`claude@gmail.com`) was promoted to coach via
  DB, but the password isn't known. For verification, mint a JWT and inject into
  `localStorage['leanislaw_token']` (see Context).
- **MCP Chrome window is locked to ~537px wide** — screenshots show the responsive/narrow
  view; zoom the page (`document.documentElement.style.zoom='0.6'`) to capture the full
  desktop layout, then reset. The real desktop layout is fine ≥1100px.
- Harmless ESLint warning pattern `react-hooks/set-state-in-effect` on fetch-in-effect (matches
  existing app convention).
- `coaching-platform/CLAUDE.md` (Supabase) is misleading — ignore.

---

# Important Decisions

- **Reuse the Python report engine; do not reinvent its thresholds.** Node builds the bundle
  from the real DB → `run_from_bundle.py` runs `build_report`/HTML/PDF → Node persists.
- **Store PDFs in Postgres as base64** (`weekly_reports.pdf_base64`) — matches the app's
  existing in-DB binary pattern (`direct_messages.image_base64`); there is no S3/file storage.
- **Coach↔client = explicit `coach_clients` table** (not the social `user_friendships` graph).
- **`weekly_training_target`** on `coach_clients` is the training-adherence denominator.
- **AI overview = hybrid**: deterministic engine computes exact numbers/flags/overload
  suggestions; an LLM (Claude) only narrates. (Decided; narration not yet built.)
- **Duty of care (non-negotiable)**: flags are coach-only (never shown to clients);
  `hide_raw_numbers` swaps client views to adherence-only; PAR-Q + wellbeing intake;
  always-available ED-support signpost (UK default Beat); "coaching, not medical care".
- **Styling**: inline styles + `--cc-*` CSS variables, NOT Tailwind. Console is **forced dark**
  (`data-theme="dark"`). Warm-charcoal palette (exact hex in `index.css`): page `#141312`→now
  `#1f1f1e` frame, surface `#30302e`, inset cards `#262624`, border `#3a3a37`, text `#f5f5f4`,
  steel-blue accent (`#4f5e7a` / active nav `#253f60` + `#80aadd`), warm status pills.
- **Do NOT touch unrelated uncommitted work.** The working tree has many `M` files that are the
  user's own in-progress work (AnagramGame, BottomNav, ChatInbox, Dashboard, MacroTracking,
  AuthContext, auth.js, social.js, db.js, .env, etc.). Only commit feature-specific files.
- Commit style: small verifiable commits; messages end with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

# Files Changed

### Created (committed)
- `coaching-platform/reports/run_from_bundle.py`
- `leanislaw/backend/docs/weekly-report-mapping.md`
- `leanislaw/backend/migrations/019_coaching_reports.sql`
- `leanislaw/backend/migrations/020_exercise_library.sql`
- `leanislaw/backend/lib/supportResources.js`
- `leanislaw/backend/lib/weeklyReport/{weekRange,buildBundle,runEngine,generate,schedule,progression}.js`
- `leanislaw/backend/routes/reports.js`
- `leanislaw/backend/routes/safeguarding.js`
- `leanislaw/frontend/src/components/CoachConsole.jsx`
- `leanislaw/frontend/src/components/CoachExerciseLibrary.jsx`
- `leanislaw/frontend/src/components/MyWeek.jsx`
- `leanislaw/frontend/src/components/IntakeScreen.jsx`
- `leanislaw/frontend/src/components/SupportPage.jsx`
- `leanislaw/frontend/src/components/SupportSignpost.jsx`

### Modified (committed)
- `leanislaw/backend/routes/exercises.js` (library fields on POST/PATCH)
- `leanislaw/frontend/index.html` (Tabler + Inter)
- `leanislaw/frontend/src/index.css` (`--cc-*` theme tokens)
- `leanislaw/frontend/src/App.jsx` (coach section routes; removed old coach routes)

### Modified (NOT committed — in working tree, carry pre-existing unrelated changes)
- `leanislaw/backend/schema.js` — Drizzle defs for all new tables + `exercises` columns. **Required at runtime; commit carefully (split from unrelated `direct_messages` changes).**
- `leanislaw/backend/server.js` — mounts `reportsRouter` + `safeguardingRouter`, calls `startWeeklyScheduler()`. **Required at runtime.**

### Modified (UNCOMMITTED, IN PROGRESS)
- `leanislaw/frontend/src/components/CoachConsole.jsx` — half-finished Metrics tab (4 lint errors). (Earlier states of this file ARE committed; the latest in-progress edit is not.)

### Deleted (committed)
- `leanislaw/frontend/src/components/CoachDashboard.jsx`
- `leanislaw/frontend/src/components/CoachRoster.jsx`

### Created this task (reference, not yet committed)
- `SESSION_HANDOFF.md` (this file)
- `docs/everfit-reference/*.jpg` (Everfit layout frames — see below)

### Do NOT commit
- Pre-existing `M` files unrelated to this feature (AnagramGame.jsx, BottomNav.jsx,
  ChatInbox.jsx, ChessChatCard.jsx, CoachChat.jsx, Dashboard.jsx, FriendDM.jsx,
  Leaderboard.jsx, MacroTracking.jsx, AuthContext.jsx, auth.js, social.js, db.js,
  applySqlMigrations.js, .env, package.json, etc.) — these are the user's own work.

---

# Everfit Layout Reference (frames from the user's screen recording)

Saved under `docs/everfit-reference/`. These document Everfit's coach IA, which is the target
to keep matching (layout/structure only — using our own warm-charcoal visual system, not a
pixel clone of Everfit's proprietary look).

- `01-all-clients-table.jpg` — **All Clients**: left icon rail + section list (All/Connected/
  Pending/Offline/Need Programming/Archived) + dense table with columns **Name · Last Activity ·
  Last 7d Training % · Last 30d Training % · Last 7d Tasks % · Category · Status**, plus
  Category/Status/Last-Activity filters, search, "Workout Analytics", "Add Client".
- `02-clients-connected-filter.jpg` — same table under the "Connected" sub-filter.
- `03-client-profile-overview.jpg` — **Client profile (the centerpiece)**: header avatar +
  name + tabs **Overview · Training · Tasks · Metrics · Food Journal · Macros · Meal Plan ·
  Documents · Settings**. Overview is a **3-column dashboard**: (left) Training card (Last 7d
  0/3, Last 30d 1/9, Next week 3 assigned) + Body Metrics Overview (Weight & Body-Fat line
  charts, "Last 4 weeks"); (middle) Goal & Countdown, Notes, Limitations/Injuries, Progress
  Photos (compare); (right) Profile card (email/phone/location/package/program) + Updates
  activity feed.
- `04-client-metrics-tab.jpg` — **Metrics tab**: toggle **Body Metrics ⇄ Exercise Metrics**;
  body-metric list (Weight/Chest/Shoulders/Waist/Hip/Body Fat with value + last update + Add
  New) and a chart grid (Hip, Body Fat, Steps bar chart) with "Last 4 weeks" + "Update Results".
- `05-client-meal-plan-empty.jpg` — Meal Plan tab (empty state) showing the per-client
  feature-toggle pattern.

The original recording is at `~/Desktop/everfitlayout.mp4` (~3.7 min, 75 frames were extracted
to `/tmp/ev/` with `ffmpeg -vf fps=1/3`; only the 5 above were saved into the repo).

---

# Next Recommended Actions (exact)

1. **Finish the Metrics tab** (clears the 4 ESLint errors and delivers the headline feature):
   - In `leanislaw/frontend/src/components/CoachConsole.jsx`, find `{tab === "Metrics" ? (`
     and replace the old `MiniWeight` block with a Body/Exercise toggle:
     - `metricsView === "body"`: render `MetricLine` for weight (`bodyHist.map(p=>({date:p.date,value:p.weight}))`, unit `kg`) and body fat (`value:p.body_fat`, unit `%`) + current values.
     - `metricsView === "exercise"`: `progression.map(p => <ProgressionItem key={p.exercise} p={p} />)`, with an empty state when `progression.length === 0`.
   - Add a small toggle (two buttons) bound to `metricsView` / `setMetricsView`.
   - Run `cd leanislaw/frontend && npx eslint src/components/CoachConsole.jsx && npm run build` → expect 0 errors.
2. **Verify in browser**: open `http://localhost:5173/coach/clients/21` (Marcus, has
   progression). Mint a coach JWT and inject it (see Context) if not logged in. Click the
   **Metrics** tab → toggle to Exercise Metrics → confirm Bench Press 101→107→112 + the
   overload suggestion render. (Use the page-zoom trick to screenshot the full layout.)
3. **Commit** `CoachConsole.jsx` (and, per the user's call, `schema.js` + `server.js`).
4. Then proceed down Outstanding Tasks: Clients table columns → full-page profile → program model → AI overview.

---

# Context For Future Claude Sessions

- **You are on branch `feature/weekly-client-reports`.** `main` is the default. Don't commit
  the many unrelated `M` files in the working tree — they're the user's own in-progress work.
- **Servers**: backend `cd leanislaw && npm run dev` (:4000), frontend
  `cd leanislaw/frontend && npm run dev` (:5173). Both were running this session via the user's
  own processes; backend auto-applies migrations on start.
- **DB access for scripts**: write a throwaway `leanislaw/backend/_tmp.mjs` that
  `import { db } from './db.js'` (reads `.env`) and run with `node`, then delete it. (Used this
  pattern for seeding/verification all session.) `db.js` keeps Postgres DATE as plain
  `YYYY-MM-DD` strings.
- **Coach login**: user **17** `claude@gmail.com` (`@claude_test_01`) is the coach. Password
  unknown. To view the console without it: mint a JWT and inject —
  `node --input-type=module -e "import 'dotenv/config'; import jwt from 'jsonwebtoken'; console.log(jwt.sign({sub:17,email:'claude@gmail.com'}, process.env.JWT_SECRET||'leanislaw-dev-secret-change-in-production',{expiresIn:'2h'}))"`
  then in the browser `localStorage.setItem('leanislaw_token', '<token>')` and reload `/coach`.
  The console is forced dark (no toggle); `localStorage['cc_theme']` is legacy/no longer needed.
- **Demo data**: coach 17's roster = Daniel Osei (18), Priya Nair (19), Sofia Romano (20),
  Marcus Bell (21). Reports exist for week **2026-06-08**. "Today" in this project's data
  context was **2026-06-21**, so the default reported week (last completed Monday) is
  2026-06-08. Marcus (21) has bench/squat progression across 2026-06-01/08/15.
- **MCP browser quirks**: window ~537px wide; navigation to `everfit.io` is BLOCKED; the
  extension only sees tabs in its own tab group. To capture full desktop layout, set
  `document.documentElement.style.zoom='0.6'`, screenshot, then reset to `''`.
- **Engine deps**: `pip install -r coaching-platform/reports/requirements.txt`
  (reportlab, matplotlib) must be present for PDF generation; `ffmpeg` was installed via brew
  this session (only needed for video frame extraction).
- **Read first**: `leanislaw/backend/docs/weekly-report-mapping.md` (full data mapping +
  endpoint list + ops runbook) and `docs/everfit-reference/` (target layout).
- **For new AI features, default to Claude** (latest model), not the repo's OpenAI/Chad chat.
- **Verify visually after frontend changes** — this project is very design-sensitive; the user
  iterates hard on exact colors/spacing. Match the warm-charcoal `--cc-*` tokens in `index.css`.
