-- Coach documents (per-client or shared) + per-client meal plans (Everfit-style).
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.

CREATE TABLE IF NOT EXISTS coach_documents (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- NULL client_id = shared with the whole roster.
  client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_documents_coach ON coach_documents (coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_documents_client ON coach_documents (client_id);

CREATE TABLE IF NOT EXISTS meal_plans (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_calories INTEGER,
  target_protein_g INTEGER,
  target_carbs_g INTEGER,
  target_fat_g INTEGER,
  -- [{ name, items: [string], notes }]
  meals JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meal_plans_client ON meal_plans (client_id);
