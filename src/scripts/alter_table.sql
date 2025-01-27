-- Enable vector extension if not already enabled
create extension if not exists vector;

-- Add new column for HuggingFace embeddings
alter table public.openai_embeddings
add column if not exists hf_embedding vector(512) null;

-- Create index for similarity search on HuggingFace embeddings
create index if not exists idx_openai_embeddings_hf_embedding 
on public.openai_embeddings 
using ivfflat (hf_embedding vector_cosine_ops)
with (lists = 100);

-- Add column to track which embedding model was used
alter table public.openai_embeddings
add column if not exists embedding_model text null; 