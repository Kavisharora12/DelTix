# DelTix — Project Progress & Build Roadmap Tracker

**Project:** DelTix — Financial-Agent Compiler & Runtime for PayPal Sandbox  
**Tagline:** Describe it. Generate it. Test it. Run it.  
**Deadline:** November 12, 2026 at 12:00 PM Pacific Time (PayPal AI Hackathon)  
**Last Updated:** November 6, 2026

---

## 1. High-Level Architecture: 4 Services

| Service | Responsibility | Status |
| :--- | :--- | :--- |
| **1. Compiler Service (`compiler_service`)** | Ingests NL user input, resolves intent & constraints, generates structured `AgentSpec`, attaches PayPal capability toolkit. | ⚪ Phase 1 Focus |
| **2. Config Service (`config_service`)** | Validates capabilities against registry, configures memory schema, compiles workflow DAG & policy bounds into `ExecutableConfig`. | ⚪ Phase 1 Focus |
| **3. Validator Service (`validator_service`)** | Verifies schema integrity & policy rules, generates synthetic positive/negative/failure test cases, emits `ValidationReport`. | ⚪ Phase 3 |
| **4. Runtime Service (`runtime_service`)** | Shared execution runtime, PayPal Sandbox adapters, PostgreSQL state machine checkpoints (memory), human approval gate, audit traces. | ⚪ Phase 2 Focus |

---

## 2. Core Technical Deliverables

### Phase 1: Shared Contracts & Foundations
- [x] Clear old project code & consolidate documentation under DelTix.
- [x] Document 4-Service Architecture in [`docs/02-Architecture/Four Services Architecture.md`](file:///d:/PayPal/DelTix/docs/02-Architecture/Four%20Services%20Architecture.md).
- [x] Document Agent Memory Architecture in [`docs/02-Architecture/Agent Memory.md`](file:///d:/PayPal/DelTix/docs/02-Architecture/Agent%20Memory.md).
- [ ] Define the official Go structs and JSON schema for `AgentSpec`, `CapabilityRegistry`, `ExecutableConfig`, and `ExecutionState`.
- [ ] Scaffold the clean Go monorepo workspace for the 4 services.

### Phase 2: Capability Registry & PayPal Sandbox Adapters
- [ ] Implement server-side PayPal Sandbox OAuth2 token manager.
- [ ] Implement typed Go adapters for:
  - `paypal.orders.create`
  - `paypal.orders.capture`
  - `paypal.captures.get`
  - `paypal.transactions.list`
  - `paypal.refunds.create` (sensitive, approval-gated)

### Phase 3: Compiler, Configuration & Validator Services
- [ ] Service 1: LLM Prompt -> Structured `AgentSpec` + Attached PayPal Tools.
- [ ] Service 2: Capability Resolution, Policy Compilation & Workflow DAG builder.
- [ ] Service 3: Synthetic Test Suite generation & mock harness validation.

### Phase 4: Runtime Service & State Machine
- [ ] PostgreSQL schema for runs, checkpoints, approval requests, and audit logs.
- [ ] Resumable state machine with human-in-the-loop pause/resume tokens.
- [ ] Idempotency enforcement on payment mutations.

### Phase 5: Reference Demonstrations & Dashboard
- [ ] Payment Reconciliation Agent (read-only audit).
- [ ] Checkout Assistant (budget check + approval + sandbox capture).
- [ ] Refund Review Agent (policy validation + approval-gated refund).
- [ ] Web Dashboard for interactive prompt, spec inspection, test report, and live trace console.
