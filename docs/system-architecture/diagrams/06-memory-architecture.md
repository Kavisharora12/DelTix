# 06 — Memory Architecture Diagram

This diagram visualizes the multi-tier memory architecture in **DelTix**, separating ephemeral execution state, Redis caching, Supabase authoritative state, and Mem0 semantic vectors.

```mermaid
flowchart TB
    subgraph AgentExecution["LangGraph State Engine (Python / Ephemeral In-Memory)"]
        direction TB
        ActiveState["Graph State Snapshot\n- Current Step Index\n- Node Working Context\n- Tool Return Values\n- Iteration Counters"]
    end

    subgraph CachingLayer["Redis 7 (In-Memory Fast Layer)"]
        direction TB
        RedisLocks["Distributed Redsync Locks\n- run_id mutex to prevent concurrent runs"]
        RedisDedup["Deduplication Cache\n- webhook_id & idempotency keys (TTL: 24h)"]
        RedisTopK["Top-k Semantic Memory Cache\n- Sub-millisecond hit for repeated queries"]
    end

    subgraph OperationalStorage["Supabase (PostgreSQL 16 - System of Record)"]
        direction TB
        RunsTable[("agent_runs\n- run_id (PK)\n- spec_id\n- tenant_id\n- status (RUNNING/PAUSED/DONE)\n- step_checkpoints (JSONB)\n- final_output (JSONB)")]
        ApprovalsTable[("approval_requests\n- approval_id (PK)\n- run_id (FK)\n- action_name\n- requested_payload\n- status (PENDING/APPROVED/REJECTED)\n- token_hash")]
        AuditTable[("audit_events\n- event_id (PK)\n- run_id (FK)\n- timestamp\n- caller_identity\n- tool_called\n- policy_evaluation")]
    end

    subgraph SemanticMemory["Mem0 Vector Engine (Python + Supabase pgvector)"]
        direction TB
        Mem0Engine["Mem0 Memory Layer\n- User Preferences & Directives\n- Merchant Context & Historical Patterns\n- Past Case Explanations\n- Invalidation & Stale Memory Pruning"]
        SupabasePgVector[("Supabase pgvector Store\n- Tenant & Agent Scoped Embeddings\n- Cosine Similarity Search (k=3..5)")]
    end

    ActiveState <-->|"Acquire / Release Mutex"| RedisLocks
    ActiveState -->|"1. Step Checkpoint (After each node)"| RunsTable
    ActiveState -->|"2. Suspend for Human Approval"| ApprovalsTable
    ActiveState -->|"3. Immutable Trace Append"| AuditTable

    RunsTable -->|"4. Resume Execution (Hydrate graph state)"| ActiveState

    ActiveState <-->|"5. Check Cache First"| RedisTopK
    RedisTopK -.->|"Cache Miss: Query Mem0"| Mem0Engine
    ActiveState <-->|"6. Retrieve Semantic Context"| Mem0Engine
    ActiveState -->|"7. Store Significant Learnings (Post-run)"| Mem0Engine
    Mem0Engine <--> SupabasePgVector

    note["CRITICAL INVARIANT:\nMem0 and Redis NEVER store authoritative financial balances or transaction states.\nSupabase PostgreSQL + Live PayPal Sandbox API remain the sole authoritative truth."]
```
