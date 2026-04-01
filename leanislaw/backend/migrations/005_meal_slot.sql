ALTER TABLE food_log_entries
ADD COLUMN IF NOT EXISTS meal_slot varchar(24) NOT NULL DEFAULT 'uncategorized';
