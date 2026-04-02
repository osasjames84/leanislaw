-- Mutual friendships: one row per pair with user_a_id < user_b_id (enforced in app).
CREATE TABLE IF NOT EXISTS user_friendships (
  user_a_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a_id, user_b_id),
  CONSTRAINT user_friendships_ordered CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friendships_user_a ON user_friendships (user_a_id);
CREATE INDEX IF NOT EXISTS idx_user_friendships_user_b ON user_friendships (user_b_id);
