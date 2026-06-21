-- Client profile depth (Everfit-style Overview + Metrics): coach-owned goal/notes/
-- injuries + profile-card fields, multi-metric body measurements, progress photos.
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.

CREATE TABLE IF NOT EXISTS client_profile (
  client_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal_text TEXT,
  goal_date DATE,
  coach_notes TEXT,
  injuries TEXT,
  phone VARCHAR(40),
  location VARCHAR(120),
  package VARCHAR(120),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Body measurements beyond weight/body-fat (which live in body_metrics):
-- chest, waist, hips, shoulders, arm, thigh, neck, calf, etc. One row per
-- client/date/metric.
CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  metric VARCHAR(40) NOT NULL,
  value NUMERIC(8,2) NOT NULL,
  unit VARCHAR(12) NOT NULL DEFAULT 'cm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT body_measurements_unique UNIQUE (client_id, date, metric)
);
CREATE INDEX IF NOT EXISTS idx_body_measurements_client ON body_measurements (client_id, metric, date);

-- Progress photos stored in-DB as base64 (matches direct_messages.image_base64).
CREATE TABLE IF NOT EXISTS progress_photos (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  angle VARCHAR(20),
  image_mime VARCHAR(64),
  image_base64 TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_progress_photos_client ON progress_photos (client_id, date);
