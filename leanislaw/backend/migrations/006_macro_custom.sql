-- Optional custom macro grams (must match target calories within tolerance when set)

ALTER TABLE user_macro_plan
  ADD COLUMN IF NOT EXISTS custom_protein_g numeric(8, 2),
  ADD COLUMN IF NOT EXISTS custom_carbs_g numeric(8, 2),
  ADD COLUMN IF NOT EXISTS custom_fat_g numeric(8, 2);
