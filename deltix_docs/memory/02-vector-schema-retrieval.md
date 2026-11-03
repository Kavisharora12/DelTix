# Memory Layer: Mem0 Integration & Retrieval

## 1. Mem0 Configuration (Self-Hosted in Python Service)

The Python service (`deltix-ai-agent`) initializes the open-source `mem0ai` library using our existing PostgreSQL (`pgvector`) and Redis containers:

```bash
pip install mem0ai psycopg2-binary
```

```python
import os
from mem0 import Memory

# Configure Mem0 with self-hosted pgvector backend
mem0_config = {
    "vector_store": {
        "provider": "pgvector",
        "config": {
            "connection_string": os.environ["DATABASE_URL"],
            "table_name": "incident_memories",
            "distance_strategy": "cosine"
        }
    },
    "llm": {
        "provider": "gemini",
        "config": {
            "model": "gemini-1.5-flash",
            "api_key": os.environ["GEMINI_API_KEY"]
        }
    },
    "embedder": {
        "provider": "gemini",
        "config": {
            "model": "models/text-embedding-004",
            "api_key": os.environ["GEMINI_API_KEY"]
        }
    }
}

memory = Memory.from_config(mem0_config)
```

---

## 2. Storing Verified Incident Resolutions

When the Go **Verifier** confirms an incident's postconditions (`status = 'VERIFIED'`), `deltix-ai-agent` writes the precedent into Mem0 with structured metadata:

```python
def save_verified_precedent(
    incident_type: str,
    root_cause: str,
    action_type: str,
    rationale: str,
    verification_proof: str
):
    text_content = (
        f"Incident: {incident_type}. "
        f"Root cause: {root_cause}. "
        f"Remediated by: {action_type}. "
        f"Rationale: {rationale}. "
        f"Postcondition Verification: {verification_proof}"
    )
    
    memory.add(
        messages=text_content,
        user_id="deltix_system",
        metadata={
            "incident_type": incident_type,
            "action_type": action_type,
            "verified": True
        }
    )
```

---

## 3. Precedent Retrieval Query

When a new incident begins investigation, Mem0 retrieves the most relevant past precedents:

```python
def retrieve_precedents(incident_type: str, failure_description: str) -> list[dict]:
    # Query Mem0 filtered by incident type and verification status
    results = memory.search(
        query=failure_description,
        user_id="deltix_system",
        limit=3,
        filters={
            "incident_type": incident_type,
            "verified": True
        }
    )
    return results["results"]
```

---

## 4. Few-Shot Memory Context Assembly

Mem0 search results are injected directly into the LLM system prompt as verified precedents:

```text
HISTORICAL VERIFIED INCIDENT PRECEDENTS (VIA MEM0):

Precedent 1 (Relevance: 0.94):
- Incident Type: PAYMENT_CAPTURED_ORDER_PENDING
- Root Cause: Webhook delivery succeeded at PayPal but merchant order consumer dropped event.
- Remediated by: REPROCESS_INTERNAL_ORDER_EVENT
- Rationale: Authoritative PayPal capture was COMPLETED. Replaying the event updated order to PAID without moving money twice.
- Verification: Order status confirmed PAID and capture remained COMPLETED.

Use these precedents to evaluate whether the current incident follows an identical failure pattern.
```

---

## 5. Underlying Database Schema (Managed by Mem0 on pgvector)

Mem0 automatically maintains the `incident_memories` table in PostgreSQL with an HNSW cosine index:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Table created and managed by Mem0
CREATE TABLE IF NOT EXISTS incident_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    memory TEXT NOT NULL,
    hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fast HNSW Cosine Distance Index
CREATE INDEX IF NOT EXISTS idx_incident_memories_hnsw 
ON incident_memories 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```
