# 10 — Deployment Architecture Diagram

This diagram specifies the Docker-based local deployment topology for **DelTix** oriented Left to Right, detailing container names, images, exposed ports, networks, and environment bindings.

```mermaid
flowchart LR
    subgraph Edge["Edge Tier"]
        Gateway["deltix-gateway\n(Go 1.23)\nPort: 8080\nEnv: JWT_SECRET,\nREDIS_URL"]
    end

    subgraph CoreServices["Go Control Plane"]
        Compiler["deltix-compiler\n(Go 1.23)\nPort: 8081\nEnv: LLM_API_KEY"]
        CapPolicy["deltix-capability\n(Go 1.23)\nPort: 8084\nEnv: PAYPAL_CLIENT_ID"]
        RuntimeGo["deltix-runtime-control\n(Go 1.23)\nPort: 8082\nEnv: REDIS_URL"]
    end

    subgraph AIWorkers["Python AI Plane"]
        RuntimeWorker["deltix-langgraph-worker\n(Python 3.11)\nPort: 8085\nEnv: LANGSMITH_API_KEY"]
        MemorySvc["deltix-memory\n(Python + Mem0)\nPort: 8083\nEnv: MEM0_API_KEY"]
    end

    subgraph DataStorage["Data & Cache Tier"]
        RedisDB[("deltix-redis\n(Redis 7)\nPort: 6379")]
        SupabaseDB[("deltix-supabase\n(Postgres 16 + pgvector)\nPort: 5432")]
    end

    subgraph CloudAPIs["External SaaS"]
        PayPalAPI["PayPal Sandbox\n(api-m.sandbox.paypal.com)"]
        LLMAPI["LLM Provider\n(OpenAI / Anthropic)"]
        LangSmith["LangSmith Cloud"]
    end

    Gateway --> Compiler
    Gateway --> RuntimeGo
    Gateway --> CapPolicy
    Gateway <--> RedisDB

    Compiler --> CapPolicy
    Compiler --> SupabaseDB
    Compiler --> LLMAPI

    RuntimeGo --> RuntimeWorker
    RuntimeGo --> CapPolicy
    RuntimeGo --> SupabaseDB
    RuntimeGo <--> RedisDB

    RuntimeWorker --> MemorySvc
    RuntimeWorker --> CapPolicy
    RuntimeWorker --> LangSmith
    RuntimeWorker --> LLMAPI

    MemorySvc --> SupabaseDB
    MemorySvc <--> RedisDB

    CapPolicy --> SupabaseDB
    CapPolicy <--> RedisDB
    CapPolicy <--> PayPalAPI
```
