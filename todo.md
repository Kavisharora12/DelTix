# DelTix — Team Implementation Tracker (`todo.md`)

**Project:** DelTix — Financial AI Agent Compiler & Runtime Platform  
**Last Updated:** 2026-11-09

---

## 1. Architecture & Documentation
- [x] Master System Architecture Document (HLD & LLD) (`docs/system-architecture/system-architecture.md`)
- [x] 11 Left-to-Right (`LR`) Mermaid Architecture Diagrams (`docs/system-architecture/diagrams/*.md`)
- [x] 5 Microservice Technical Specifications & Workstream Assignments (`docs/servers/*.md`)
- [x] Microservices Workspace & Directory Scaffolding (`backend/`, `frontend/`, `.gitkeep`)
- [x] Unified Environment Configuration (`.env.example` and gitignored `.env` with automatic loader)

---

## 2. Shared Infrastructure (`backend/shared/`)
- [x] **Go Module Initialized** (`backend/shared/go.mod` — `github.com/deltix/shared`)
- [x] **Configuration Loader** (`backend/shared/config/config.go`)
  - Supabase PostgreSQL Pooler config, Upstash Redis config, Google OAuth config, automatic `.env` file loader
- [x] **Supabase PostgreSQL Pooler & Migrator** (`backend/shared/database/postgres.go`)
  - Direct & Transaction Pooler (`SimpleProtocol`) support, transactional migration runner, indexed `PageQuery` helper
- [x] **Upstash Redis Connection** (`backend/shared/database/redis.go`)
  - `rediss://` TLS URL parser, connection verification, timeout configuration
- [x] **Google OAuth & Redis Session Store** (`backend/shared/auth/jwt.go`)
  - One-time CSRF state tokens in Redis, Google OAuth code exchange, Redis session CRUD & revocation
- [x] **Tenant & Session Context** (`backend/shared/auth/tenant.go`)
  - Request-scoped `UserSession` and `TenantID` context propagation
- [x] **Single-Database Relational Schema Migration** (`backend/shared/migrations/001_initial_schema.sql`)
  - Pure ACID relational & financial tables (`tenants`, `users`, `capability_registry`, `agent_specs`, `agent_compilation_logs`, `agent_runs`, `agent_run_checkpoints`, `action_intents`, `approval_requests`, `audit_events`)
  - Dynamic `http_method` and `endpoint_path` added to `capability_registry` (zero hardcoded capability routes in Go)
  - Upstash Redis used strictly for tiny primitives (sessions, CSRF state, rate-limits, locks, idempotency); long-term semantic memory lives in Mem0 / separate RAG store
  - Monotonic `seq_id BIGSERIAL` and composite B-Tree indexes for fast cursor/offset queries (zero fake/seed data)
- [x] **Shared Domain Models** (`backend/shared/models/models.go`)
  - Go structs for `Tenant`, `User`, `AgentSpec`, `AgentRun`, `RunCheckpoint`, `ActionIntent`, `ApprovalRequest`, `AuditEvent`, `CapabilityContract`
- [x] **Agent IR v1.0 Specification Structs & Validation** (`backend/shared/models/agent_ir.go`)
  - Go structs and deterministic structural validators for `AgentIR`, `NodeDefinition`, `TransitionEdge`, `PolicyConfig`, `MemoryConfig`, `ExecutionLimits`
  - Added `DETERMINISTIC_MATH` and `GROUNDING_VERIFIER` node types + `is_mutation` on `CapabilityRef`
- [ ] **Shared Unit Tests** (`backend/shared/auth/*_test.go`, `backend/shared/models/*_test.go`)

---

## 3. Workstream 1 — API Gateway (`backend/api-gateway/`, Port 8080)
- [x] **Go Module Initialized** (`backend/api-gateway/go.mod` — `github.com/deltix/api-gateway` with `replace github.com/deltix/shared => ../shared`)
- [x] **Gateway Config** (`config/config.go`)
- [x] **Session Auth & Tenant Injection Middleware** (`middleware/auth_middleware.go`)
- [x] **Redis Token-Bucket Rate Limiting Middleware** (`middleware/ratelimit_middleware.go`)
- [x] **Google OAuth Login, Callback, Logout & Session Handlers** (`handlers/gateway_handler.go`)
  - Live: `GET /healthz`, `GET /v1/auth/google/login`, `GET /v1/auth/google/callback`, `GET /v1/auth/me`, `POST /v1/auth/logout`
  - Persists authenticated `tenants` & `users` to Supabase PostgreSQL and sessions to Upstash Redis
