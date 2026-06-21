-- Coach resource library ("tutorials"): links/videos/docs shared with clients.
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.
-- Visible to all of the coach's active roster clients.

CREATE TABLE IF NOT EXISTS coach_tutorials (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  category VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_tutorials_coach ON coach_tutorials (coach_id);
