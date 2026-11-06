# DelTix — Master System Architecture Document
**High-Level Design (HLD) & Low-Level Design (LLD)**

* **Document Version:** 1.0.0
* **Target Audience:** Principal Architects, Systems Engineers, Security Auditors, Workstream Leads
* **Status:** Final Architectural Specification (Pre-Implementation Baseline)
* **Project Name:** **DelTix**
* **Tagline:** *Describe it. Generate it. Test it. Run it.*

---

# Part A — High-Level Design (HLD)

## 1. Project Overview

**DelTix** is an AI Agent Compiler and Runtime Platform engineered specifically for PayPal-powered financial operations. 

Traditional AI agent development forces engineering teams to repeatedly implement custom tool wrappers, volatile prompt templates, brittle state management, unverified permissions, and ad-hoc error handling for every new agent. DelTix replaces this fragmented workflow with an **agent engineering platform**. 

Developers describe a financial task in natural language. DelTix parses requirements, synthesizes a strongly typed **Agent Intermediate Representation (Agent IR)**, validates graph integrity, resolves capabilities against a registered catalog, enforces deterministic policies, executes synthetic test scenarios, and runs the validated agent on a shared, stateful runtime powered by **Go**, **Python (LangGraph)**, **Mem0**, **Redis**, **Supabase (PostgreSQL 16 + pgvector)**, and the **PayPal Developer Sandbox**.

The system context is illustrated in [`diagrams/01-system-context.md`](./diagrams/01-system-context.md).

---

## 2. Problem Statement

Building production-grade AI agents in financial technology requires solving problems far beyond writing a prompt:
1. **Unbounded Execution & Hallucinated APIs:** Probabilistic LLMs invent endpoints, parameters, and execute arbitrary calls unless strictly bounded by deterministic schemas.
2. **Financial State Mutability & Double-Charging:** Retrying a timed-out network call without idempotency checks risks duplicate charges or multiple unauthorized refunds.
3. **Missing State & Brittle Resumption:** Financial workflows frequently require human authorization. Storing state in process memory prevents servers from rebooting or pausing cleanly while awaiting approvals.
4. **Unenforced Permissions Inside Prompts:** Prompts like *"Please do not issue refunds over $50"* can be bypassed via prompt injection. Permissions must be hardcoded outside the model in Go.
5. **No Standard Agent Specification:** Every agent is hand-coded as a bespoke microservice rather than compiled from a versioned, portable specification.

DelTix solves this by building the compiler and runtime infrastructure once, allowing diverse agents to be compiled, validated, and executed without writing custom backend code.

---

## 3. Product Goals and Non-Goals

### Product Goals
* **G1: Declarative Agent Specification:** Compile natural language into a versioned, reproducible Agent Intermediate Representation (`Agent IR v1.0`).
* **G2: Closed-World Capability Binding:** Resolve tools strictly against an immutable Capability Registry. Fictitious tools are rejected at compile time.
* **G3: Externalized Policy Enforcement:** Enforce spending caps, read-only constraints, and human-in-the-loop requirements in deterministic Go code outside the LLM.
* **G4: Test-Gated Agent Activation:** Prevent agent execution until positive, negative, and permission-breach synthetic tests pass.
* **G5: Resumable Execution Engine:** Execute agents on a Python LangGraph state machine supporting loops, conditional edges, interruptions for human approval, and zero-thread-loss pauses.
* **G6: Safe PayPal Sandbox Operations:** Provide typed, idempotent Go adapters for PayPal Sandbox (Orders, Captures, Refunds, Transactions).
* **G7: Low-Latency Distributed State:** Leverage Redis for sub-millisecond deduplication and redsync distributed locks, with Supabase as the ACID transactional source of truth.

### Product Non-Goals
* **NG1:** We are **not** building a general-purpose IDE or arbitrary code-execution sandbox.
* **NG2:** We are **not** building an autonomous live-money payment system. All transactions run on PayPal Sandbox.
* **NG3:** We are **not** training or fine-tuning foundation LLMs.
* **NG4:** We are **not** building a distributed workflow engine from scratch (we leverage LangGraph for state graph orchestration).
* **NG5:** We are **not** guaranteeing zero LLM hallucinations; we guarantee deterministic guardrails that prevent hallucinations from executing unauthorized actions.

