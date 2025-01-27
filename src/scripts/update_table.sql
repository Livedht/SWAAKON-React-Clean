-- Drop the existing index if it exists
DROP INDEX IF EXISTS openai_embeddings_hf_embedding_idx;

-- Alter the hf_embedding column to support 768 dimensions
ALTER TABLE openai_embeddings 
ALTER COLUMN hf_embedding TYPE vector(768);

-- Recreate the index
CREATE INDEX openai_embeddings_hf_embedding_idx 
ON openai_embeddings 
USING ivfflat (hf_embedding vector_cosine_ops); 