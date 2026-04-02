-- Optional public handle; unique when set (Postgres allows many NULLs on UNIQUE).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(30);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_uidx ON users (username);
