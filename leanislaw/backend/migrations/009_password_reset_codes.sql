-- Password reset via 6-digit code + track failed logins for UX hint
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_code_hash varchar(128);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamp;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_sent_at timestamp;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS users_password_reset_code_uidx
  ON users (password_reset_code_hash)
  WHERE password_reset_code_hash IS NOT NULL;
