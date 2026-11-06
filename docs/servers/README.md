# DelTix — Server Documentation & Parallel Workstreams

This directory contains the detailed engineering specifications for each of the five microservices comprising the **DelTix** platform.

---

## 1. Five Parallel Workstreams

To maximize development velocity across a team of five contributors, ownership is split into five distinct workstreams. Each workstream lead owns one service end-to-end, bounded by strict, versioned API contracts.

| Workstream | Primary Service Ownership | Implementation Language | Lead Scope |
| :--- | :--- | :--- | :--- |
| **Workstream 1** | **API Gateway** | **Go 1.23** | Client ingress, JWT authentication, Redis-backed rate limiting, SSE streaming hub, error normalization. |
| **Workstream 2** | **Agent Compiler Service** | **Go 1.23** | Requirement extraction, Agent IR schema & graph validation, test generator, Supabase spec persistence. |
| **Workstream 3** | **Agent Runtime Service** | **Go 1.23 (Control Plane) + Python 3.11 (LangGraph)** | LangGraph execution bridge, Supabase state checkpointing, Redis distributed locking, human-in-the-loop interruption. |
| **Workstream 4** | **Memory Service** | **Python 3.11 / FastAPI (Mem0)** | Mem0 long-term memory integration, Supabase `pgvector` embedding search, Redis top-k cache, tenant isolation. |
| **Workstream 5** | **Capability & Policy Service** | **Go 1.23** | PayPal Sandbox adapters, Capability Registry, deterministic policy engine, Redis idempotency keys, Supabase audit trail. |

---

## 2. Infrastructure & Storage Ownership

* **Redis 7:** Owned collectively across Workstreams 1, 3, 4, and 5:
  * Workstream 1: Token bucket rate limiting keys (`ratelimit:tenant_id`).
  * Workstream 3: Distributed redsync run mutexes (`lock:run_id`).
  * Workstream 4: Top-k memory query cache (`memcache:query_hash`).
  * Workstream 5: Idempotency deduplication keys (`idempotency:run_id:step_idx`).
* **Supabase (PostgreSQL 16 + pgvector):** System of record across all services:
  * Workstream 2: `agent_specs`, `agent_compilation_logs`.
  * Workstream 3: `agent_runs`, `agent_run_checkpoints`.
  * Workstream 4: `mem0_memories` (vector cosine index).
  * Workstream 5: `capability_registry`, `approval_requests`, `audit_events`.

---

## 3. Workstream Details & Coordination

### Workstream 1: API Gateway
* **Main Responsibility:** Central ingress router, authentication, tenant context injection, and real-time SSE streaming for live agent traces.
* **Deliverables:** Go HTTP gateway service, JWT auth middleware, reverse proxy handlers, Redis rate limiter, API documentation.
* **Dependencies:** Depends on Service 2 (Compiler) and Service 3 (Runtime) API contracts.
* **Specification File:** [`01-api-gateway.md`](./01-api-gateway.md)

### Workstream 2: Agent Compiler Service
* **Main Responsibility:** Parsing natural language into validated `Agent IR`, topology analysis, capability verification, and synthetic test generation.
* **Deliverables:** Structured extraction prompts, `agent_ir_v1.json` JSON schema, Go graph validator, synthetic test runner, Supabase spec persister.
* **Dependencies:** Queries Service 5 for capability resolution and policy constraints.
* **Specification File:** [`02-agent-compiler-service.md`](./02-agent-compiler-service.md)

### Workstream 3: Agent Runtime Service
* **Main Responsibility:** Stateful graph execution, LangGraph state engine coordination, Supabase checkpointing, Redis redsync locking, and human-in-the-loop pauses.
* **Deliverables:** Go runtime control server, Python LangGraph execution worker, internal HTTP bridge, checkpoint manager.
* **Dependencies:** Calls Service 4 (Memory) for semantic context; calls Service 5 (Capability) for tool execution; writes to Supabase.
* **Specification File:** [`03-agent-runtime-service.md`](./03-agent-runtime-service.md)

### Workstream 4: Memory Service
* **Main Responsibility:** Mem0 integration for long-term semantic memory, merchant preferences, and historical case context.
* **Deliverables:** FastAPI microservice, Mem0 wrapper, Supabase `pgvector` queries, Redis top-k cache, memory invalidation engine.
* **Dependencies:** Independent service; accessed by Service 3 (Runtime).
* **Specification File:** [`04-memory-service.md`](./04-memory-service.md)

### Workstream 5: Capability & Policy Service
* **Main Responsibility:** Source-of-truth Capability Registry, PayPal Sandbox adapters, deterministic Go policy enforcement, Redis idempotency keys, approval token management, and Supabase audit logs.
* **Deliverables:** Go capability registry catalog, typed PayPal REST adapters (Orders, Captures, Refunds, Transactions), policy evaluation engine, audit logger.
* **Dependencies:** Integrates with PayPal Sandbox API, Redis, and Supabase.
* **Specification File:** [`05-capability-and-policy-service.md`](./05-capability-and-policy-service.md)

---

## 4. Shared Inter-Service API Contracts

To ensure non-blocking parallel execution, the following API contracts are frozen across all workstreams:

1. **`POST /v1/capabilities/resolve`** (Service 2 -> Service 5): Validates list of capability IDs.
2. **`POST /v1/capabilities/execute`** (Service 3 -> Service 5): Dispatches tool execution with policy & Redis idempotency checks.
3. **`POST /v1/memory/retrieve`** (Service 3 -> Service 4): Fetches top-k semantic memories from Supabase pgvector / Redis.
4. **`POST /v1/runs/{run_id}/resume`** (Service 1 / Service 5 -> Service 3): Resumes suspended execution with verified approval token.
