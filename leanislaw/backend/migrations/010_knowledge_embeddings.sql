-- Optional vectors for semantic Chad knowledge retrieval (OpenAI embeddings).
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding jsonb;
