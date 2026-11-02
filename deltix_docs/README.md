# DELTIX — Engineering Documentation

**Project:** DELTIX  
**Purpose:** Intelligent incident investigation and policy-controlled recovery for distributed payment systems.  
**Initial domain:** Real payment workflows using PayPal Sandbox (via webhooks and the official PayPal Agent Toolkit), plus internal merchant order states.  
**Architecture:** Microservices orchestrated via **Docker Swarm**  
**Core Services:**
- `deltix-ingestion` (Go) — Webhook ingestion, PayPal signature verification, Redis deduplication.
- `deltix-core` (Go) — Event correlation, detection rules, policy engine, action executor, audit log.
- `deltix-ai-agent` (Python / FastAPI) — Powered by the official `paypal-agent-toolkit`, Pydantic v2, LLM reasoning, pgvector memory layer.  
**Datastores:** PostgreSQL 16 (system-of-record + `pgvector` extension) & Redis 7 (deduplication cache, distributed locking).  
**Deployment:** Docker Swarm with overlay networking, secret management, and zero-downtime rolling updates.  
**Frontend:** Deliberately deferred until core APIs and workflows pass tests.

---

## Product Statement

DELTIX correlates events from payment providers (PayPal Sandbox) and internal services, reconstructs incident timelines, queries live authoritative payment state via the official PayPal Agent Toolkit, retrieves historical incident patterns via a vector memory layer, proposes evidence-backed remediation through an AI agent, and deterministically executes only permitted recovery actions with post-action verification and an immutable audit trail.

---

## Documentation Map

- `PROJECT_CONTEXT.md` — Complete unified project context and architectural summary in a single file.
- `architecture/` — System overview, data flow, domain model, data schema, API contracts, and Docker Swarm deployment.
  - `01-system-overview.md` — Microservices architecture and runtime flow.
  - `02-domain-model.md` — State machines and domain entities.
  - `03-data-model.md` — PostgreSQL schemas with indexed offsets and Redis data structures.
  - `04-api-contracts.md` — External and internal service API contracts.
  - `05-deployment-docker-swarm.md` — Docker Swarm production stack, resource quotas, and runbook.
- `memory/` — Dual-tier memory layer design (working memory + pgvector episodic memory).
- `services/` — Responsibilities, boundaries, and interfaces for each core component.

---

## Non-Negotiable Engineering Principles

1. **Authoritative Provider State First:** Authoritative payment provider state (PayPal Sandbox API via the official PayPal Agent Toolkit) must always be queried and confirmed before executing any recovery action that depends on payment status.
2. **Never Blindly Retry Money Operations:** Never repeat a money-moving or financial side-effect merely because an outbound request timed out. Reconcile with the provider first.
3. **LLM as Untrusted Input:** The AI model is strictly an analyst. It cannot authorize, execute tools, or grant permissions. All AI outputs undergo strict schema validation and deterministic policy evaluation.
4. **Deterministic Policy & Immutable Audit:** Every action must be evaluated by the Go policy engine against an allowlist and preconditions. Every state transition and decision is recorded in an append-only audit trail.
5. **Idempotent Ingestion:** Raw events are durably persisted to `source_events` before returning success. Redis and PostgreSQL constraints guarantee zero duplicate execution.
6. **Restart-Safe Recovery:** Workflow and action execution states are persisted transactionally; a crash never loses the state of an in-flight action or causes untracked re-execution.
7. **Unified Pipeline for Ops and Security:** Operational failures and security incidents share the correlation and evidence pipeline, but enforce distinct evidence requirements and recovery policies.
