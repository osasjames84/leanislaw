-- Optional per-user photo; null = default sub5 (DiceBear) derived from user id in app code.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url text;
