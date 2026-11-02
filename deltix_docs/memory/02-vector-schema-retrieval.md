# Memory Layer: Vector Schema & Retrieval

## 1. Vector Database Schema (PostgreSQL + pgvector)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE incident_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL,
    error_signature TEXT,
    embedding vector(1536) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    resolved_action_type TEXT,
    was_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (incident_id)
);

-- Fast Approximate Nearest Neighbor Index (HNSW with Cosine Distance)
CREATE INDEX idx_incident_embeddings_hnsw 
ON incident_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Indexed Offset & Filtering Composite Index
CREATE INDEX idx_incident_embeddings_filter 
ON incident_embeddings (incident_type, was_verified, created_at DESC, id);
```

---

## 2. Similarity Retrieval Query

When an incident requires investigation, the Python AI service executes a filtered vector search to retrieve only **verified resolutions**:

```sql
SELECT 
    incident_id,
    incident_type,
    resolved_action_type,
    metadata->>'summary' AS past_summary,
    metadata->>'resolution_rationale' AS past_rationale,
    1 - (embedding <=> $1) AS similarity_score
FROM incident_embeddings
WHERE was_verified = true
  AND incident_type = $2
ORDER BY embedding <=> $1
LIMIT 3;
```

---

## 3. Few-Shot Memory Context Assembly

The retrieved historical incidents are formatted into the LLM system prompt as verified precedents:

```text
HISTORICAL SIMILAR INCIDENT RESOLUTIONS (FEW-SHOT PRECEDENTS):

1. Past Incident ID: inc-091a (Similarity: 0.94)
   - Type: PAYMENT_CAPTURED_ORDER_PENDING
   - Authoritative State: PayPal capture status was COMPLETED, order was PENDING.
   - Successful Action: REPROCESS_INTERNAL_ORDER_EVENT
   - Rationale: Authoritative provider confirmed capture. Reprocessing internal event safely updated order state to PAID without duplicating payment.
   - Verification: Confirmed order status became PAID and capture remained COMPLETED.

Use these precedents to evaluate if the current incident follows an identical failure pattern.
```

---

## 4. Write-Back Pipeline

When an incident's postconditions are confirmed by the Go **Verifier**:
1. Go publishes an `INCIDENT_VERIFIED` event or updates `verifications`.
2. Python AI service embeds the incident summary, root cause, and verified action.
3. Inserts or updates the row in `incident_embeddings` with `was_verified = true`.
4. Invalidates the Redis memory cache for that incident signature.
