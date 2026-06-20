-- Weekly per-client reporting + duty-of-care.
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.

-- Explicit coach -> client roster link (the app has no coach_id today; only the
-- undirected user_friendships graph that powers DMs). weekly_training_target is
-- the denominator for the engine's training-adherence %.
CREATE TABLE IF NOT EXISTS coach_clients (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekly_training_target INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coach_clients_no_self CHECK (coach_id <> client_id),
  CONSTRAINT coach_clients_unique UNIQUE (coach_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_coach_clients_coach ON coach_clients (coach_id);

-- Duty of care: per-client safeguarding + intake (PAR-Q + wellbeing).
-- hide_raw_numbers drives the client-facing adherence-only view. Coach always
-- sees full data. support_region selects the eating-disorder support signpost.
CREATE TABLE IF NOT EXISTS client_safeguarding (
  client_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hide_raw_numbers BOOLEAN NOT NULL DEFAULT FALSE,
  par_q JSONB,
  screen_completed BOOLEAN NOT NULL DEFAULT FALSE,
  wellbeing_note TEXT,
  support_region VARCHAR(8) NOT NULL DEFAULT 'UK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly wellbeing check-in -> the report 'checkin' section. week_start is the
-- Monday of the reported week.
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  sleep_h NUMERIC(4,1),
  energy_1to5 INTEGER,
  stress_1to5 INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_checkins_unique UNIQUE (client_id, week_start)
);

-- Persisted report per client per week. PDF stored in-DB as base64 text, the
-- same pattern the app already uses for binaries (direct_messages.image_base64).
CREATE TABLE IF NOT EXISTS weekly_reports (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  model JSONB NOT NULL,
  pdf_base64 TEXT,
  pdf_mime VARCHAR(64) NOT NULL DEFAULT 'application/pdf',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_reports_unique UNIQUE (client_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_coach_week ON weekly_reports (coach_id, week_start);

-- The engine's standalone HTML dashboard, one per coach per week.
CREATE TABLE IF NOT EXISTS weekly_dashboards (
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  html TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (coach_id, week_start)
);
