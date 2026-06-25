-- Looksmax game loop: per-user progression (XP, level, streak, score, rank),
-- an XP event ledger (one award per action-type per day), and achievements.
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.

CREATE TABLE IF NOT EXISTS user_progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  looksmax_score INTEGER,
  rank VARCHAR(24),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (user, kind, date): each daily action awards XP at most once/day,
-- so we can reconcile XP straight from existing logs without changing log flows.
CREATE TABLE IF NOT EXISTS xp_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(40) NOT NULL,
  xp INTEGER NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT xp_events_unique UNIQUE (user_id, kind, date)
);
CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events (user_id, date);

CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(60) NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT achievements_unique UNIQUE (user_id, code)
);
