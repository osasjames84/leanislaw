-- MacroFactor-style goals, food catalog, and per-day food log

CREATE TABLE IF NOT EXISTS food_catalog (
  id serial PRIMARY KEY,
  name text NOT NULL,
  kcal_per_100g numeric(8, 2) NOT NULL,
  protein_per_100g numeric(8, 2) NOT NULL,
  carbs_per_100g numeric(8, 2) NOT NULL,
  fat_per_100g numeric(8, 2) NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_macro_plan (
  user_id integer PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  goal varchar(16) NOT NULL DEFAULT 'maintain',
  weekly_change_kg numeric(6, 2) NOT NULL DEFAULT 0,
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_log_entries (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date date NOT NULL,
  food_catalog_id integer NOT NULL REFERENCES food_catalog (id),
  grams numeric(10, 2) NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_log_user_date ON food_log_entries (user_id, date);

-- Starter foods (per 100 g, rounded from USDA-style references)
INSERT INTO food_catalog (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
SELECT x.name, x.k, x.p, x.c, x.f
FROM (
  VALUES
    ('Chicken breast (raw)', 120::numeric, 22.5::numeric, 0::numeric, 2.6::numeric),
    ('Chicken breast (cooked)', 165::numeric, 31.0::numeric, 0::numeric, 3.6::numeric),
    ('Egg (whole, raw)', 143::numeric, 12.6::numeric, 0.7::numeric, 9.5::numeric),
    ('Greek yogurt (plain, 0%)', 59::numeric, 10.3::numeric, 3.6::numeric, 0.4::numeric),
    ('White rice (cooked)', 130::numeric, 2.7::numeric, 28.0::numeric, 0.3::numeric),
    ('Oats (dry)', 389::numeric, 16.9::numeric, 66.3::numeric, 6.9::numeric),
    ('Broccoli (raw)', 34::numeric, 2.8::numeric, 7.0::numeric, 0.4::numeric)
) AS x(name, k, p, c, f)
WHERE NOT EXISTS (SELECT 1 FROM food_catalog fc WHERE lower(fc.name) = lower(x.name));
