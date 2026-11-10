# DelTix

> **Describe it. Generate it. Test it. Run it.**  
> **DelTix** is a financial-agent compiler and runtime platform that compiles natural-language descriptions into validated, policy-governed, executable AI agents running safely against PayPal Developer Sandbox.

---

## 1. Vision & Core Principles

Building reliable financial AI agents requires tool contracts, permission policies, memory persistence, human approvals, and execution tracing. Developers repeatedly hand-code this infrastructure for each agent.

**DelTix builds the infrastructure once.** Different agents use:
* The same Go compiler pipeline and capability registry.
* The same Go policy enforcement layer outside the LLM.
* The same Python LangGraph state machine execution engine.
* The same Redis distributed locking & deduplication layer.
* The same Supabase (PostgreSQL 16 + pgvector) transactional & semantic storage.
* The same validation test harness.
* The same typed PayPal Sandbox adapters.

### Core Principles
1. **Specification Before Logic:** Generate a reviewable `Agent IR` before generating execution logic.
2. **Capability Registry as Source of Truth:** Select approved tools from a concrete registry; never allow the model to invent payment APIs.
3. **Deterministic Safety:** The LLM proposes actions; deterministic Go policy controls enforce them.
4. **Test-Gated Readiness:** No agent executes until it passes synthetic positive, negative, and failure recovery tests.
5. **Safe Sandbox Execution:** All payments and refunds execute strictly against PayPal Developer Sandbox with `PayPal-Request-Id` idempotency keys.
6. **Resumable State Memory:** Execution states are snapshotted in Supabase, with Redis distributed locks preventing race conditions, enabling safe human-in-the-loop pauses without thread-locking or double-charging.

---

## 2. Core Technology Stack

| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Control Plane & Ingress** | **Go 1.23** | API Gateway, Agent Compiler, Capability Registry, Policy Guard, Run Controller. |
| **AI Agent Execution** | **Python 3.11 + LangGraph** | Stateful execution graph, conditional edge routing, node loops, human-in-the-loop interrupts. |
| **Semantic Memory** | **Python 3.11 + Mem0** | Long-term merchant preferences and case patterns (stored in Supabase pgvector). |
| **Fast In-Memory Layer** | **Redis 7** | Sub-millisecond deduplication, distributed redsync worker locking, rate limits, top-k cache. |
| **System of Record & Vectors**| **Supabase (PostgreSQL 16 + pgvector)** | ACID state machine, run checkpoints, audit trail, and semantic vector storage. |
| **Observability** | **LangSmith** | Distributed LLM call tracing, span latencies, and execution diagnostics. |
| **Payment Provider** | **PayPal Developer Sandbox** | Authoritative financial execution via typed, idempotent adapters. |

---

## 3. Four-Service Architecture

DelTix is architected into modular, decoupled services:

```text
Natural-Language Prompt
          │
          ▼
┌────────────────────────────────────────┐
│  1. Compiler Service (Go 1.23)         │
│  • Parses user intent & constraints    │
│  • Emits structured Agent IR           │
│  • Attaches PayPal capability toolkit  │
│  • Persists to Supabase agent_specs    │
└───────────────────┬────────────────────┘
                    │ Agent IR
                    ▼
┌────────────────────────────────────────┐
│  2. Config Service / Capability &      │
│     Policy Service (Go 1.23)           │
│  • Resolves capabilities in registry   │
│  • Validates policies outside LLM      │
│  • Enforces Redis idempotency keys     │
└───────────────────┬────────────────────┘
                    │ ExecutableConfig
                    ▼
┌────────────────────────────────────────┐
│  3. Validator Engine                   │
│  • Verifies schema & policy conflicts  │
│  • Generates synthetic test suite      │
│  • Runs positive / negative tests      │
└───────────────────┬────────────────────┘
                    │ ValidationReport (Passed)
                    ▼
           [ Developer Approval ]
                    │
                    ▼
┌────────────────────────────────────────┐
│  4. Runtime Service                    │
│  • Go Controller (Redsync locks)       │
│  • Python LangGraph Execution Worker   │
│  • Typed PayPal Sandbox adapters       │
│  • Supabase state checkpointing        │
│  • Human-in-the-loop approval pauses   │
│  • Immutable audit trail in Supabase   │
└────────────────────────────────────────┘
```

---

## 4. Frontend

* **Landing page:** [`frontend/landing/`](frontend/landing/) — static marketing page, sign-in wired to the API gateway. Run `python3 -m http.server 3000` from the repo root and open http://localhost:3000/frontend/landing/
* **Product manual & wireframes:** [`frontend/docs.md`](frontend/docs.md)

---

## 5. Documentation Index

The complete technical architecture documentation is located in [`docs/`](file:///d:/PayPal/DelTix/docs):

* **[Master System Architecture Document (HLD & LLD)](file:///d:/PayPal/DelTix/docs/system-architecture/system-architecture.md)**
* **[Five Parallel Workstreams Roadmap](file:///d:/PayPal/DelTix/docs/servers/README.md)**
* **Service Specifications:**
  * [`docs/servers/01-api-gateway.md`](file:///d:/PayPal/DelTix/docs/servers/01-api-gateway.md)
  * [`docs/servers/02-agent-compiler-service.md`](file:///d:/PayPal/DelTix/docs/servers/02-agent-compiler-service.md)
  * [`docs/servers/03-agent-runtime-service.md`](file:///d:/PayPal/DelTix/docs/servers/03-agent-runtime-service.md)
  * [`docs/servers/04-memory-service.md`](file:///d:/PayPal/DelTix/docs/servers/04-memory-service.md)
  * [`docs/servers/05-capability-and-policy-service.md`](file:///d:/PayPal/DelTix/docs/servers/05-capability-and-policy-service.md)
* **Mermaid Architecture Diagrams (Markdown):**
  * [`01-system-context.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/01-system-context.md)
  * [`02-container-architecture.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/02-container-architecture.md)
  * [`03-agent-compilation-pipeline.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/03-agent-compilation-pipeline.md)
  * [`04-agent-execution-lifecycle.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/04-agent-execution-lifecycle.md)
  * [`05-agent-ir-structure.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/05-agent-ir-structure.md)
  * [`06-memory-architecture.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/06-memory-architecture.md)
  * [`07-paypal-integration-flow.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/07-paypal-integration-flow.md)
  * [`08-approval-and-policy-flow.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/08-approval-and-policy-flow.md)
  * [`09-service-interaction.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/09-service-interaction.md)
  * [`10-deployment-architecture.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/10-deployment-architecture.md)
  * [`11-failure-and-recovery-flow.md`](file:///d:/PayPal/DelTix/docs/system-architecture/diagrams/11-failure-and-recovery-flow.md)
