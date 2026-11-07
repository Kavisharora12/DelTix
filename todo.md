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
  - All 10 core tables (`tenants`, `users`, `capability_registry`, `agent_specs`, `agent_compilation_logs`, `agent_runs`, `agent_run_checkpoints`, `action_intents`, `approval_requests`, `audit_events`, `mem0_memories`)
  - Monotonic `seq_id BIGSERIAL` and composite B-Tree indexes for fast cursor/offset queries (zero fake/seed data)
- [x] **Shared Domain Models** (`backend/shared/models/models.go`)
  - Go structs for `Tenant`, `User`, `AgentSpec`, `AgentRun`, `RunCheckpoint`, `ActionIntent`, `ApprovalRequest`, `AuditEvent`, `CapabilityContract`
- [x] **Agent IR v1.0 Specification Structs & Validation** (`backend/shared/models/agent_ir.go`)
  - Go structs and deterministic structural validators for `AgentIR`, `NodeDefinition`, `TransitionEdge`, `PolicyConfig`, `MemoryConfig`, `ExecutionLimits`
- [ ] **Shared Unit Tests** (`backend/shared/auth/*_test.go`, `backend/shared/models/*_test.go`)

---

## 3. Workstream 1 — API Gateway (`backend/api-gateway/`)
- [ ] Gateway Config (`config/config.go`)
- [ ] Session Auth & Tenant Injection Middleware (`middleware/auth_middleware.go`)
- [ ] Redis Token-Bucket Rate Limiting Middleware (`middleware/ratelimit_middleware.go`)
- [ ] Google OAuth Login, Callback, Logout & Session Handlers (`handlers/gateway_handler.go`)
- [ ] Reverse Proxy Service & SSE Live Execution Stream Hub (`services/proxy_service.go`)
- [ ] Gateway Routes & Server Entrypoint (`routes/routes.go`, `cmd/main.go`)
- [ ] Gateway Unit & Integration Tests (`tests/gateway_test.go`)

---

## 4. Workstream 2 — Agent Compiler Service (`backend/agent-compiler-service/`)
- [ ] Compiler Config (`config/config.go`)
- [ ] Compiler Request/Response & Clarification Models (`models/compiler_models.go`)
- [ ] Deterministic Schema & Tarjan DFS Graph Topology Validator (`services/validator_service.go`)
- [ ] LLM Requirement Extraction, Clarification & Agent IR Synthesis (`services/compiler_service.go`)
- [ ] Synthetic Test Generator & Pre-Flight Mock Harness (`services/validator_service.go`)
- [ ] Supabase Spec & Compilation Log Repository (`services/compiler_service.go`)
- [ ] Compiler HTTP Handlers, Routes & Entrypoint (`handlers/compiler_handler.go`, `routes/routes.go`, `cmd/main.go`)
- [ ] Compiler Unit & Table-Driven Validation Tests (`tests/compiler_test.go`)

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
- [ ] Natural Language Prompt & Clarification UI
- [ ] Compiled `Agent IR` & Validation Test Scorecard Viewer
- [ ] Live Execution Timeline (SSE) & Human Approval Modal
