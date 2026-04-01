-- Daily intake + metabolic EMA state + strength tracking

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS calories integer;

CREATE UNIQUE INDEX IF NOT EXISTS daily_logs_user_date_uidx ON daily_logs (user_id, date);

CREATE TABLE IF NOT EXISTS user_tdee_state (
  user_id integer PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  baseline_tdee integer NOT NULL,
  ema_tdee numeric(10, 1),
  ema_intake numeric(10, 1),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_strength_profile (
  user_id integer PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  years_lifting numeric(5, 1),
  bench_variation varchar(40),
  bench_lb numeric(8, 1) NOT NULL,
  baseline_bench_lb numeric(8, 1),
  squat_variation varchar(40),
  squat_lb numeric(8, 1) NOT NULL,
  baseline_squat_lb numeric(8, 1),
  hinge_variation varchar(40),
  hinge_lb numeric(8, 1) NOT NULL,
  baseline_hinge_lb numeric(8, 1),
  bench_level varchar(24),
  squat_level varchar(24),
  hinge_level varchar(24),
  overall_level varchar(24),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strength_snapshots (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date date NOT NULL,
  bench_lb numeric(8, 1),
  squat_lb numeric(8, 1),
  hinge_lb numeric(8, 1),
  UNIQUE (user_id, date)
);
