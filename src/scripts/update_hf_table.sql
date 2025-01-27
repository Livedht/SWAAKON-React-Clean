-- Drop the existing index first
DROP INDEX IF EXISTS idx_openai_embeddings_hf_embedding;
DROP INDEX IF EXISTS openai_embeddings_hf_embedding_idx;

-- Modify the hf_embedding column
ALTER TABLE openai_embeddings 
ALTER COLUMN hf_embedding TYPE vector(512);

-- Recreate the index for similarity search
CREATE INDEX idx_openai_embeddings_hf_embedding 
ON openai_embeddings 
USING ivfflat (hf_embedding vector_cosine_ops)
WITH (lists = '100'); 