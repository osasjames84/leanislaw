-- Friend-to-friend text DMs (only between users who share a user_friendships edge; enforced in API).
CREATE TABLE IF NOT EXISTS direct_messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT direct_messages_no_self CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_recipient_time
  ON direct_messages (sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_sender_time
  ON direct_messages (recipient_id, sender_id, created_at DESC);
