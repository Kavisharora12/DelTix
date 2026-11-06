# 10 — Deployment Architecture Diagram

This diagram specifies the Docker-based local deployment topology for **DelTix**, detailing container names, images, exposed ports, networks, and environment bindings.

```mermaid
flowchart TB
    subgraph Host["Docker Host (Local / Single Node VM)"]
        subgraph Networks["Docker Network: deltix-net (Bridge)"]
            
            subgraph EdgeTier["Edge Tier"]
                Gateway["api-gateway\nContainer: deltix-gateway\nTech: Go 1.23\nPorts: 8080:8080\nEnv: JWT_SECRET, REDIS_URL, ROUTE_CONFIG"]
            end

            subgraph ServiceTier["Go & Python Microservices"]
                Compiler["agent-compiler-service\nContainer: deltix-compiler\nTech: Go 1.23\nPort: 8081\nEnv: LLM_API_KEY, POLICY_SVC_URL, SUPABASE_DB_URL"]
                
                RuntimeControl["agent-runtime-service\nContainer: deltix-runtime-control\nTech: Go 1.23\nPort: 8082\nEnv: REDIS_URL, SUPABASE_DB_URL, LANGGRAPH_WORKER_URL"]

                RuntimeWorker["langgraph-worker\nContainer: deltix-langgraph-worker\nTech: Python 3.11 + LangGraph\nPort: 8085\nEnv: LANGSMITH_API_KEY, MEMORY_SVC_URL, POLICY_SVC_URL"]
                
                MemorySvc["memory-service\nContainer: deltix-memory\nTech: Python 3.11 + FastAPI + Mem0\nPort: 8083\nEnv: MEM0_API_KEY, SUPABASE_DB_URL, REDIS_URL"]
                
                CapPolicy["capability-policy-service\nContainer: deltix-capability\nTech: Go 1.23\nPort: 8084\nEnv: PAYPAL_CLIENT_ID, PAYPAL_SECRET, SUPABASE_DB_URL, REDIS_URL"]
            end

            subgraph StorageTier["Data & Cache Tier"]
                RedisDB["redis-cache\nContainer: deltix-redis\nImage: redis:7-alpine\nPorts: 6379:6379\nVolumes: redis_data:/data"]

                SupabaseLocal["supabase-db\nContainer: deltix-supabase\nImage: supabase/postgres:16\nPorts: 5432:5432\nVolumes: pg_data:/var/lib/postgresql/data\nExtensions: pgvector, uuid-ossp"]
            end
        end
    end

    subgraph ExternalSaaS["External SaaS & APIs"]
        PayPalAPI["PayPal Developer Sandbox\n(api-m.sandbox.paypal.com)"]
        LLMAPI["LLM Provider (OpenAI / Anthropic API)"]
        LangSmith["LangSmith Cloud (api.smith.langchain.com)"]
    end

    Gateway --> Compiler
    Gateway --> RuntimeControl
    Gateway --> CapPolicy
    Gateway --> RedisDB

    Compiler --> CapPolicy
    Compiler --> SupabaseLocal
    Compiler --> LLMAPI

    RuntimeControl --> RuntimeWorker
    RuntimeControl --> CapPolicy
    RuntimeControl --> SupabaseLocal
    RuntimeControl --> RedisDB

    RuntimeWorker --> MemorySvc
    RuntimeWorker --> CapPolicy
    RuntimeWorker --> LangSmith
    RuntimeWorker --> LLMAPI

    MemorySvc --> SupabaseLocal
    MemorySvc --> RedisDB

    CapPolicy --> SupabaseLocal
    CapPolicy --> RedisDB
    CapPolicy --> PayPalAPI
```
