-- Coach -> client tasks & habits (Everfit-style). A task is one-off (optional
-- due date); a habit recurs and is checked off per day. Completions are per day.
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.

CREATE TABLE IF NOT EXISTS client_tasks (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  -- task | habit
  kind VARCHAR(12) NOT NULL DEFAULT 'task',
  due_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_tasks_client ON client_tasks (client_id, active);

CREATE TABLE IF NOT EXISTS task_completions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES client_tasks(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_completions_unique UNIQUE (task_id, date)
);
