# 02 — Agent Compiler Studio (`/studio/compile`)

This document defines the exact **page content** and **UI components** for the **Agent Compiler Studio**, backed by **`backend/agent-compiler-service` (`POST /v1/agents/compile`)**.

---

## 1. Page Layout & Content Overview

The Compiler Studio is a two-column interactive workspace:
- **Left Column (Input & Clarification Plane):**
  - Agent Metadata & Natural-Language Prompt Composer
  - Interactive Clarification Drawer (appears dynamically when Guardrail 1 returns `status: "CLARIFICATION_REQUIRED"`)
- **Right Column (Verification & Output Plane):**
  - Compilation Outcome Banner (`CLARIFICATION_REQUIRED`, `FAILED_VALIDATION`, or `READY`)
  - 7-Guardrail Validation Scorecard (`ValidationReport`)
  - Pre-Flight Synthetic Dry-Run Test Suite (`SyntheticTests` — 3 scenarios)
  - Visual `AgentIR` Node & Transition Graph + Raw JSON Tab
  - Cryptographic `ReadinessToken` (`rtok_...`) Card

---

## 2. Studio UI Components & Exact Content

### 1. `PromptComposerCard`
- **Header Content:** `1. Describe Financial Agent`
- **Form Fields & Content:**
  - **Agent Name (`name`):** Text input (placeholder: `"Dispute Refund Assistant"`, default fallback `"DelTix Financial Agent"`).
  - **Category (`category`):** Select dropdown with options:
    - `PAYPAL_OPERATIONS` (Default)
    - `REFUNDS`
    - `CHECKOUT_CAPTURE`
    - `REPORTING`
  - **Natural Language Prompt (`natural_language_prompt`):** Multi-line textarea.
    - Quick-Fill Prompt Preset Pills (for 1-click testing):
      - *Preset 1 (Triggers Clarification):* `"Refund customer PayPal captures when an item is damaged."`
      - *Preset 2 (Read-Only — Compiles Immediately):* `"List recent PayPal transactions and summarize daily volume."`
      - *Preset 3 (Order Creation):* `"Create order in PayPal for customer checkout requests."`
  - **Primary Button:** **`Compile Agent IR`** (triggers `POST /v1/agents/compile`).

---

### 2. `ClarificationQuestionsPanel` *(Conditional — Shown when `status == "CLARIFICATION_REQUIRED"`)*
- **Alert Header Content:**
  - Badge: `GUARDRAIL 1 TRIGGERED — CLARIFICATION REQUIRED`
  - Subtitle: `This prompt involves money-moving PayPal operations. Please specify the required financial safety bounds to complete compilation.`
- **Dynamic Question Cards (Rendered from `clarification_questions[]`):**
  - **Question 1 (`field: "max_budget_usd"`):**
    - Question Text: *"What is the maximum USD budget cap allowed for this money-moving agent per run?"*
    - Helper Text (`why_required`): *"DelTix requires an explicit USD ceiling (e.g., 50.00 or 250.00) on all mutating PayPal agents."*
    - Quick-Select Suggestion Chips (`suggestions[]`): `50.00` | `100.00` | `500.00` + custom numeric input (`0.01` to `10000.00`).
  - **Question 2 (`field: "require_human_approval"`):**
    - Question Text: *"Should this agent pause for human operator approval before executing PayPal refunds or captures?"*
    - Helper Text (`why_required`): *"Sensitive money-moving operations (refunds and captures) require an explicit human-in-the-loop policy."*
    - Toggle / Chip (`suggestions[]`): `true (Require Human Approval)`
- **Action Button:** **`Submit Clarifications & Re-Compile`** (re-sends `POST /v1/agents/compile` with the populated `clarifications` map).

---

### 3. `ValidationScorecardPanel` *(Shown when `status == "READY"` or `"FAILED_VALIDATION"`)*
- **Header Content:** `2. Deterministic Compiler Verification Scorecard`
- **4 Status Indicators (Mapped from `validation_report`):**
  1. **Schema & Bounds (`schema_valid`):** `PASSED` / `FAILED` (`IR v1.0 schema, max_steps <= 50, timeout 5..300s`)
  2. **Graph Topology (`topology_valid`):** `PASSED` / `FAILED` (`BFS reachability, terminal sink path, DFS cycle guard`)
  3. **Policy Compliance (`policy_compliant`):** `PASSED` / `FAILED` (`Read-only isolation, budget ceiling <= $10,000, approval gate`)
  4. **Pre-Flight Dry Run (`tests_passed / tests_run`):** e.g., `3 / 3 Passed`
