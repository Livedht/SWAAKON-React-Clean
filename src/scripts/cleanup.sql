-- Reset HuggingFace embeddings
UPDATE openai_embeddings 
SET hf_embedding = NULL,
    embedding_model = NULL 
WHERE embedding_model = 'distiluse-base-multilingual-cased-v2';

-- Verify the cleanup
SELECT COUNT(*) as remaining_hf_embeddings 
FROM openai_embeddings 
WHERE hf_embedding IS NOT NULL; 