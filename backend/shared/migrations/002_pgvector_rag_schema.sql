-- ============================================================================
-- DELTIX — Dedicated pgvector RAG Schema Migration (002_pgvector_rag_schema.sql)
-- Isolated vector storage for RAG / Agent Semantic Memory
-- Independent from the 9 core ACID financial tables in 001_initial_schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- 1. DEDICATED SCHEMA FOR VECTOR MEMORY & RAG
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS rag_vector;

-- ----------------------------------------------------------------------------
-- 2. DOCUMENTS (Source Documents / External Knowledge Artifacts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_vector.documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT NOT NULL,
    agent_id    TEXT,
    title       TEXT NOT NULL,
    source_uri  TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_tenant_agent
    ON rag_vector.documents (tenant_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at
    ON rag_vector.documents (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. DOCUMENT CHUNKS (Semantic Vectors & Full-Text Search)
-- Google Gemini text-embedding-004 uses 768 dimensions.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_vector.document_chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID REFERENCES rag_vector.documents(id) ON DELETE CASCADE,
    tenant_id     TEXT NOT NULL,
    agent_id      TEXT,
    chunk_index   INT NOT NULL DEFAULT 0,
    content       TEXT NOT NULL,
    embedding     vector(768),
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant_agent
    ON rag_vector.document_chunks (tenant_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id
    ON rag_vector.document_chunks (document_id);

-- HNSW vector index for approximate nearest neighbors (cosine distance)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
    ON rag_vector.document_chunks USING hnsw (embedding vector_cosine_ops);

-- Full text search (tsvector) index for keyword & BM25 hybrid ranking
ALTER TABLE rag_vector.document_chunks
    ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv
    ON rag_vector.document_chunks USING gin (content_tsv);
