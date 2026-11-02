# PostgreSQL and Redis Data Model

## 1. Storage Architecture

- **PostgreSQL (with `pgvector` extension):** The durable system-of-record for transactions, relational workflow states, incident lifecycles, vector memory embeddings, and append-only audit entries.
- **Redis:** In-memory operational store for sub-millisecond deduplication (`SETNX`), rate limiting, distributed worker locking, and vector query caching.

---

## 2. High-Performance Indexing Strategy: Indexed Offsets (Keyset Pagination)

Standard SQL `OFFSET N` scans every previous row, resulting in $O(N)$ degradation for large event volumes. 

DELTIX enforces **Indexed Offset (Keyset / Cursor Pagination)** across all streaming and high-write tables using composite indices on `(timestamp_col DESC, id DESC)`. Queries seek directly via index lookup:

```sql
-- Fast O(1) Indexed Offset Seek Query
SELECT * FROM normalized_events
WHERE (occurred_at, id) < ($cursor_time, $cursor_id)
ORDER BY occurred_at DESC, id DESC
LIMIT $page_size;
```

---

## 3. PostgreSQL Tables & Composite Indices

### `source_events`
Stores raw immutable payloads before processing.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `source TEXT NOT NULL`
- `source_event_id TEXT NOT NULL`
- `event_type TEXT NOT NULL`
- `occurred_at TIMESTAMPTZ`
- `received_at TIMESTAMPTZ NOT NULL`
- `payload JSONB NOT NULL`
- `signature_verified BOOLEAN NOT NULL DEFAULT false`
- `processing_status TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Constraints & Indices:**
  - `UNIQUE (source, source_event_id)` (Idempotency)
  - `CREATE INDEX idx_source_events_indexed_offset ON source_events (created_at DESC, id DESC);` (Fast indexed offset seek)
  - `CREATE INDEX idx_source_events_status ON source_events (processing_status, created_at);`

### `normalized_events`
Canonical envelopes with indexed query fields.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `source_event_id UUID REFERENCES source_events(id)`
- `event_type TEXT NOT NULL`
- `payment_id TEXT`
- `order_id TEXT`
- `request_id TEXT`
- `service_name TEXT`
- `credential_ref TEXT`
- `occurred_at TIMESTAMPTZ NOT NULL`
- `attributes JSONB NOT NULL DEFAULT '{}'`
- **Indices:**
  - `CREATE INDEX idx_norm_events_indexed_offset ON normalized_events (occurred_at DESC, id DESC);` (Fast indexed offset seek)
  - `CREATE INDEX idx_norm_events_payment_id ON normalized_events (payment_id, occurred_at DESC) WHERE payment_id IS NOT NULL;`
  - `CREATE INDEX idx_norm_events_order_id ON normalized_events (order_id, occurred_at DESC) WHERE order_id IS NOT NULL;`
  - `CREATE INDEX idx_norm_events_request_id ON normalized_events (request_id) WHERE request_id IS NOT NULL;`

### `incidents`
Active and resolved problem records.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `incident_type TEXT NOT NULL`
- `severity TEXT NOT NULL`
- `status TEXT NOT NULL`
- `title TEXT NOT NULL`
- `summary TEXT`
- `primary_correlation_key TEXT`
- `first_seen_at TIMESTAMPTZ NOT NULL`
- `last_seen_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Indices:**
  - `CREATE INDEX idx_incidents_indexed_offset ON incidents (last_seen_at DESC, id DESC);` (Fast cursor browsing)
  - `CREATE INDEX idx_incidents_active ON incidents (status, severity, last_seen_at DESC);`
  - `CREATE INDEX idx_incidents_corr_key ON incidents (incident_type, primary_correlation_key, status);`

### `incident_events`
Many-to-many relationship mapping events to incidents.
- `incident_id UUID REFERENCES incidents(id)`
- `normalized_event_id UUID REFERENCES normalized_events(id)`
- Primary Key: `(incident_id, normalized_event_id)`

