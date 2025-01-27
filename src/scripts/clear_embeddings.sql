-- Clear out hf_embedding and embedding_model columns
UPDATE openai_embeddings
SET hf_embedding = NULL,
    embedding_model = NULL;

-- Verify the update
SELECT COUNT(*) as total_rows,
       COUNT(hf_embedding) as rows_with_embeddings,
       COUNT(embedding_model) as rows_with_model
FROM openai_embeddings; 