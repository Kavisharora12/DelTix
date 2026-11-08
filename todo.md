# DelTix — Team Implementation Tracker (`todo.md`)

**Project:** DelTix — Financial AI Agent Compiler & Runtime Platform  
**Last Updated:** 2026-11-07

---

## 1. Architecture & Documentation
- [x] Master System Architecture Document (HLD & LLD) (`docs/system-architecture/system-architecture.md`)
- [x] 11 Left-to-Right (`LR`) Mermaid Architecture Diagrams (`docs/system-architecture/diagrams/*.md`)
- [x] 5 Microservice Technical Specifications & Workstream Assignments (`docs/servers/*.md`)
- [x] Microservices Workspace & Directory Scaffolding (`backend/`, `frontend/`, `.gitkeep`)

---

## 2. Shared Infrastructure (`backend/shared/`)
- [x] **Go Module Initialized** (`backend/shared/go.mod` — `github.com/deltix/shared`)
- [x] **Configuration Loader** (`backend/shared/config/config.go`)
  - Supabase PostgreSQL Pooler config, Upstash Redis config, Google OAuth config
- [x] **Supabase PostgreSQL Pooler & Migrator** (`backend/shared/database/postgres.go`)
  - Direct & Transaction Pooler (`SimpleProtocol`) support, transactional migration runner, indexed `PageQuery` helper
- [x] **Upstash Redis Connection** (`backend/shared/database/redis.go`)
  - `rediss://` TLS URL parser, connection verification, timeout configuration
- [x] **Google OAuth & Redis Session Store** (`backend/shared/auth/jwt.go`)
  - One-time CSRF state tokens in Redis, Google OAuth code exchange, Redis session CRUD & revocation
- [x] **Tenant & Session Context** (`backend/shared/auth/tenant.go`)
  - Request-scoped `UserSession` and `TenantID` context propagation
- [x] **Single-Database SQL Schema Migration** (`backend/shared/migrations/001_initial_schema.sql`)
  - Pure ACID relational & financial tables (`tenants`, `users`, `capability_registry`, `agent_specs`, `agent_compilation_logs`, `agent_runs`, `agent_run_checkpoints`, `action_intents`, `approval_requests`, `audit_events`)
  - Upstash Redis used strictly for tiny primitives (sessions, CSRF state, rate-limits, locks, idempotency); long-term semantic memory lives in Mem0 (`memory-service`)
  - Monotonic `seq_id BIGSERIAL` and composite B-Tree indexes for fast cursor/offset queries (zero fake/seed data)
- [x] **Shared Domain Models** (`backend/shared/models/models.go`)
  - Go structs for `Tenant`, `User`, `AgentSpec`, `AgentRun`, `RunCheckpoint`, `ActionIntent`, `ApprovalRequest`, `AuditEvent`, `CapabilityContract`
- [x] **Agent IR v1.0 Specification Structs & Validation** (`backend/shared/models/agent_ir.go`)
  - Go structs and deterministic structural validators for `AgentIR`, `NodeDefinition`, `TransitionEdge`, `PolicyConfig`, `MemoryConfig`, `ExecutionLimits`
- [ ] **Shared Unit Tests** (`backend/shared/auth/*_test.go`, `backend/shared/models/*_test.go`)

---

## 3. Workstream 1 — API Gateway (`backend/api-gateway/`)
- [x] **Go Module Initialized** (`backend/api-gateway/go.mod` — `github.com/deltix/api-gateway` with `replace github.com/deltix/shared => ../shared`)
- [x] **Gateway Config** (`config/config.go`)
- [x] **Session Auth & Tenant Injection Middleware** (`middleware/auth_middleware.go`)
- [x] **Redis Token-Bucket Rate Limiting Middleware** (`middleware/ratelimit_middleware.go`)
- [x] **Google OAuth Login, Callback, Logout & Session Handlers** (`handlers/gateway_handler.go`)
  - Live: `GET /healthz`, `GET /v1/auth/google/login`, `GET /v1/auth/google/callback`, `GET /v1/auth/me`, `POST /v1/auth/logout`
  - Persists authenticated `tenants` & `users` to Supabase PostgreSQL and sessions to Upstash Redis
- [x] **Reverse Proxy Service & SSE Live Execution Stream Hub** (`services/proxy_service.go`)
- [x] **Gateway Routes & Server Entrypoint** (`routes/routes.go`, `cmd/main.go`)
- [x] **Gateway Unit & Integration Tests** (`tests/gateway_test.go`)
- [ ] **Pending Downstream Proxy Wiring (`TODO` in `routes/routes.go` & `services/proxy_service.go`):**
  - [x] Wire `/v1/agents/compile` and `/v1/agents/specs*` to Workstream 2 (`agent-compiler-service`)
  - [ ] Wire `/v1/runs*` and `/v1/runs/{run_id}/stream` (SSE) once Workstream 3 (`agent-runtime-service`) is ready
  - [ ] Wire `/v1/capabilities` and `/v1/approvals/{approval_id}/decide` once Workstream 5 (`capability-policy-service`) is ready

