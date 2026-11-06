# DelTix

> **Describe it. Generate it. Test it. Run it.**  
> DelTix is a financial-agent compiler and runtime platform that compiles natural-language descriptions into validated, policy-governed, executable AI agents running safely against PayPal Sandbox.

---

## 1. Vision & Core Principles

Building reliable financial AI agents requires tool contracts, permission policies, memory persistence, human approvals, and execution tracing. Developers repeatedly hand-code this infrastructure for each agent.

**DelTix builds the infrastructure once.** Different agents use:
* The same compiler pipeline and capability registry.
* The same policy enforcement layer outside the LLM.
* The same state machine memory interfaces.
* The same validation test harness.
* The same execution runtime and PayPal Sandbox adapters.

### Core Principles
1. **Specification Before Logic:** Generate a reviewable `AgentSpec` before generating execution logic.
2. **Capability Registry as Source of Truth:** Select approved tools from a concrete registry; never allow the model to invent payment APIs.
3. **Deterministic Safety:** The LLM proposes actions; deterministic policy controls enforce them.
4. **Test-Gated Readiness:** No agent executes until it passes synthetic positive, negative, and failure recovery tests.
5. **Safe Sandbox Execution:** All payments and refunds execute strictly against PayPal Developer Sandbox with idempotency keys.
6. **Resumable State Memory:** Execution states are snapshotted in PostgreSQL, enabling safe human-in-the-loop pauses without thread-locking or double-charging.

---

## 2. Four-Service Architecture

DelTix is architected into four modular, decoupled services:

```text
Natural-Language Prompt
          │
          ▼
┌────────────────────────────────────────┐
│  1. Compiler Service (compiler_service) │
│  • Parses user intent & constraints    │
│  • Emits structured AgentSpec          │
│  • Attaches PayPal capability toolkit  │
└───────────────────┬────────────────────┘
                    │ AgentSpec
                    ▼
┌────────────────────────────────────────┐
│  2. Config Service (config_service)    │
│  • Resolves capabilities in registry   │
│  • Configures memory & state layout    │
│  • Assembles workflow DAG & policies   │
└───────────────────┬────────────────────┘
                    │ ExecutableConfig
                    ▼
┌────────────────────────────────────────┐
│  3. Validator Service (validator_svc)  │
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
│  4. Runtime Service (runtime_service)  │
│  • Step runner & LLM coordinator       │
│  • Typed PayPal Sandbox adapters       │
│  • PostgreSQL state checkpointing      │
│  • Human-in-the-loop approval pauses   │
│  • Immutable audit trail & traces      │
└────────────────────────────────────────┘
```

---

## 3. Agent Memory Architecture

DelTix treats memory with zero confusion:
1. **Short-Term Working Memory (In-Prompt):** Ephemeral context window containing current stage objective and recent tool outputs.
2. **Episodic State Machine Memory (PostgreSQL):** Persistent checkpoints tracking `RunID`, current step, context variables, and pending approvals. Pauses execution cleanly for human approvals and ensures zero duplicate transactions.
3. **Historical / Long-Term Memory (Structured DB):** Indexed SQL queries for past transactions and dispute histories exposed as typed tools.

---

## 4. The 3 MVP Reference Agents

All three agents run on the exact same shared DelTix platform:

1. **Payment Reconciliation Agent:** Retrieves orders and transactions from PayPal Sandbox, cross-checks amounts and fees, and generates an evidence-backed discrepancy report (read-only).
2. **Checkout Assistant:** Interprets purchase requests, prepares checkout plans, verifies budget constraints, requests human approval, and captures orders in PayPal Sandbox.
3. **Refund Review Agent:** Retrieves transaction and dispute history, evaluates eligibility against policy caps, and requires mandatory human sign-off before executing any refund.

---

## 5. Documentation Index

The complete project specification and planning vault is located in [`docs/`](file:///d:/PayPal/DelTix/docs):

* **Architecture:**
  * [`docs/02-Architecture/Four Services Architecture.md`](file:///d:/PayPal/DelTix/docs/02-Architecture/Four%20Services%20Architecture.md)
  * [`docs/02-Architecture/Agent Memory.md`](file:///d:/PayPal/DelTix/docs/02-Architecture/Agent%20Memory.md)
  * [`docs/02-Architecture/System Architecture.md`](file:///d:/PayPal/DelTix/docs/02-Architecture/System%20Architecture.md)
  * [`docs/02-Architecture/Agent Specification.md`](file:///d:/PayPal/DelTix/docs/02-Architecture/Agent%20Specification.md)
  * [`docs/02-Architecture/Capability Registry.md`](file:///d:/PayPal/DelTix/docs/02-Architecture/Capability%20Registry.md)
* **Product:**
  * [`docs/01-Product/Product Brief.md`](file:///d:/PayPal/DelTix/docs/01-Product/Product%20Brief.md)
  * [`docs/01-Product/Problem and Differentiation.md`](file:///d:/PayPal/DelTix/docs/01-Product/Problem%20and%20Differentiation.md)
* **Planning & Hackathon Roadmap:**
  * [`docs/03-Planning/Build Roadmap.md`](file:///d:/PayPal/DelTix/docs/03-Planning/Build%20Roadmap.md)
  * [`docs/03-Planning/MVP Scope.md`](file:///d:/PayPal/DelTix/docs/03-Planning/MVP%20Scope.md)
  * [`docs/03-Planning/Task Board.md`](file:///d:/PayPal/DelTix/docs/03-Planning/Task%20Board.md)
  * [`docs/03-Planning/Demo Script.md`](file:///d:/PayPal/DelTix/docs/03-Planning/Demo%20Script.md)
* **Coding Standards:**
  * [`codingrules.md`](file:///d:/PayPal/DelTix/codingrules.md)
