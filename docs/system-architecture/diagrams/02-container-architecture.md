# 02 — Container Architecture Diagram

This diagram illustrates the container architecture of **DelTix**, detailing the Go control plane, Python execution plane, Redis caching/locking, Supabase database, and external providers.

```mermaid
flowchart TB
    Client["Client Browser / Developer Dashboard"]

    subgraph Edge["Edge / Ingress Tier"]
        APIGateway["Service 1: API Gateway (Go)\n- Port 8080\n- JWT Auth & Tenant Context\n- Redis-backed Token Bucket Rate Limiting\n- SSE Stream Proxy"]
    end

    subgraph ControlPlane["DelTix Control Plane Services (Go)"]
        CompilerSvc["Service 2: Agent Compiler Service (Go)\n- Port 8081\n- NL Parser & Clarification Engine\n- Agent IR Generation & Validator\n- Synthetic Test Suite Generator"]
        
        CapPolicySvc["Service 5: Capability & Policy Service (Go)\n- Port 8084\n- Capability Registry (PayPal Contracts)\n- Policy Engine (Spend Caps, Read/Write)\n- Human Approval Gatekeeper\n- PayPal Sandbox REST Adapter"]
    end

    subgraph ExecutionPlane["DelTix AI Agent Execution Plane (Go + Python)"]
        RuntimeSvc["Service 3: Agent Runtime Service (Go Controller + Python Worker)\n- Go Orchestrator (Port 8082)\n- Python LangGraph State Engine (Port 8085)\n- Distributed Locking via Redis\n- Checkpointing & Resumption\n- Interrupt Handler (Human-in-the-Loop)"]

        MemorySvc["Service 4: Memory Service (Python / FastAPI)\n- Port 8083\n- Mem0 Semantic Memory Manager\n- Tenant/Agent Vector Isolation (Supabase pgvector)\n- Redis Top-k Semantic Cache"]
    end

    subgraph Persistence["Storage, Cache & State Layer"]
        RedisStore[("Redis 7 (In-Memory Data Store)\n- Sub-millisecond Deduplication\n- Distributed Locks (redsync)\n- Rate Limiting Buckets\n- Top-k Memory Cache")]
        SupabaseDB[("Supabase (PostgreSQL 16 + pgvector)\n- agent_specs & agent_runs\n- step_checkpoints (JSONB)\n- audit_events & approval_requests\n- pgvector Semantic Memory Store")]
    end

    subgraph External["External Integrations"]
        LLMProvider["LLM API (OpenAI / Anthropic / Gemini)"]
        PPSandbox["PayPal Developer Sandbox API"]
        LangSmithCloud["LangSmith Tracing Platform"]
    end

    Client -->|"HTTP / SSE"| APIGateway
    APIGateway <-->|"Check Limits & Session"| RedisStore
    APIGateway -->|"Internal HTTP"| CompilerSvc
    APIGateway -->|"Internal HTTP"| RuntimeSvc
    APIGateway -->|"Internal HTTP"| CapPolicySvc

    CompilerSvc <-->|"Resolve Capabilities & Validate Policies"| CapPolicySvc
    CompilerSvc <-->|"Prompt / Schema Extraction"| LLMProvider
    CompilerSvc -->|"Persist Spec & Tests"| SupabaseDB

    RuntimeSvc <-->|"Acquire Distributed Lock"| RedisStore
    RuntimeSvc <-->|"Fetch Agent IR & Executable Config"| SupabaseDB
    RuntimeSvc <-->|"Retrieve Semantic Context"| MemorySvc
    RuntimeSvc <-->|"Execute Approved Tool Calls"| CapPolicySvc
    RuntimeSvc <-->|"State Checkpoints & Run Status"| SupabaseDB
    RuntimeSvc -->|"Export Spans & Run Traces"| LangSmithCloud

    CapPolicySvc <-->|"OAuth2 & Idempotent Calls"| PPSandbox
    CapPolicySvc -->|"Audit Logging & Approvals"| SupabaseDB

    MemorySvc <-->|"Top-k Cache"| RedisStore
    MemorySvc <-->|"Vector Search & Storage"| SupabaseDB
```