- **Resolved Capabilities List (`capabilities_resolved[]`):**
  - Displays verified PayPal capability badges, e.g., `paypal.captures.refund (v1.0.0)` or `paypal.transactions.list (v1.0.0)`.
- **Compiler Diagnostics List (`validation_report.errors[]`):**
  - Shown when `status == "FAILED_VALIDATION"` (HTTP `422`): lists exact guardrail error codes (`ORPHAN_NODE_DETECTED`, `UNBOUNDED_CYCLE_DETECTED`, `READ_ONLY_VIOLATION`, `INVALID_BUDGET_POLICY`, `MISSING_APPROVAL_GATE`, `UNKNOWN_CAPABILITY`).

---

### 4. `SyntheticPreFlightTestsCard`
- **Header Content:** `3. Pre-Flight Synthetic Dry-Run Tests (Zero Real Money Moved)`
- **Renders 3 Rows from `synthetic_tests[]`:**
  1. **`happy_path_dry_run`:**
     - Status Badge: `PASSED` / `FAILED`
     - Detail: *"Simulated nominal PayPal Sandbox response; graph reached terminal sink within step limit."*
  2. **`policy_budget_boundary_dry_run`:**
     - Status Badge: `PASSED` / `FAILED`
     - Detail: *"Simulated $999,999.00 payload; deterministic budget policy guard intercepted exceeding amount."*
  3. **`malformed_input_dry_run`:**
     - Status Badge: `PASSED` / `FAILED`
     - Detail: *"Simulated missing parameter input; error boundary halted within max_consecutive_errors."*

---

### 5. `PolicyAndLimitsSummaryBar`
- **Purpose:** Displays the compiled safety envelope from `agent_ir.policies` and `agent_ir.execution_limits`.
- **Pills Displayed:**
  - **Mode:** `READ-ONLY` (green) or `MUTATING` (amber)
  - **Max Budget:** `$0.00` (if read-only) or `${max_budget_usd} USD`
  - **Human Approval:** `REQUIRED` or `NOT REQUIRED`
  - **Step Limit:** `{max_steps} steps`
  - **Timeout:** `{timeout_seconds}s`
  - **Memory Namespace:** `{memory.memory_namespace}` (`top_k: 5`)

---

### 6. `AgentIRGraphVisualizer` & `AgentIRJsonViewer`
- **Header Content:** `4. Compiled Agent IR v1.0 State Graph` (with toggle tabs: **`Visual Flow`** | **`Canonical JSON`**)
- **Visual Flow Tab Content:**
  - Renders the Left-to-Right directed graph from `agent_ir.nodes[]` and `agent_ir.transitions[]`:
    - `node_memory_retrieve` (`MEMORY_RETRIEVAL`)
    - ➡️ `node_llm_reason` (`LLM_REASONING`, `temp: 0.0`)
    - ➡️ `node_human_approval` (`HUMAN_APPROVAL` — shown when sensitive/approval enabled)
    - ➡️ `node_paypal_tool` (`TOOL_EXECUTION` — displays `payload.capability_id` & `retry_policy`)
    - ➡️ `node_memory_update` (`MEMORY_UPDATE`)
    - ➡️ `node_terminal` (`DETERMINISTIC_PROCESS` — Terminal Sink)
- **Canonical JSON Tab Content:**
  - Read-only syntax-highlighted viewer showing the exact `agent_ir` JSON object with a **`Copy Agent IR JSON`** button.

---

### 7. `ReadinessTokenBanner` *(Shown when `status == "READY"`)*
- **Header Content:** `Cryptographic Readiness Token Issued`
- **Displayed Fields:**
  - **Spec ID (`spec_id`):** `spc_...`
  - **Agent ID (`agent_id`):** `agt_...`
  - **Version (`version`):** `1.0.0`
  - **HMAC-SHA256 Token (`readiness_token`):** `rtok_...` (with copy button)
- **Action Button (Pending Runtime Service):**
  - Disabled button: **`Launch Agent Run (TODO: Runtime Service Pending)`** with helper note: *"Agent Runtime Service (`/v1/runs`) is not integrated yet."*
