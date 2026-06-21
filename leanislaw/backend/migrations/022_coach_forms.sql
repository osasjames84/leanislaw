-- Coach-built forms (intake / check-in questionnaires), assignments + responses.
-- Idempotent (IF NOT EXISTS) to match the startup migration runner.

CREATE TABLE IF NOT EXISTS coach_forms (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  -- [{ id, label, type: 'text'|'textarea'|'number'|'scale', required }]
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_forms_coach ON coach_forms (coach_id);

CREATE TABLE IF NOT EXISTS form_assignments (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES coach_forms(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_assignments_unique UNIQUE (form_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_form_assignments_client ON form_assignments (client_id);

CREATE TABLE IF NOT EXISTS form_responses (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES coach_forms(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- { fieldId: answer }
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_responses_unique UNIQUE (form_id, client_id)
);
