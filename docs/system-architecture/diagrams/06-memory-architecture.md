# 06 — Memory Architecture Diagram

This diagram visualizes the multi-tier memory architecture in **DelTix** oriented Left to Right, separating ephemeral execution state, Redis caching, Supabase authoritative state, and Mem0 semantic vectors.

```mermaid
flowchart LR
    subgraph S1["1. LangGraph State (Python)"]
        ActiveState["Active Graph Context\n- Working Variables\n- Tool Outputs\n- Step Index"]
    end

    subgraph S2["2. Fast Cache & Lock (Redis 7)"]
        RedisLocks["Redsync Mutex\n(lock:run_id)"]
        RedisDedup["Deduplication\n(TTL: 24h)"]
        RedisTopK["Top-k Cache\n(Query Hash)"]
    end

    subgraph S3["3. Semantic Memory (Mem0)"]
        Mem0Engine["Mem0 Vector Engine\n- Merchant Context\n- Case Summaries\n- Preferences"]
    end

    subgraph S4["4. System of Record (Supabase)"]
        RunsTable[("agent_runs\n& Checkpoints")]
        ApprovalsTable[("approval_requests")]
        AuditTable[("audit_events")]
        PgVectorStore[("pgvector\nEmbeddings")]
    end

    ActiveState <-->|"Acquire / Release"| RedisLocks
    ActiveState -->|"1. Save Checkpoint"| RunsTable
    ActiveState -->|"2. Pause Run"| ApprovalsTable
    ActiveState -->|"3. Append Log"| AuditTable

    RunsTable -->|"4. Hydrate on Resume"| ActiveState

    ActiveState <-->|"5. Check Cache"| RedisTopK
    RedisTopK -.->|"Cache Miss"| Mem0Engine
    ActiveState <-->|"6. Query Semantic"| Mem0Engine
    Mem0Engine <--> PgVectorStore

    note["INVARIANT: Mem0 and Redis NEVER store authoritative financial balances.\nSupabase PostgreSQL + Live PayPal Sandbox API remain the sole authoritative truth."]
```
