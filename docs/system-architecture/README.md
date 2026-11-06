# DelTix — System Architecture Documentation Vault

Welcome to the central system architecture documentation for **DelTix**.

**DelTix** is an AI Agent Compiler and Runtime Platform focused on PayPal-powered financial agents. It enables users to describe financial tasks in natural language and generates configured, validated, policy-governed executable agents running safely against the PayPal Developer Sandbox.

---

## 1. Primary Documents

* **[Master System Architecture Document (HLD & LLD)](./system-architecture.md):** The comprehensive technical architecture document covering high-level platform topology, low-level component designs, Agent IR specification, state machines, memory tiers, security, and trade-offs.

---

## 2. Core Technology Stack

| Domain | Selected Technology | Architectural Responsibility |
| :--- | :--- | :--- |
| **Control Plane & Ingress** | **Go 1.23** | High-concurrency API Gateway, Compiler validation, Capability catalog, and Policy Guard. |
| **AI Agent Runtime** | **Python 3.11 + LangGraph** | Stateful execution graph, conditional edge routing, node loops, and human-in-the-loop interruption. |
| **Semantic Memory** | **Python + Mem0** | Long-term merchant preferences and case pattern extraction. |
| **Distributed Cache & Locks**| **Redis 7** | Sub-millisecond deduplication, distributed redsync worker locking, and rate limiting. |
| **System of Record & Vectors**| **Supabase (PostgreSQL 16 + pgvector)** | ACID transaction state machine, run checkpoints, audit trail, and semantic vector storage. |
| **Observability** | **LangSmith** | Distributed LLM call tracing, span latencies, and execution diagnostics. |
| **Payment Provider** | **PayPal Developer Sandbox** | Authoritative financial execution via typed, idempotent adapters. |

---

## 3. Architecture Diagrams Index

All architecture diagrams are authored in GitHub-compatible Mermaid markdown (`.md`) format and stored in the [`diagrams/`](./diagrams/) directory:

| Diagram | Filename | Scope & Description |
| :--- | :--- | :--- |
| **01. System Context** | [`diagrams/01-system-context.md`](./diagrams/01-system-context.md) | High-level interactions between Users, DelTix, PayPal Sandbox, LLM Providers, and LangSmith. |
| **02. Container Architecture** | [`diagrams/02-container-architecture.md`](./diagrams/02-container-architecture.md) | Service container layout across the 5 microservices, Redis, Supabase, and external integrations. |
| **03. Agent Compilation Pipeline** | [`diagrams/03-agent-compilation-pipeline.md`](./diagrams/03-agent-compilation-pipeline.md) | The 9-stage compilation pipeline from natural-language input to validated Agent IR. |
| **04. Agent Execution Lifecycle** | [`diagrams/04-agent-execution-lifecycle.md`](./diagrams/04-agent-execution-lifecycle.md) | State machine lifecycle: node transitions, loops, human-in-the-loop pauses, resumption, and completion. |
| **05. Agent IR Structure** | [`diagrams/05-agent-ir-structure.md`](./diagrams/05-agent-ir-structure.md) | Class and entity relationships defining our custom Agent Intermediate Representation (IR). |
| **06. Memory Architecture** | [`diagrams/06-memory-architecture.md`](./diagrams/06-memory-architecture.md) | Separation of LangGraph active state, Redis cache, Supabase operational state, and Mem0 semantic memory. |
| **07. PayPal Integration Flow** | [`diagrams/07-paypal-integration-flow.md`](./diagrams/07-paypal-integration-flow.md) | Controlled capability invocation, policy gate check, Redis idempotency management, and PayPal Sandbox calls. |
| **08. Approval & Policy Flow** | [`diagrams/08-approval-and-policy-flow.md`](./diagrams/08-approval-and-policy-flow.md) | Human-in-the-loop suspension, token generation, operator decision, and state machine resumption. |
| **09. Service Interaction Topology** | [`diagrams/09-service-interaction.md`](./diagrams/09-service-interaction.md) | Ownership boundaries and synchronous/asynchronous protocols between the five services. |
| **10. Deployment Architecture** | [`diagrams/10-deployment-architecture.md`](./diagrams/10-deployment-architecture.md) | Local Docker-based container deployment, port bindings, networks, and environment variables. |
| **11. Failure & Recovery Flow** | [`diagrams/11-failure-and-recovery-flow.md`](./diagrams/11-failure-and-recovery-flow.md) | Safe retries, checkpoint restores, mutation verification before retry, and crash recovery. |