### `incident_embeddings` (pgvector Memory Layer)
Stores vector representations of incidents for historical retrieval.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `incident_id UUID NOT NULL REFERENCES incidents(id) UNIQUE`
- `incident_type TEXT NOT NULL`
- `error_signature TEXT`
- `embedding vector(1536) NOT NULL`
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `resolved_action_type TEXT`
- `was_verified BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Indices:**
  - `CREATE INDEX idx_incident_embeddings_hnsw ON incident_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`
  - `CREATE INDEX idx_incident_embeddings_offset ON incident_embeddings (incident_type, was_verified, created_at DESC, id DESC);`

### `evidence_items`
Evidence collected during investigation.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `incident_id UUID REFERENCES incidents(id)`
- `kind TEXT NOT NULL`
- `source_ref TEXT`
- `claim TEXT NOT NULL`
- `observed_at TIMESTAMPTZ NOT NULL`
- `limitations TEXT`
- `details JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Indices:**
  - `CREATE INDEX idx_evidence_items_offset ON evidence_items (incident_id, observed_at DESC, id DESC);`

### `investigations`
AI investigation results generated by the Python service.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `incident_id UUID REFERENCES incidents(id)`
- `model_name TEXT NOT NULL`
- `prompt_version TEXT NOT NULL`
- `result JSONB NOT NULL`
- `status TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### `action_proposals`
Proposed remediation actions.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `incident_id UUID REFERENCES incidents(id)`
- `action_type TEXT NOT NULL`
- `parameters JSONB NOT NULL`
- `reason TEXT NOT NULL`
- `preconditions JSONB NOT NULL`
- `postconditions JSONB NOT NULL`
- `risk_tier TEXT NOT NULL`
- `policy_decision TEXT NOT NULL`
- `idempotency_key TEXT NOT NULL UNIQUE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### `approvals`
Human operator decisions for approval-gated actions.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `action_proposal_id UUID REFERENCES action_proposals(id)`
- `approver_id TEXT NOT NULL`
- `decision TEXT NOT NULL`
- `reason TEXT`
- `decided_at TIMESTAMPTZ NOT NULL`

### `action_executions`
Execution logs and attempt tracking.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `action_proposal_id UUID REFERENCES action_proposals(id)`
- `status TEXT NOT NULL`
- `attempt INTEGER NOT NULL DEFAULT 1`
- `started_at TIMESTAMPTZ`
- `finished_at TIMESTAMPTZ`
- `result JSONB`
- `error_code TEXT`
- Unique constraint: `UNIQUE (action_proposal_id, attempt)`

### `verifications`
Independent postcondition verification results.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `action_execution_id UUID REFERENCES action_executions(id)`
- `status TEXT NOT NULL`
- `observed_state JSONB NOT NULL`
- `verified_at TIMESTAMPTZ NOT NULL`
- `details TEXT`

### `audit_entries`
Append-only system audit log.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `incident_id UUID`
- `actor_type TEXT NOT NULL`
- `actor_id TEXT`
- `operation TEXT NOT NULL`
- `entity_type TEXT NOT NULL`
- `entity_id TEXT NOT NULL`
- `details JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Indices:**
  - `CREATE INDEX idx_audit_entries_indexed_offset ON audit_entries (created_at DESC, id DESC);` (High-speed audit streaming)
  - `CREATE INDEX idx_audit_entries_incident ON audit_entries (incident_id, created_at DESC) WHERE incident_id IS NOT NULL;`

---

## 4. Redis Operational Structures

- **Deduplication Key:** `dedup:{source}:{source_event_id}` (TTL: 300s, `SETNX`)
- **Distributed Worker Lock:** `lock:action:{action_proposal_id}` (TTL: 30s)
- **Memory Query Cache:** `mem:incident:sim:{incident_type}:{error_signature}` (TTL: 1800s)
