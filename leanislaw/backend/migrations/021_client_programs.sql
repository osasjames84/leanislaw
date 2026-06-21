-- Coach -> client workout assignment ("programs").
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.
--
-- This is the explicit coach->client training link. Each row is one planned
-- workout for a client on (optionally) a scheduled date. The exercises array is
-- the prescription (target sets/reps/weight); when the client completes it we
-- record status + an optional link to the logged workout_sessions row.
--
-- The weekly report's training-adherence denominator becomes the count of
-- assigned workouts for that week when any exist (see buildBundle.js), instead
-- of the static coach_clients.weekly_training_target.
CREATE TABLE IF NOT EXISTS assigned_workouts (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  -- The day the workout is planned for. Drives weekly grouping + adherence.
  scheduled_date DATE,
  -- [{ exercise_id, name, body_part, sets, reps, weight, notes }]
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- assigned | completed | skipped
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  completed_session_id INTEGER REFERENCES workout_sessions(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_client ON assigned_workouts (client_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_coach ON assigned_workouts (coach_id);
