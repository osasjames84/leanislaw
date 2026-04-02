-- Pending friend requests (accept/decline). Accepted rows can be kept for audit or cleaned up by app.
CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_requests_no_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT friend_requests_status_check CHECK (status IN ('pending', 'accepted', 'declined'))
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_unique
  ON friend_requests (from_user_id, to_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_pending ON friend_requests (to_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_pending ON friend_requests (from_user_id) WHERE status = 'pending';
