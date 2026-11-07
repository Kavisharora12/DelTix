# 03 — Compiled Agent Specifications Library (`/studio/specs`)

This document defines the exact **page content** and **UI components** for browsing and inspecting compiled agents stored in Supabase PostgreSQL (`agent_specs`), backed by **`GET /v1/agents/specs`** and **`GET /v1/agents/specs/{spec_id}`**.

---

## 1. Page Content Overview (`/studio/specs`)

### Header Section
- **Page Title:** `Compiled Agent Specifications`
- **Subtitle:** `Tenant-isolated catalog of verified Agent IR v1.0 specifications and cryptographic readiness tokens.`
- **Right Action CTA:** **`+ Compile New Agent`** (navigates to `/studio/compile`)

### Empty State Content (When `specs[]` is empty)
- **Headline:** `No Compiled Agents Yet`
- **Description:** `Describe your first PayPal workflow in the Agent Compiler Studio to generate a verified Agent IR specification.`
- **CTA Button:** **`Go to Compiler Studio`**

---

## 2. Library UI Components

### 1. `SpecsTableCard` (Lists items from `GET /v1/agents/specs?cursor={cursor}&limit=20`)
- **Columns & Displayed Content per Row (`sharedmodels.AgentSpec`):**
  1. **Agent Name & ID:**
     - Primary text: `spec.name` (e.g., `"Dispute Refund Bot"`)
     - Monospace subtext: `spec.spec_id` (`spc_...`) & `spec.agent_id` (`agt_...`)
  2. **Category & Version:**
     - Category pill: `spec.category` (`REFUNDS`, `PAYPAL_OPERATIONS`, `REPORTING`)
     - Version tag: `v{spec.version}` (`v1.0.0`)
  3. **Policy Envelope Summary (from `spec.ir_payload.policies`):**
     - `Read-Only` badge **OR** `Max Budget: ${max_budget_usd}` + `Approval Required` badge
  4. **Primary Capability:**
     - Displays `spec.ir_payload.capabilities[0].capability_id` (e.g., `paypal.captures.refund`)
  5. **Validation & Readiness Status:**
     - Status badge: `COMPILED` (green)
     - Tests badge: `{validation_report.tests_passed}/{validation_report.tests_run} Pre-Flight Tests`
     - Token preview: `rtok_...` (truncated with copy icon)
  6. **Created At:**
     - Formatted UTC timestamp (`spec.created_at`)
  7. **Row Action:**
     - **`Inspect Spec`** button (opens `SpecDetailDrawer` via `GET /v1/agents/specs/{spec_id}`)

---

### 2. `SeqIdCursorPaginationBar`
- **Purpose:** Implements fast indexed cursor pagination using the `next_cursor` (`seq_id`) returned by `GET /v1/agents/specs`.
- **Controls:**
  - **`First Page`** button (resets `cursor=0`)
  - **`Next Page`** button (passes `?cursor={next_cursor}&limit=20`; disabled when `next_cursor == 0` or fewer than `limit` items are returned)
  - Page size selector (`10`, `20`, `50`).

---

### 3. `SpecDetailDrawer` / Modal (`/studio/specs/{spec_id}`)
- **Purpose:** Fetches and displays a single specification from `GET /v1/agents/specs/{spec_id}`.
- **Sections Inside Drawer:**
  1. **Metadata Header:**
     - `spec.name`, `spec.spec_id`, `spec.agent_id`, `spec.tenant_id`, `spec.created_by`, `spec.created_at`, and `trace_id`.
  2. **Readiness Token Box:**
     - Full `spec.readiness_token` (`rtok_...`) with one-click copy.
  3. **Validation Report Summary (`spec.validation_report`):**
     - Checkmarks for `schema_valid`, `topology_valid`, `policy_compliant`, `capabilities_resolved[]`, and `tests_passed / tests_run`.
  4. **Node & Transition Inspector (`spec.ir_payload`):**
     - Reuses `AgentIRGraphVisualizer` and `AgentIRJsonViewer` from the Compiler Studio so operators can inspect every node, transition edge, retry policy, and memory namespace.

---

### 4. `PendingDownstreamServicesNotice` (Explicit `TODO` UI Placeholders)
- **Purpose:** Clearly communicates to the team which gateway routes are currently `TODO` (`501 Not Implemented`) so the frontend only activates live calls for Auth and Compiler.
- **Placeholder Items Shown as Disabled / Coming Soon Tabs in Sidebar:**
  - **Live Agent Runs (`/v1/runs` & SSE `/v1/runs/{run_id}/stream`):** Badge `TODO: Workstream 3`
  - **Human Approvals Queue (`/v1/approvals/{approval_id}/decide`):** Badge `TODO: Workstream 5`
  - **PayPal Capability Registry (`/v1/capabilities`):** Badge `TODO: Workstream 5`
