# Weekly per-client reporting — data mapping (Step 1)

How the **real** `leanislaw` Postgres/Drizzle schema feeds the existing Python
report engine in `coaching-platform/reports/`. The engine consumes one
normalized "weekly bundle" per coach (shape = `reports/sample_data.json`) and runs
`build_report()` → `report_html.py` (dashboard) + `report_pdf.py` (per-client PDF).
The thresholds/flagging in `reports/transform.py` are **reused as-is**, not rebuilt.

> Note: `coaching-platform/CLAUDE.md` / `PLATFORM_PLAN.md` describe a Supabase
> design (tables `clients`, `nutrition_logs`, `checkins`, `reports`,
> `client_safeguarding`, RLS…). **None of that exists here.** The real app is
> Node + Express + Drizzle on plain Postgres (`leanislaw/backend`). The real code
> wins; this doc maps to what actually exists.

## Engine input → real tables

Per-client bundle fields (left) and where each comes from (right).

### Identity / goal
| Engine field | Source | Notes |
|---|---|---|
| `id` | `users.id` | role = `client` |
| `name` | `users.first_name` + `users.last_name` | |
| `goal` | `user_macro_plan.goal` (`lose`/`maintain`/`gain`) | map to a label e.g. "Fat loss" |

### training
| Engine field | Source | Notes |
|---|---|---|
| `completed` | count of `workout_sessions` in week where `is_template=false` and `end_time IS NOT NULL` (finished) | |
| `sessions[]` `{day,name,completed}` | `workout_sessions` rows in week → `day` from `date` weekday, `name`, `completed = end_time IS NOT NULL` | |
| `notes` | concatenated `workout_sessions.notes` | partial |
| `assigned` | **GAP** — see below | no program/assignment model exists |

### nutrition
| Engine field | Source | Notes |
|---|---|---|
| `days[]` `{date,calories,protein_g,hit_protein}` | `food_log_entries` ⨝ `food_catalog`, grouped by `date` within week; `calories`/`protein_g` summed via `macrosForGrams` (lib/macroEngine.js); `hit_protein = protein_g >= target_protein_g` | primary source |
| `logged_days` | distinct `food_log_entries.date` in week | |
| `target_days` | `7` (constant; coach-configurable later) | |
| `target_calories` | `computeMacroTargets()` from `user_tdee_state` (maintenance: ema_tdee→baseline) + `user_macro_plan` + latest `body_metrics.weight_kg` | already the live `/macros/plan` logic |
| `target_protein_g` | same `computeMacroTargets()` output | |

Secondary calorie source: `daily_logs.calories` (manual calorie entry, no protein).
Some clients log calories there instead of the food log → see gap #2.

### body
| Engine field | Source | Notes |
|---|---|---|
| `unit` | constant `"kg"` | app stores `weight_kg` |
| `weight_series[]` `{date,weight}` | `body_metrics` rows in week → `{date, weight: weight_kg}` | drives rapid-loss flag |
| `measurements` | `body_metrics.body_fat_pct` (only field available) | **no** waist/circumference captured (gap) |

### checkin  — **largely a GAP**
| Engine field | Source | Notes |
|---|---|---|
| `steps_avg` | avg of `daily_tdee_inputs.steps` / `daily_logs.steps` over week | derivable |
| `submitted`, `sleep_h`, `energy_1to5`, `stress_1to5`, `notes` | **GAP** — no weekly wellbeing check-in is captured anywhere | needs new table + client UI |

## Gaps (data the report needs but the app doesn't capture yet)

1. **Coach ↔ client roster.** No `coach_id`/link on `users`. Only
   `user_friendships` (undirected, powers DMs) and `friend_requests` exist.
   → Need an explicit coach→client relationship to build a roster.
2. **Training "assigned" count.** No assigned-program model — `workout_sessions`
   are self-logged; `is_template` exists but isn't a weekly plan. The engine's
   training-adherence % needs a denominator.
3. **Weekly check-in (sleep / energy / stress / notes).** Not captured. This is
   also the duty-of-care **intake PAR-Q + wellbeing** requirement.
4. **Reports persistence.** No `reports` table; nowhere to store status/flags/PDF
   per client per week.
5. **PDF storage.** App has **no** file storage (no S3/disk/multer). Binaries are
   stored in Postgres as base64/bytea (see `direct_messages.image_base64`).
   → Store the generated PDF the same way (bytea/base64 column).
6. **Body measurements** beyond weight + body-fat% (e.g. waist) aren't captured —
   minor; engine treats `measurements` as optional.
7. **Hide-raw-numbers + region/support config** — no per-client safeguarding row.

## Proposed new tables (minimal, match existing migration style)

- `coach_clients (coach_id, client_id, status, created_at)` — the roster link.
- `client_safeguarding (client_id PK, hide_raw_numbers bool, par_q jsonb,
  screen_completed bool, wellbeing_note text, support_region text default 'UK',
  created_at, updated_at)` — duty-of-care.
- `weekly_checkins (id, client_id, week_start, sleep_h, energy_1to5,
  stress_1to5, notes, created_at, unique(client_id, week_start))` — feeds `checkin`.
