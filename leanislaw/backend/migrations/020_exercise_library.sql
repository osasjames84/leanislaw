-- Exercise Library: enrich the existing exercises table (non-destructive).
-- Existing workout logging references exercises(id) and uses (name, body_part) only,
-- so all new columns are nullable and optional.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment VARCHAR(60);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS level VARCHAR(20);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