---

## 4. Workstream 2 — Agent Compiler Service (`backend/agent-compiler-service/`)
- [x] **Go Module** (`backend/agent-compiler-service/go.mod` — `github.com/deltix/agent-compiler-service`)
- [x] **Compiler Config** (`config/config.go`)
- [x] **Compiler Request/Response & Clarification Models** (`models/compiler_models.go`)
- [x] **Deterministic Schema, Tarjan/DFS Graph Topology Validator & Pre-Flight Mock Test Harness** (`services/validator_service.go`)
- [x] **LLM Requirement Extraction, Clarification, Agent IR Synthesis, HMAC Signer & Supabase Repository** (`services/compiler_service.go`)
- [x] **Compiler HTTP Handlers, Routes & Entrypoint** (`handlers/compiler_handler.go`, `routes/routes.go`, `cmd/main.go`)
- [x] **Compiler Unit & Table-Driven Validation Tests** (`tests/compiler_test.go`)

---

## 5. Workstream 5 — Capability & Policy Service (`backend/capability-policy-service/`)
- [ ] Capability & Policy Config (`config/config.go`)
- [ ] Capability, Policy & Approval Models (`models/capability_models.go`)
- [ ] Dynamic Capability Registry & Contract Validator (`services/capability_service.go`)
- [ ] Deterministic Policy Engine: Read-Only Guard, Spend Cap & Approval Gatekeeper (`services/policy_service.go`)
- [ ] Circuit Breaker (`sony/gobreaker`) & Reconcile-Before-Retry Guard (`adapters/circuit_breaker.go`)
- [ ] Live PayPal Developer Sandbox OAuth2 & REST Adapters (`adapters/paypal_adapter.go`)
- [ ] Action Intent Persistence & Append-Only Audit Logger (`services/capability_service.go`)
- [ ] Capability & Approval HTTP Handlers, Routes & Entrypoint (`handlers/`, `routes/`, `cmd/main.go`)
- [ ] Policy, Idempotency & Adapter Unit Tests (`tests/capability_test.go`)

---

## 6. Workstream 3 — Agent Runtime Service (`backend/agent-runtime-service/`)
- [ ] Go Control Plane Config & Models (`config/config.go`, `models/runtime_models.go`)
- [ ] Supabase Run & Checkpoint Repository (`services/checkpoint_service.go`)
- [ ] Redsync Distributed Run Lock, Readiness Token Verifier & Internal HTTP Worker Client (`services/runtime_service.go`)
- [ ] Human-in-the-Loop Pause & Cryptographic Token Resumption (`services/runtime_service.go`)
- [ ] Go Runtime Handlers, Routes & Entrypoint (`handlers/runtime_handler.go`, `routes/routes.go`, `cmd/main.go`)
- [ ] Python LangGraph Worker Config & FastAPI HTTP Bridge (`worker/config/config.py`, `worker/api/http_server.py`)
- [ ] Dynamic `Agent IR` ➡️ LangGraph `StateGraph` Builder (`worker/core/state_graph.py`)
- [ ] Node Executor & LangSmith Tracing Integration (`worker/services/executor_service.py`, `worker/main.py`)
- [ ] Go & Python Runtime Tests (`tests/runtime_test.go`, `worker/tests/test_worker.py`)

---

## 7. Workstream 4 — Memory Service (`backend/memory-service/`)
- [ ] Memory Service Config & Pydantic Schemas (`config/config.py`, `models/memory_models.py`)
- [ ] Mem0 + Supabase `pgvector` Scoped Storage & Redis Top-K Cache (`services/memory_service.py`)
- [ ] PII Redaction & Stale Memory Pruning (`services/memory_service.py`)
- [ ] FastAPI Handlers, Routes & Entrypoint (`api/handlers.py`, `routes/routes.py`, `main.py`)
- [ ] Multi-Tenant Isolation & Retrieval Tests (`tests/test_memory.py`)

---

## 8. Frontend Dashboard (`frontend/`)
- [x] **Frontend Content & Component Specifications for Current Built Scope** (`frontend/README.md`, `frontend/01-landing-and-auth.md`, `frontend/02-agent-compiler-studio.md`, `frontend/03-agent-specs-library.md`)
- [ ] Natural Language Prompt & Clarification UI Implementation
- [ ] Compiled `Agent IR` & Validation Test Scorecard Viewer Implementation
- [ ] Live Execution Timeline (SSE) & Human Approval Modal Implementation *(Pending Workstreams 3 & 5)*