- `weekly_reports (id, coach_id, client_id, week_start, status, flags jsonb,
  model jsonb, pdf_bytea, generated_at, unique(client_id, week_start))` —
  persistence + PDF (bytea, matching the app's in-DB binary pattern).
- `coach_clients` may also carry `weekly_training_target int` to supply the
  training `assigned` denominator (gap #2).

## Engine integration options (decision needed)

The Python engine (reportlab + matplotlib) is already a precedent — the app runs
a Python service for Chess-vs-Chad. Python 3.9 + pip are available locally.

- **Option A — Build bundle in Node, run the full Python pipeline.** Node queries
  the real DB, emits the bundle JSON, shells out to a thin `run_from_bundle.py`
  wrapper that calls `build_report` + `build_dashboard_html` + `build_client_pdf`
  unchanged. Persist the returned model (status/flags/summary) + PDF bytes. The
  React coach UI just renders the persisted model. **Single source of truth for
  thresholds (Python).** Needs reportlab/matplotlib installed on the deploy.
- **Option B — Port `transform.py` thresholds to JS for the roster, Python only
  for the PDF.** React renders a native roster; PDF still from `report_pdf.py`.
  Duplicates the flagging logic in two languages (drift risk).

Recommendation: **Option A** — least duplication, honours "reuse the engine,
don't reinvent the thresholds."

## Scheduling (decision needed)
Weekly run options: `node-cron` inside the Express server, or a Railway/host cron
hitting a protected `POST /api/v1/reports/run` endpoint. Recommend an idempotent
endpoint (re-runnable per week) + host cron, with `node-cron` as a fallback.

---

# Implementation (Step 3) — what shipped

**Decisions taken:** explicit `coach_clients` table · full Python pipeline
(Option A) · per-client `weekly_training_target` · host-cron endpoint + opt-in
in-process fallback.

## Endpoints
Coach (role=coach):
- `GET  /api/v1/reports/clients` · `POST /api/v1/reports/clients` ·
  `PATCH /api/v1/reports/clients/:clientId` · `DELETE /api/v1/reports/clients/:clientId`
- `GET/PUT /api/v1/reports/clients/:clientId/safeguarding` (hide-raw-numbers, region)
- `POST /api/v1/reports/run` `{ week_start? }` — build + run engine + persist
- `GET  /api/v1/reports/roster?week=` — needs-attention-first roster + summary
- `GET  /api/v1/reports/:id/pdf` — stored per-client PDF
- `GET  /api/v1/reports/dashboard?week=` — engine's standalone HTML dashboard
- `POST /api/v1/reports/cron/run-all` — header `x-cron-secret`, all coaches

Client:
- `GET  /api/v1/safeguarding/me` · `GET /api/v1/safeguarding/support`
- `POST /api/v1/safeguarding/intake` (PAR-Q + wellbeing)
- `POST /api/v1/safeguarding/checkin` (weekly wellbeing)
- `GET  /api/v1/safeguarding/my-week?week=` — adherence-only, never raw numbers
  when hide_raw_numbers is on, never coach flags.

## Code map
- `lib/weeklyReport/weekRange.js` — Mon-anchored week math
- `lib/weeklyReport/buildBundle.js` — real DB → engine bundle (reuses macroEngine)
- `lib/weeklyReport/runEngine.js` — spawns `reports/run_from_bundle.py`
- `lib/weeklyReport/generate.js` — orchestrate + persist (upsert per client/week)
- `lib/weeklyReport/schedule.js` — opt-in in-process weekly fallback
- `lib/supportResources.js` — region signposts (UK=Beat default)
- `routes/reports.js`, `routes/safeguarding.js`
- Frontend: `CoachRoster`, `MyWeek`, `IntakeScreen`, `SupportPage`, `SupportSignpost`

## Operations
- Engine deps (where the backend runs): `pip install -r coaching-platform/reports/requirements.txt`
- Env:
  - `REPORTS_CRON_SECRET` — shared secret for the cron endpoint (required to use it)
  - `REPORTS_INPROCESS_SCHEDULE=1` — enable the in-process fallback (default off)
    · `REPORTS_SCHEDULE_DOW` (default 1=Mon) · `REPORTS_SCHEDULE_HOUR` (default 6)
  - `PYTHON_BIN` (default `python3`) · `REPORTS_DIR` (override engine path)
  - `SUPPORT_RESOURCES_JSON` — override/extend support signposts by region
- Host cron (weekly, Monday 06:10), reports the last completed week:
  ```
  10 6 * * 1 curl -fsS -X POST "$APP_URL/api/v1/reports/cron/run-all" \
    -H "x-cron-secret: $REPORTS_CRON_SECRET"
  ```

## Known scope notes / follow-ups
- Nutrition uses the food log (`food_log_entries`); clients who track calories via
  `daily_logs` only (no protein) won't populate macro days. Two sources exist (gap #2).
- A "completed" training session = finished (`end_time`) or has logged sets.
- `hide_raw_numbers` is enforced server-side on `my-week`; the client's own
  logging screens (MacroTracking/Dashboard) carry pre-existing uncommitted edits
  and were intentionally left untouched.
- `schema.js` and `server.js` wiring lives in the working tree (not in the feature
  commits) because both already carried unrelated uncommitted changes.
