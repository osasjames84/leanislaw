-- Email verification + min-age enforced in app; existing accounts stay usable.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token varchar(128);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamp;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_verification_token_uidx
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;

UPDATE users SET email_verified = true WHERE email_verified = false;
