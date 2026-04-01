-- Existing accounts skip the new onboarding flow; new signups set false in application code.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tdee_onboarding_done boolean NOT NULL DEFAULT true;
