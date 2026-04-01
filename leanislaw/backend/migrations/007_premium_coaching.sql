ALTER TABLE users
  ADD COLUMN IF NOT EXISTS premium_coaching_active boolean NOT NULL DEFAULT false;