- [x] **Reverse Proxy Service & SSE Live Execution Stream Hub** (`services/proxy_service.go`)
- [x] **Gateway Routes & Server Entrypoint** (`routes/routes.go`, `cmd/main.go`)
  - [x] Wire `/v1/agents/compile` and `/v1/agents/specs*` to Workstream 2 (`agent-compiler-service`, `:8081`)
  - [x] Wire `/v1/runs*` and `/v1/runs/{run_id}/stream` (SSE) to Workstream 3 (`agent-runtime-service`, `:8082`)
  - [x] Wire `/v1/capabilities` and `/v1/approvals/{approval_id}/decide` to Workstream 5 (`capability-policy-service`, `:8084`)
- [x] **Gateway Unit & Integration Tests** (`tests/gateway_test.go` — Passing)

---

## 4. Workstream 2 — Agent Compiler Service (`backend/agent-compiler-service/`, Port 8081)
- [x] **Go Module** (`backend/agent-compiler-service/go.mod` — `github.com/deltix/agent-compiler-service`)
- [x] **Compiler Config** (`config/config.go` — `GEMINI_API_KEY`, multi-model list, sliding-window RPM config)
- [x] **Compiler Request/Response & Clarification Models** (`models/compiler_models.go`)
- [x] **Deterministic Schema, Tarjan/DFS Graph Topology Validator & Pre-Flight Mock Test Harness** (`services/validator_service.go`)
- [x] **Gemini Multi-Model Fallback Cascade + Sliding-Window Rate Limiter, HMAC Signer & Supabase Repository** (`services/compiler_service.go`)
- [x] **Compiler HTTP Handlers, Routes & Entrypoint** (`handlers/compiler_handler.go`, `routes/routes.go`, `cmd/main.go`)
- [x] **Compiler Unit & Table-Driven Validation Tests** (`tests/compiler_test.go` — Passing)

---

## 5. Workstream 3 — Agent Runtime Service (`backend/agent-runtime-service/`, Ports 8082 & 8085)
- [x] **Python LangGraph Worker Setup** (`worker/requirements.txt`, `worker/config/config.py`, `worker/api/grpc_server.py`, `worker/main.py`)
- [x] **Dynamic `Agent IR` ➡️ LangGraph `StateGraph` Builder & Non-Blocking Approval Interrupts** (`worker/core/state_graph.py`)
  - [x] Dynamic `is_mutation` check (no hardcoded tool name tuples)
  - [x] Zero-hallucination `DETERMINISTIC_MATH` node (safe Python AST Decimal arithmetic, no LLM math)
  - [x] Zero-hallucination `GROUNDING_VERIFIER` node (verbatim quote & chunk citation verifier, fail-closed escalation)
- [x] **LangChain Gemini Sliding-Window Cascade, Safe AST Router & Tool Dispatcher** (`worker/services/executor_service.py`)
  - [x] Official `PayPalAgentToolkitDispatcher` integration (`paypal-agent-toolkit`) with least-privilege `Configuration.actions`
  - [x] Deterministic SHA-256 idempotency key generation (`compute_tool_idempotency_key`)
- [x] **Python LangGraph Worker Unit Tests** (`worker/tests/test_worker.py` — 7 tests passing)
- [x] **Go Control Plane Config & Models** (`config/config.go`, `models/runtime_models.go`) — *Phase 2*
- [x] **Supabase Run & Checkpoint Repository** (`services/checkpoint_service.go`) — *Phase 2*
- [x] **Distributed Redis Run Lock, Readiness Token Verifier & Internal HTTP Worker Client** (`services/runtime_service.go`) — *Phase 2*
  - [x] Dynamic BFS DAG traversal from paused approval node to resolve target tool (no hardcoded capability strings)
- [x] **Human-in-the-Loop Pause, Cryptographic Token Resumption & SSE Stream Broadcaster** (`services/runtime_service.go`, `handlers/runtime_handler.go`) — *Phase 2*
- [x] **Go Runtime Handlers, Routes, Entrypoint & Tests** (`routes/routes.go`, `cmd/main.go`, `tests/runtime_test.go` — Passing) — *Phase 2*

---

