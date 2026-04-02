-- Idempotent catch-up if a database missed earlier files. Safe to re-run.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tdee_onboarding_done boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_coaching_active boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token varchar(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_hash varchar(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_sent_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_setup_done boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_verification_token_uidx
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_password_reset_code_uidx
  ON users (password_reset_code_hash)
  WHERE password_reset_code_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_uidx ON users (username);
