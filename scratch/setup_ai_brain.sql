-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table to store the AI's "memory" for each user
CREATE TABLE IF NOT EXISTS ai_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(768), -- Gemini embeddings are usually 768 dimensions
    source TEXT DEFAULT 'manual', -- e.g., 'zapier', 'meta_ads', 'google_sheets'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

-- Create policies so users can only access their own memory
CREATE POLICY "Users can insert their own memory" ON ai_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own memory" ON ai_memory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory" ON ai_memory
    FOR DELETE USING (auth.uid() = user_id);

-- Create a function to search for memories similar to a given query embedding
-- This uses cosine similarity (<=>) to find the closest matches
CREATE OR REPLACE FUNCTION match_memory (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ai_memory.id,
    ai_memory.content,
    1 - (ai_memory.embedding <=> query_embedding) AS similarity
  FROM ai_memory
  WHERE ai_memory.user_id = p_user_id
    AND 1 - (ai_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY ai_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;