## 6. Workstream 5 — Capability & Policy Service (`backend/capability-policy-service/`, Port 8084)
- [x] **Capability & Policy Config** (`config/config.go` — `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `APPROVAL_HMAC_SECRET`)
- [x] **Capability, Policy & Approval Models** (`models/capability_models.go`)
- [x] **Dynamic Capability Registry & Contract Validator** (`services/capability_service.go` — pure database registry, zero hardcoded bootstrap arrays)
- [x] **Deterministic Policy Engine: Spend Cap, Approval Gatekeeper & HMAC Token Signer** (`services/policy_service.go`)
- [x] **Circuit Breaker & Retry Guard** (`adapters/circuit_breaker.go`)
- [x] **Dynamic PayPal REST Sandbox Adapter** (`adapters/paypal_adapter.go`)
  - [x] Dynamic URL path interpolation (`{capture_id}`, `{order_id}`) driven by `capability_registry`
  - [x] Fail-closed authentication (zero fake/mock fallbacks when credentials are unconfigured or calls fail)
  - [x] `PayPal-Request-Id` idempotency header forwarding
- [x] **Action Intent Persistence & Append-Only Audit Logger** (`services/capability_service.go`)
- [x] **Capability & Approval HTTP Handlers, Routes & Entrypoint** (`handlers/`, `routes/`, `cmd/main.go`)
- [x] **Policy, Idempotency & Adapter Unit Tests** (`tests/capability_test.go` — Passing)

---

## 7. Workstream 4 — Memory Service (`backend/memory-service/`, Port 8083)
- [x] **Structure-Aware Financial Chunker** (`services/memory_service.py`)
  - Heading hierarchy detector (`H1 > H2 > H3`), table parameter extractor (duplicated headers), boundary detector, PII sanitizer
- [x] **Separate `pgvector` RAG Schema** (`backend/shared/migrations/002_pgvector_rag_schema.sql`)
  - Isolated `rag_vector` schema (`rag_vector.documents`, `rag_vector.document_chunks`) with 768-dim vectors for Gemini `text-embedding-004`
  - Automatic `SUPABASE_DB_URL` and `RAG_VECTOR_DB_URL` connection string parser (port 6543 pooler / port 5432 direct)
- [x] **Real Supabase Hybrid Vector & Mem0 Storage with Google Gemini** (`services/memory_service.py`, `config/config.py`)
  - Google Gemini embeddings (`models/text-embedding-004`, 768 dims) & LLM extraction (`gemini-2.0-flash`) with optional OpenAI fallback
  - Redis tenant cache invalidation with `UPSTASH_REDIS_URL` support
- [x] **FastAPI Handlers, Dual Routes & Entrypoint** (`api/handlers.py`, `routes/routes.py`, `main.py`)
  - Dual path aliases (`/internal/v1/memory/*` and `/internal/v1/memories/*`, `/retrieve` & `/search`, `/store` & `/add`)
- [x] **Multi-Tenant Isolation, Supabase URL & Gemini Retrieval Tests** (`tests/test_memory.py` — Passing)

---

## 8. Frontend Dashboard & Documentation Suite (`frontend/`)
- [x] **Master End-User Product Manual & Client UI Wireframes** (`frontend/docs.md`)
  - Complete screen-by-screen client walkthrough & wireframes: Landing Page, Dashboard, Compiler Studio, Sandbox Chatbot, Approval Modal, and Audit Ledger
  - Financial Prompt Contract, copy-paste prompt templates, interactive clarification drawer, and 4-step quick-start guide
- [x] **Frontend README Index** (`frontend/README.md`)

---

## 9. Startup Shipping & Remaining Scope
- [x] **Backend Infrastructure & All 5 Microservices:** 100% complete, fully unit-tested, zero mocks in production paths.
- [x] **Single Consolidated `.env`:** Root-only configuration driving all Go, Python, and Docker services.
- [x] **Isolated Database Migrations:** Pure ACID relational (`001_initial_schema.sql`) and pgvector RAG (`002_pgvector_rag_schema.sql`).
- [x] **Protobuf / gRPC Bridge Contract:** Defined in `runtime.proto` with dual Go client and Python servicer implementations.
- [x] **Docker Compose Production Bundle:**
  - Multi-stage Go & Python Dockerfiles with stripped binaries (~20MB Go images, slim wheel-extracted Python runners)
  - Zero hardcoded secrets: secure `env_file: - .env` resolution with internal Docker DNS service discovery
  - Isolated private bridge network (`deltix-network`), container healthchecks, and frontend excluded
  - Verified with `docker-compose config`
- [ ] **React / Next.js Frontend Implementation:** Scaffolding the UI components specified in `frontend/docs.md`.
- [ ] **End-to-End Real Testing Suite:** Full real-world integration verification across all live endpoints.