---

## 4. Functional Requirements

* **FR1 (Natural Language Ingestion):** The system must accept free-form natural language and identify ambiguous or missing parameters (e.g. refund limits, human sign-off policies).
* **FR2 (Agent IR Synthesis & Validation):** The system must generate valid Agent IR, verify it against JSON Schema in Go, and validate graph topology (detect unreachable nodes, infinite cycles without exit, and dead ends).
* **FR3 (Capability Resolution):** The system must bind agent nodes to verified tools in the Capability Registry and reject unsupported capabilities.
* **FR4 (Deterministic Policy Checks):** The system must validate that proposed agent behaviors conform to tenant limits and mark sensitive nodes as approval-gated.
* **FR5 (Automated Synthetic Testing):** The compiler must generate and execute mock test suites (positive, negative, and fault-injection) before marking an agent as executable.
* **FR6 (Human-in-the-Loop Interruption):** The runtime must suspend execution when a sensitive capability is invoked, issue an approval request, persist state to Supabase, release Redis locks, and resume upon approval.
* **FR7 (PayPal Sandbox Integration):** The platform must execute typed operations against PayPal Sandbox using OAuth2 credentials and `PayPal-Request-Id` idempotency headers.
* **FR8 (Memory Retrieval & Persistence):** The system must use Mem0 for long-term semantic context and Supabase for transactional state and audit trails.

---

## 5. Non-Functional Requirements

* **NFR1 (Deterministic Safety):** 100% of capability invocations must pass deterministic authorization checks before network dispatch.
* **NFR2 (Execution Idempotency):** Every mutation call to PayPal must carry a cryptographically unique idempotency key registered in Redis and Supabase; duplicate executions must be rejected.
* **NFR3 (Resumability & Durability):** 100% of workflow step transitions must be checkpointed to Supabase. Zero in-flight runs may be lost on worker crash.
* **NFR4 (Auditability):** Every LLM prompt, capability input, capability output, policy check, and human approval must be recorded in an append-only Supabase audit table.
* **NFR5 (Tenant Isolation):** Strict multi-tenant data partitioning across Supabase PostgreSQL records and Mem0 vector namespaces.

---

## 6. System Architecture

DelTix is structured as a decoupled microservices architecture partitioned into an **Edge Tier**, a **Control Plane**, an **Execution Plane**, and a **Storage Tier**.

Refer to [`diagrams/02-container-architecture.md`](./diagrams/02-container-architecture.md) for the container layout.

