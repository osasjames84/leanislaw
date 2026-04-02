-- Optional vectors for semantic Chad knowledge retrieval (OpenAI embeddings).
-- Table may not exist until knowledge ingest runs; skip ALTER in that case.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'knowledge_chunks'
  ) THEN
    ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding jsonb;
  END IF;
END $$;
