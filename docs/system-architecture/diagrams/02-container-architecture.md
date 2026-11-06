# 02 — Container Architecture Diagram

This diagram illustrates the container architecture of **DelTix**, detailing the Go control plane, Python execution plane, Redis caching/locking, Supabase database, and external providers.

```mermaid
flowchart LR
    Client["Client Browser / Dashboard"]

    subgraph Edge["Edge Ingress"]
        APIGateway["Service 1: API Gateway (Go)\n- Port 8080\n- JWT Auth\n- Redis Rate Limiter\n- SSE Stream Proxy"]
    end

    subgraph ControlPlane["Control Plane (Go)"]
        CompilerSvc["Service 2: Compiler Service\n- Port 8081\n- NL Parser\n- Agent IR Validator\n- Test Generator"]
        CapPolicySvc["Service 5: Capability & Policy\n- Port 8084\n- Capability Catalog\n- Policy Engine\n- PayPal Sandbox Adapter"]
    end

    subgraph ExecutionPlane["Execution Plane (Go + Python)"]
        RuntimeSvc["Service 3: Runtime Service\n- Go Controller (:8082)\n- Python LangGraph (:8085)\n- Redis Lock Manager\n- Checkpointer"]
        MemorySvc["Service 4: Memory Service\n- Python / FastAPI (:8083)\n- Mem0 Engine\n- Top-k Semantic Cache"]
    end

    subgraph Storage["Persistence & Caching"]
        RedisStore[("Redis 7\n- Deduplication\n- Redsync Locks\n- Rate Limits")]
        SupabaseDB[("Supabase\n- PostgreSQL 16\n- pgvector Vectors\n- Checkpoints & Audits")]
    end

    subgraph External["External SaaS"]
        LLMProvider["LLM API\n(OpenAI / Anthropic)"]
        PPSandbox["PayPal Sandbox API"]
        LangSmithCloud["LangSmith Cloud"]
    end

    Client -->|"HTTP / SSE"| APIGateway
    APIGateway <-->|"Limits"| RedisStore
    APIGateway -->|"HTTP"| CompilerSvc
    APIGateway -->|"HTTP"| RuntimeSvc
    APIGateway -->|"HTTP"| CapPolicySvc

    CompilerSvc <-->|"Resolve & Policy"| CapPolicySvc
    CompilerSvc <-->|"Prompts"| LLMProvider
    CompilerSvc -->|"Specs"| SupabaseDB

    RuntimeSvc <-->|"Redsync Lock"| RedisStore
    RuntimeSvc <-->|"Context"| MemorySvc
    RuntimeSvc <-->|"Tools"| CapPolicySvc
    RuntimeSvc <-->|"State"| SupabaseDB
    RuntimeSvc -->|"Traces"| LangSmithCloud

    CapPolicySvc <-->|"OAuth2"| PPSandbox
    CapPolicySvc -->|"Audit"| SupabaseDB

    MemorySvc <-->|"Cache"| RedisStore
    MemorySvc <-->|"Vectors"| SupabaseDB
```
