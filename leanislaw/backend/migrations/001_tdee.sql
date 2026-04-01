-- Run against your LeanIsLaw DB (e.g. psql) if tables do not exist yet.

CREATE TABLE IF NOT EXISTS body_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC(7,2) NOT NULL,
  body_fat_pct NUMERIC(5,2),
  CONSTRAINT body_metrics_user_date UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS daily_tdee_inputs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps INTEGER NOT NULL DEFAULT 0,
  activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT daily_tdee_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_body_metrics_user_date ON body_metrics (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_tdee_user_date ON daily_tdee_inputs (user_id, date);