```text
                                 [ Client Dashboard / API ]
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │   1. API Gateway   │
                                  │    (Go / 8080)     │
                                  └──────────┬─────────┘
                                             │
               ┌─────────────────────────────┼────────────────────────────┐
               │                             │                            │
               ▼                             ▼                            ▼
    ┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
    │ 2. Compiler Svc    │        │ 3. Runtime Svc     │        │ 5. Capability &    │
    │   (Go / 8081)      │◄──────►│ (Go Controller +   │◄──────►│    Policy Svc      │
    │                    │        │  Python LangGraph) │        │   (Go / 8084)      │
    └──────────┬─────────┘        └──────────┬─────────┘        └──────────┬─────────┘
               │                             │                             │
               │                             ▼                             │
               │                  ┌────────────────────┐                   │
               │                  │  4. Memory Svc     │                   │
               │                  │ (Python Mem0/8083) │                   │
               │                  └──────────┬─────────┘                   │
               │                             │                             │
               ▼                             ▼                             ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │          Redis 7 (In-Memory Deduplication, Redsync Locks, Rate Limits) │
    ├────────────────────────────────────────────────────────────────────────┤
    │          Supabase (PostgreSQL 16 + pgvector - System of Record)        │
    │  (agent_specs, agent_runs, checkpoints, audit_events, approvals)      │
    └────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Component Responsibilities

1. **API Gateway (Service 1 — Go):** Ingress controller, JWT authentication, tenant context injection, Redis-backed rate limiting, and Server-Sent Events (SSE) streaming proxy.
2. **Agent Compiler Service (Service 2 — Go):** Ingests natural-language prompts, manages clarification dialogs, generates and validates Agent IR, verifies graph topologies, and orchestrates synthetic test generation.
3. **Agent Runtime Service (Service 3 — Go Controller + Python LangGraph Worker):** Translates Agent IR into LangGraph execution graphs, manages step transitions, executes node handlers, acquires Redis distributed locks, persists step checkpoints to Supabase, pauses for human approval, and resumes execution.
4. **Memory Service (Service 4 — Python / FastAPI):** Interfaces with Mem0 and Supabase `pgvector` to manage semantic long-term memory, merchant preferences, and case context with strict tenant isolation.
5. **Capability and Policy Service (Service 5 — Go):** Maintains the Capability Registry, enforces deterministic policy limits, generates idempotency tokens in Redis, gates sensitive actions with approval tokens, and interfaces with PayPal Sandbox.

---

## 8. Service Boundaries

The boundary contracts between services are non-overlapping:

* **Compiler vs Runtime:** The Compiler emits static, versioned `Agent IR`. The Runtime never alters the IR; it only executes it.
* **Control Plane vs LangGraph Worker:** The Go runtime manages lifecycle, persistence, and external tool authorization; the Python LangGraph engine handles node-level state transitions and LLM agent loops.
* **Memory vs Operational State:** Mem0 manages semantic, unstructured text memory stored in Supabase `pgvector`. Supabase transactional tables store authoritative run state, monetary values, and audit logs. Mem0 is **never** queried for authoritative payment status.
* **Runtime vs PayPal:** The Runtime never calls PayPal directly. It requests tool execution via the Capability & Policy Service, which performs policy and idempotency checks before invoking PayPal.

The complete inter-service interaction model is defined in [`diagrams/09-service-interaction.md`](./diagrams/09-service-interaction.md).

---

## 9. External Integrations

| Provider | Purpose | Authentication | Protocol | Failure Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **PayPal Developer Sandbox** | Payment operations (Orders, Captures, Refunds, Transactions) | OAuth2 Client Credentials (Bearer Token) | HTTPS REST (`api-m.sandbox.paypal.com`) | Idempotent retries on 5xx; non-retryable on 4xx. |
| **Foundation LLM Provider** | Intent extraction, Agent IR generation, and node reasoning | API Key (Server-side environment) | HTTPS REST (JSON Schema / Tool Calling) | Exponential backoff on rate limits (429). |
| **LangSmith** | Distributed tracing, evaluation, and latency profiling | `LANGSMITH_API_KEY` | HTTPS REST (Asynchronous background exporter) | Non-blocking telemetry drop on failure. |

The PayPal integration sequence is documented in [`diagrams/07-paypal-integration-flow.md`](./diagrams/07-paypal-integration-flow.md).

---

## 10. Main Data Flows

### A. Agent Compilation Flow
1. User submits natural-language prompt via API Gateway.
2. Compiler Service invokes LLM with structured output to extract constraints and draft Agent IR.
3. Compiler deterministically validates JSON Schema and graph topology in Go.
4. Compiler queries Capability & Policy Service to resolve tool bindings.
5. Compiler queries Capability & Policy Service to validate policy limits.
6. Compiler generates synthetic test suite and executes test runs.
7. Compiler persists validated `Agent IR` to Supabase `agent_specs` and returns a readiness scorecard to the user.
*(Detailed in [`diagrams/03-agent-compilation-pipeline.md`](./diagrams/03-agent-compilation-pipeline.md))*

### B. Agent Execution & Approval Flow
1. User or external event triggers an agent run with runtime inputs.
2. Go Runtime Controller acquires a Redis `redsync` distributed lock for the `run_id`.
3. Go Runtime loads the compiled Agent IR from Supabase and passes it to the Python LangGraph Worker.
4. LangGraph executes nodes sequentially, querying Memory Service for relevant past patterns.
5. Upon reaching a sensitive tool (e.g. `paypal.refunds.create`), the Runtime Service requests permission from the Capability & Policy Service.
6. Policy engine detects `is_sensitive == true`, generates an `approval_request`, commits a checkpoint to Supabase, releases the Redis lock, and transitions run status to `PAUSED_FOR_APPROVAL`.
7. Operator approves the action via Dashboard.
8. Runtime Service re-acquires the Redis lock, resumes the graph from the exact checkpoint, and dispatches the idempotent tool call.
9. Output is returned, audit logs are appended to Supabase, and run status becomes `COMPLETED`.
*(Detailed in [`diagrams/04-agent-execution-lifecycle.md`](./diagrams/04-agent-execution-lifecycle.md) and [`diagrams/08-approval-and-policy-flow.md`](./diagrams/08-approval-and-policy-flow.md))*

---

## 11. Security Architecture

1. **Authentication & Tenant Isolation:** Every request to API Gateway requires a valid JWT containing `tenant_id` and `user_id`. Supabase rows enforce tenant boundaries via indexed foreign keys and Row Level Security (RLS).
2. **Externalized Policy Guard (Least Privilege):** The LLM cannot grant itself permissions. The Capability & Policy Service verifies every tool call against pre-compiled policy rules:
   * `max_budget_usd` enforcement.
   * `read_only` mode enforcement.
   * Mandatory human approval on mutation operations.
3. **Secret Isolation:** PayPal API credentials, LLM keys, and database passwords exist solely within the server environment. Zero credentials are sent to the client or exposed in prompts.
4. **Prompt Injection Mitigation:** System instructions and user-provided inputs are strictly separated in structured prompt templates. Tool outputs are treated as untrusted data and sanitized before re-injection into LLM context.
5. **Immutable Audit Trails:** All tool executions, policy decisions, and human approvals write append-only records to Supabase `audit_events` with SHA-256 payload digests.

---

## 12. Deployment Architecture

DelTix deploys locally and in testing environments using Docker and Docker Compose on an isolated bridge network (`deltix-net`). 

Refer to [`diagrams/10-deployment-architecture.md`](./diagrams/10-deployment-architecture.md) for container ports, volume bindings, and service dependencies.

---

## 13. Failure Handling & Recovery

* **Database Checkpointing:** Every node execution persists state to Supabase.
* **Safe Payment Retries:** Mutating payment operations are **never** blindly retried on network timeouts. The system invokes a read adapter (`paypal.orders.get` or `paypal.captures.get`) to verify whether the transaction completed before re-dispatching.
* **Process Crash Recovery:** On container reboot, the Go Runtime Service queries Supabase for runs stuck in `RUNNING` status and restores the last committed checkpoint.

The complete recovery workflow is documented in [`diagrams/11-failure-and-recovery-flow.md`](./diagrams/11-failure-and-recovery-flow.md).

---

## 14. Scalability Considerations

* **Stateless Go Control Plane:** Services 1, 2, and 5 are stateless Go microservices horizontally scalable behind round-robin load balancers.
* **Redis Caching & Mutexes:** Sub-millisecond deduplication prevents double-submissions. Distributed locks prevent concurrent conflicting worker executions on the same run.
* **Asynchronous LangGraph Execution:** Suspended approval runs do not hold worker threads or socket connections; state is serialized to Supabase JSONB.
* **Database Indexing:** Composite indexes on `(tenant_id, run_id)` and `(run_id, step_index)` in Supabase ensure sub-millisecond checkpoint hydration.

---

## 15. Architectural Decisions and Trade-Offs

| Decision | Alternative Considered | Selected Rationale & Trade-off |
| :--- | :--- | :--- |
| **Go for Core Services + Python for LangGraph** | Pure Python or Pure Go monorepo | **Selected:** Go provides typed concurrency, high-performance API routing, and robust policy enforcement. Python provides native LangGraph and Mem0 integration. **Trade-off:** Requires an internal HTTP bridge between Go runtime and Python worker. |
| **Supabase (PostgreSQL 16 + pgvector) as System of Record** | Separate Vector DB (Pinecone/Qdrant) + separate Postgres | **Selected:** Consolidates relational state machine, ACID checkpoints, and semantic vector storage in one unified platform with Supabase Realtime support. |
| **Redis for Distributed Locks & Deduplication** | DB-only row locks (`SELECT FOR UPDATE`) | **Selected:** Redis prevents database lock contention, handles high-throughput webhook deduplication, and provides sub-millisecond token-bucket rate limiting. |
| **Dedicated Agent IR vs Direct Python Code Generation** | Generating raw LangGraph Python code | **Selected:** Generating executable Python code via LLM creates massive security vulnerabilities and untestable flows. Compiling into structured JSON `Agent IR` guarantees schema validation, policy verification, and static analysis. |

---

# Part B — Low-Level Design (LLD)

## 1. Agent Intermediate Representation (Agent IR)

The Agent IR is the declarative specification representing a compiled agent. It is versioned, validated against JSON Schema in Go, and structured into modular blocks.

Refer to [`diagrams/05-agent-ir-structure.md`](./diagrams/05-agent-ir-structure.md) for structural entity relationships.

### Node Types
1. `LLM_REASONING`: Instructs the LLM to analyze inputs, cross-reference data, or formulate a conclusion using structured prompts (Python LangGraph).
2. `TOOL_EXECUTION`: Invokes a verified tool from the Capability Registry via the Go Capability & Policy Service.
3. `DETERMINISTIC_PROCESS`: Performs exact mathematical calculations, diffing, schema mapping, or filtering in Go without LLM variance.
4. `CONDITIONAL_ROUTER`: Evaluates boolean or enum conditions on current state to select the next branch edge.
5. `HUMAN_APPROVAL`: Halts execution, generates an approval request, and transitions the run to `PAUSED_FOR_APPROVAL`.
6. `MEMORY_RETRIEVAL`: Queries the Memory Service (Mem0 / Supabase pgvector) for historical patterns or merchant preferences.
7. `MEMORY_UPDATE`: Appends verified conclusions or preference adjustments to Mem0.

### Illustrative Agent IR Example: Payment Reconciliation Agent
```json
{
  "$schema": "https://deltix.dev/schemas/agent_ir_v1.json",
  "ir_version": "1.0.0",
  "agent_id": "agent_paypal_reconciliation_v1",
  "tenant_id": "tenant_merchant_acme_corp",
  "metadata": {
    "name": "Payment Reconciliation Agent",
    "description": "Cross-references PayPal transactions with order records, identifies discrepancy amounts, and drafts an audit report.",
    "category": "reconciliation",
    "author": "compiler_engine",
    "created_at": "2026-11-06T15:00:00Z"
  },
  "inputs": {
    "start_date": {"type": "string", "format": "date-time", "required": true},
    "end_date": {"type": "string", "format": "date-time", "required": true},
    "merchant_id": {"type": "string", "required": true}
  },
  "outputs": {
    "reconciliation_status": {"type": "string", "enum": ["MATCHED", "DISCREPANCY_FOUND", "ERROR"]},
    "discrepancy_count": {"type": "integer"},
    "report_summary": {"type": "string"},
    "discrepancy_details": {"type": "array"}
  },
  "capabilities": [
    {
      "capability_id": "paypal.transactions.list",
      "version": "1.0.0",
      "is_sensitive": false,
      "allowed_actions": ["READ"]
    },
    {
      "capability_id": "paypal.orders.get",
      "version": "1.0.0",
      "is_sensitive": false,
      "allowed_actions": ["READ"]
    }
  ],
  "policies": {
    "read_only": true,
    "max_budget_usd": 0.00,
    "require_human_approval": false,
    "forbidden_actions": ["paypal.refunds.create", "paypal.orders.capture"]
  },
  "memory": {
    "enable_semantic_memory": true,
    "memory_namespace": "tenant_merchant_acme_corp/reconciliation",
    "max_retrieval_k": 3,
    "state_keys_to_persist": ["transactions", "orders", "discrepancies"]
  },
  "execution_limits": {
    "max_steps": 25,
    "timeout_seconds": 120,
    "max_loop_iterations": 5,
    "max_consecutive_errors": 2
  },
  "nodes": [
    {
      "id": "node_fetch_transactions",
      "type": "TOOL_EXECUTION",
      "description": "Fetch transaction records from PayPal Sandbox for the date range",
      "input_mapping": {
        "start_time": "inputs.start_date",
        "end_time": "inputs.end_date"
      },
      "payload": {
        "capability_id": "paypal.transactions.list"
      },
      "output_mapping": {
        "raw_transactions": "result.transaction_details"
      },
      "retry_policy": {"max_retries": 3, "backoff_seconds": 2}
    },
    {
      "id": "node_fetch_orders",
      "type": "TOOL_EXECUTION",
      "description": "Fetch corresponding internal/sandbox orders for comparison",
      "input_mapping": {
        "transaction_ids": "state.raw_transactions[*].transaction_info.transaction_id"
      },
      "payload": {
        "capability_id": "paypal.orders.get"
      },
      "output_mapping": {
        "orders": "result.order_records"
      },
      "retry_policy": {"max_retries": 3, "backoff_seconds": 2}
    },
    {
      "id": "node_calculate_discrepancies",
      "type": "DETERMINISTIC_PROCESS",
      "description": "Deterministic balance comparison between captured transaction amounts and order totals",
      "input_mapping": {
        "transactions": "state.raw_transactions",
        "orders": "state.orders"
      },
      "payload": {
        "operation": "BALANCE_DIFF_CALCULATION",
        "tolerance_cents": 0
      },
      "output_mapping": {
        "discrepancies": "result.diff_items",
        "discrepancy_count": "result.total_diffs"
      }
    },
    {
      "id": "node_check_discrepancy_count",
      "type": "CONDITIONAL_ROUTER",
      "description": "Route based on whether discrepancies were found",
      "payload": {
        "condition_type": "EXPRESSION",
        "expression": "state.discrepancy_count > 0"
      }
    },
    {
      "id": "node_generate_discrepancy_report",
      "type": "LLM_REASONING",
      "description": "Use LLM to synthesize discrepancy notes citing specific order IDs and timestamps",
      "input_mapping": {
        "discrepancies": "state.discrepancies"
      },
      "payload": {
        "prompt_template": "Analyze the following discrepancy items and generate a clear merchant explanation: {{state.discrepancies}}",
        "temperature": 0.1
      },
      "output_mapping": {
        "report_summary": "result.text_summary",
        "reconciliation_status": "'DISCREPANCY_FOUND'"
      }
    },
    {
      "id": "node_generate_clean_report",
      "type": "DETERMINISTIC_PROCESS",
      "description": "Output clean matched report when zero discrepancies are detected",
      "payload": {
        "static_output": {
          "report_summary": "All transactions perfectly match corresponding orders. Zero variance detected.",
          "reconciliation_status": "MATCHED"
        }
      },
      "output_mapping": {
        "report_summary": "result.report_summary",
        "reconciliation_status": "result.reconciliation_status"
      }
    }
  ],
  "transitions": [
    {
      "from_node": "node_fetch_transactions",
      "to_node": "node_fetch_orders",
      "is_default": true
    },
    {
      "from_node": "node_fetch_orders",
      "to_node": "node_calculate_discrepancies",
      "is_default": true
    },
    {
      "from_node": "node_calculate_discrepancies",
      "to_node": "node_check_discrepancy_count",
      "is_default": true
    },
    {
      "from_node": "node_check_discrepancy_count",
      "to_node": "node_generate_discrepancy_report",
      "condition_expression": "state.discrepancy_count > 0",
      "is_default": false
    },
    {
      "from_node": "node_check_discrepancy_count",
      "to_node": "node_generate_clean_report",
      "condition_expression": "state.discrepancy_count == 0",
      "is_default": true
    }
  ]
}
```

---

## 2. Compiler Architecture

The compilation process converts probabilistic language into deterministic execution structures across 9 stages:

| Stage | Name | Nature | Responsibility | Failure Action |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Requirement Extraction | Probabilistic (LLM) | Extracts agent goals, inputs, outputs, and constraints into typed JSON. | Re-prompt LLM with extraction schema. |
| **2** | Clarification Loop | Deterministic / LLM | Identifies missing information (e.g., unspecified spending limit). | Generates user prompts and halts pipeline. |
| **3** | Agent IR Synthesis | Probabilistic (LLM) | Emits complete draft `Agent IR` document. | Fallback to template synthesis. |
| **4** | Schema Validation | **Deterministic (Go)** | Validates Agent IR against `agent_ir_v1.json` JSON Schema using `gojsonschema`. | Reject with detailed line/column syntax error. |
| **5** | Graph Topology Validation | **Deterministic (Go)** | Builds graph adjacency list: detects unreachable nodes, invalid edge references, and loops exceeding `max_loop_iterations`. | Reject with invalid graph diagnostics. |
| **6** | Capability Resolution | **Deterministic (Go)** | Resolves requested tools against Capability Registry. Validates parameter schemas. | Reject with `UNKNOWN_CAPABILITY_ERROR`. |
| **7** | Policy Validation | **Deterministic (Go)** | Verifies agent policies against tenant limits (e.g. spend limits, write permissions). | Reject with `POLICY_VIOLATION_ERROR`. |
| **8** | Synthetic Test Generation | Probabilistic (LLM) | Synthesizes positive, negative, and edge-case test payloads. | Fallback to standard archetype test fixtures. |
| **9** | Sandbox Test Execution | **Deterministic (Go)** | Executes tests against mock capability adapters to verify transitions and limits. | Reject if any test assertion fails. |

---

## 3. Execution Architecture

The execution engine translates validated `Agent IR` into an active **Python LangGraph** workflow governed by the **Go Runtime Control Plane**.

### Communication Bridge: Go Runtime to Python LangGraph Worker
1. The **Go Runtime Service** owns tenant verification, run persistence in Supabase, and external tool execution.
2. The Go service exposes an internal HTTP interface to the **Python LangGraph Worker**:
   * `POST /v1/graph/execute-step`: Passes current graph state, invokes the next node.
   * `POST /v1/graph/resume-step`: Passes approval token and resumes execution.
3. When LangGraph needs to invoke a tool, it calls back to the Go service:
   * `POST /v1/internal/tools/dispatch`: Go service validates policy, checks Redis idempotency, logs audit to Supabase, and calls PayPal.

### Human-in-the-Loop Interruption Mechanics
* When an edge targets a `HUMAN_APPROVAL` node or a sensitive capability, LangGraph triggers an `interrupt()`.
* LangGraph emits the checkpointed state to the Go Runtime Service.
* Go Runtime writes the state to Supabase `agent_runs` table (`status = 'PAUSED_FOR_APPROVAL'`), inserts an entry into `approval_requests`, and releases the Redis lock.
* Execution suspends. Zero background threads, sockets, or worker resources remain open.
* When the human operator signs off via the UI, Go verifies the cryptographic token, marks the approval `APPROVED` in Supabase, re-acquires the Redis lock, and posts the resume request to LangGraph.

---

## 4. Memory Architecture

DelTix enforces strict operational and architectural boundaries across memory tiers. Refer to [`diagrams/06-memory-architecture.md`](./diagrams/06-memory-architecture.md).

### 1. Short-Term Execution State (Python LangGraph In-Memory)
* Ephemeral key-value context for the active run (node variables, intermediate calculation outputs).
* Serialized to Supabase after every node transition.

### 2. High-Speed Cache & Locking Layer (Redis 7)
* Sub-millisecond deduplication of webhook events and idempotency keys (TTL: 24h).
* Distributed mutexes via Redsync to prevent concurrent conflicting runs.
* In-memory cache for top-k semantic memories to reduce vector search latency.

### 3. Long-Term Semantic Memory (Python Mem0 + Supabase pgvector)
* Stores non-authoritative merchant context:
  * Merchant preferences (e.g., *"Prefers manual review for refunds on digital goods"*).
  * Historical case summaries (e.g., *"Customer XYZ had 3 resolved disputes in October"*).
* Scoped by `tenant_id` and `agent_id` with vector cosine similarity retrieval ($k=3$).
* Invalidation: Memories older than 90 days or explicitly flagged as superseded are pruned.

### 4. Structured Operational Data (Supabase PostgreSQL 16)
* System-of-record for financial calculations, order numbers, capture IDs, and exact ledger amounts.
* **Invariant:** Mem0 is **never** used as authoritative financial information. If an agent needs to know an order balance, it queries the live PayPal API or Supabase operational tables.

---

## 5. Capability Architecture

Every capability in DelTix is registered in an immutable catalog with strict Go contracts.

Refer to [`diagrams/07-paypal-integration-flow.md`](./diagrams/07-paypal-integration-flow.md).

### Capability Specification Structure
```go
type CapabilityContract struct {
    ID                  string                 `json:"id"`                    // e.g. "paypal.refunds.create"
    Version             string                 `json:"version"`               // e.g. "1.0.0"
    Description         string                 `json:"description"`
    ParametersSchema    map[string]interface{} `json:"parameters_schema"`     // Validated via JSONSchema
    OutputSchema        map[string]interface{} `json:"output_schema"`
    IsSensitive         bool                   `json:"is_sensitive"`          // Mandatory human approval
    Idempotent          bool                   `json:"idempotent"`            // Safe to retry on network drop
    TimeoutSeconds      int                    `json:"timeout_seconds"`
    MaxRetries          int                    `json:"max_retries"`
    RequiredPermissions []string               `json:"required_permissions"` // e.g. ["payments:write"]
}
```

### Supported PayPal Capabilities (MVP)
1. `paypal.orders.create`: Creates a PayPal Sandbox order (Sensitive, requires approval, Idempotent).
2. `paypal.orders.capture`: Captures an authorized PayPal order (Sensitive, requires approval, Idempotent).
3. `paypal.orders.get`: Retrieves authoritative order details (Read-only, Idempotent).
4. `paypal.transactions.list`: Queries transaction history and settlement records (Read-only, Idempotent).
5. `paypal.captures.get`: Reads specific payment capture details (Read-only, Idempotent).
6. `paypal.refunds.create`: Issues a refund against an existing capture (Sensitive, requires approval, Idempotent).

---

## 6. Security and Policy Architecture

Policy enforcement operates entirely outside of the LLM in the **Go Capability and Policy Service**.

Refer to [`diagrams/08-approval-and-policy-flow.md`](./diagrams/08-approval-and-policy-flow.md).

* **Idempotency in Redis & Supabase:** Every mutating call to PayPal Sandbox checks Redis (`SETNX idempotency:run_id:step_idx`) and includes `PayPal-Request-Id: hash(run_id + node_id + step_attempt)`.
* **Zero Trust Prompt Processing:** Inputs from merchants are checked against sanitization filters; prompt injections cannot disable policy checks because the Go policy engine executes after the LLM emits the tool call.

---

## 7. Diagram Cross-Reference Table

| Concept | Diagram Link |
| :--- | :--- |
| Overall Ecosystem Context | [`diagrams/01-system-context.md`](./diagrams/01-system-context.md) |
| Container & Service Architecture | [`diagrams/02-container-architecture.md`](./diagrams/02-container-architecture.md) |
| Compilation & Validation Stages | [`diagrams/03-agent-compilation-pipeline.md`](./diagrams/03-agent-compilation-pipeline.md) |
| Graph State Lifecycle | [`diagrams/04-agent-execution-lifecycle.md`](./diagrams/04-agent-execution-lifecycle.md) |
| Agent IR Data Model | [`diagrams/05-agent-ir-structure.md`](./diagrams/05-agent-ir-structure.md) |
| Multi-Tier Memory Partitioning | [`diagrams/06-memory-architecture.md`](./diagrams/06-memory-architecture.md) |
| Controlled PayPal Sandbox Flow | [`diagrams/07-paypal-integration-flow.md`](./diagrams/07-paypal-integration-flow.md) |
| Human Sign-off & Policy Engine | [`diagrams/08-approval-and-policy-flow.md`](./diagrams/08-approval-and-policy-flow.md) |
| Inter-Service Communication Topology | [`diagrams/09-service-interaction.md`](./diagrams/09-service-interaction.md) |
| Docker Local Deployment Stack | [`diagrams/10-deployment-architecture.md`](./diagrams/10-deployment-architecture.md) |
| Checkpoints & Crash Recovery | [`diagrams/11-failure-and-recovery-flow.md`](./diagrams/11-failure-and-recovery-flow.md) |
