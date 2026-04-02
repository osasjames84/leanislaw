-- false = must complete /setup/username before TDEE (new signups set false in app).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_setup_done boolean NOT NULL DEFAULT true;
