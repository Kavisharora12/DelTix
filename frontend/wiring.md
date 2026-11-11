# DelTix Frontend Architecture & Wiring Guide

This document maps every user-facing feature in the DelTix frontend to its underlying components, state stores, event handlers, and data flows.

---

## 1. Architecture Overview & Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling & Tokens:** Tailwind CSS with Radix Color Scales (`@radix-ui/colors`)
- **Typography:** High-contrast system font stack (`Inter`, `-apple-system`) and monospace stack (`JetBrains Mono`, `Fira Code`)
- **DAG Canvas:** `@xyflow/react` (ReactFlow v12) auto-laid out with `dagre`
- **State Management:** Zustand (`useDelTixStore` for application data, `useTourStore` for game onboarding)
- **Command Palette & Tables:** `cmdk`, `@tanstack/react-table`
- **Icons:** `lucide-react`

---

## 2. Directory Structure & File Map

```
frontend/
├── Design.md                            # High-density fintech design specification
├── wiring.md                            # Feature-to-component wiring documentation
├── src/
│   ├── app/                             # Next.js 14 App Router routes & error boundaries
│   │   ├── page.tsx                     # /: Public Landing Page, Nav & Prompt Playground
│   │   ├── dashboard/page.tsx           # /dashboard: Client Main Dashboard & 4 KPI cards
│   │   ├── studio/new/page.tsx          # /studio/new: Plain-English Compiler Studio & Clarifications
│   │   ├── sandbox/page.tsx             # /sandbox: Live Chatbot & SSE Execution Sandbox
│   │   ├── sandbox/[specId]/page.tsx    # /sandbox/:specId: Spec-targeted sandbox
│   │   ├── layout.tsx                   # Root HTML layout with font configuration
│   │   ├── error.tsx                    # Next.js client-side error boundary
│   │   ├── global-error.tsx             # Root HTML-level error boundary
│   │   ├── not-found.tsx                # Custom 404 page with console routing
│   │   ├── runs/page.tsx                # /runs: Primary data table & filter bar
│   │   ├── runs/[id]/page.tsx           # /runs/[id]: Full DAG & node inspector
│   │   ├── approvals/page.tsx           # /approvals: Human signoff inbox & operator audit note
│   │   ├── agents/page.tsx              # /agents: Agent Registry & Visual Studio
│   │   ├── policies/page.tsx            # /policies: Spend limits & capability guards
│   │   ├── ledger/page.tsx              # /ledger: Idempotent settlement ledger
│   │   └── audit/page.tsx               # /audit: Append-only SHA-256 audit trail & record inspector
│   ├── components/
│   │   ├── shell/                       # Application scaffolding & navigation
│   │   │   ├── app-shell.tsx            # Context switcher (Landing vs Console shell)
│   │   │   ├── sidebar.tsx              # 232px collapsible navigation rail
│   │   │   ├── topbar.tsx               # 48px header with search, env pill & shortcuts
│   │   │   ├── command-palette.tsx      # Cmd+K fuzzy search modal
│   │   │   └── shortcuts-modal.tsx      # "?" keyboard shortcuts cheatsheet modal
│   │   ├── runs/                        # Run inspection & DAG visualization
│   │   │   ├── runs-table.tsx           # Filterable data table with j/k keyboard nav
│   │   │   ├── run-detail-view.tsx      # Tabbed header, KeyFacts & action controls
│   │   │   ├── graph-view.tsx           # ReactFlow DAG canvas with auto dagre layout
│   │   │   ├── custom-node.tsx          # Custom node with AST math & verbatim quote proofs
│   │   │   ├── timeline-view.tsx        # Temporal-style chronological event history
│   │   │   ├── checkpoints-view.tsx     # State delta inspector with "Retry from here"
│   │   │   ├── policy-view.tsx          # Evaluated policy rules & thresholds
│   │   │   ├── raw-view.tsx             # Full JSON payload viewer & downloader
│   │   │   └── approval-decision-panel.tsx # Pinned decision sheet & HMAC sign modal
│   │   ├── studio/
│   │   │   └── agent-studio.tsx         # Split-pane YAML editor & compiler diagnostics
│   │   ├── animation/
│   │   │   ├── stickman-story.tsx       # 5-scene animated SVG stickman workflow
│   │   │   └── interactive-simulator.tsx # Interactive spend cap & HMAC token playground
│   │   ├── onboarding/
│   │   │   ├── hands-on-tour-hud.tsx    # Docked floating game HUD across real routes
│   │   │   └── interactive-tour.tsx     # Step-by-step modal guide
│   │   └── ui/                          # Reusable Radix/Tailwind design components
│   │       ├── button.tsx               # High-contrast buttons (primary, secondary, destructive)
│   │       ├── money.tsx                # Tabular monetary display with currency code
│   │       ├── status-badge.tsx         # Shape+color status indicators (no color-only cues)
│   │       ├── key-facts.tsx            # Hairline metric strip (linear style)
│   │       ├── diff-viewer.tsx          # Side-by-side JSON state diffing
│   │       └── env-pill.tsx             # Environment selector & mandatory Sandbox banner
│   ├── lib/
│   │   ├── store.ts                     # Zustand application store & action reducers
│   │   ├── tour-store.ts                # Zustand onboarding game state
│   │   ├── use-global-shortcuts.ts      # Global keyboard navigation hook (g r, g a, ?)
│   │   ├── mock-data.ts                 # Seeded financial dataset (40 runs, 5 agents)
│   │   └── utils.ts                     # Classname merging helper (clsx + twMerge)
│   └── types/
│       └── index.ts                     # TypeScript schemas for Runs, Nodes, Agents, Audit
```

---

## 3. Feature-by-Feature Wiring Map

### 3.1 Public Landing Page (`/`)
- **File:** `frontend/src/app/page.tsx`
- **Render Mode:** Full-viewport without console sidebar or topbar.
- **Components & Features:**
  - **Hero Section:** Value proposition headline, live metrics ticker (`$42.8M+ Disbursed`, `0.00% Math Variance`, `14,200+ Approvals`, `99.99% Idempotency`).
  - **Segmented Product Showcase:** Toggles between two interactive components:
    1. **Stickman Story Guide** (`components/animation/stickman-story.tsx`): 5-step animated SVG walking through:
       - *1. Invoice Ingestion*
       - *2. Zero-Hallucination AST Math Proof*
       - *3. Hard Policy Shield*
       - *4. Dual-Key Human Signoff*
       - *5. PayPal Settlement*
    2. **Live Policy Simulator** (`components/animation/interactive-simulator.tsx`): Interactive inputs for invoice amount and company spend cap; evaluates policy breaches and mints real HMAC tokens (`atok_...`).
  - **3 Core Pillars:** High-density summary of Deterministic AST Math, Fail-Closed Policy Matrix, and Dual-Key Cryptographic Signoff.
  - **Action Triggers:**
    - `Start Hands-On Tour Guide` $\rightarrow$ Calls `startTour()` and navigates to `/agents`.
    - `Open Operations Console` $\rightarrow$ Navigates directly to `/runs`.

---

### 3.2 Operations App Shell
- **File:** `frontend/src/components/shell/app-shell.tsx`
- **Wiring:**
  - Detects `pathname === "/"`. If true, renders clean landing view.
  - Otherwise, mounts the 2-column console layout:
    - **Sidebar** (`sidebar.tsx`): 232px width, workspace switcher, nav items (32px high with 16px icons), active route indicator (2px blue left bar), pending approval badge count.
    - **TopBar** (`topbar.tsx`): 48px height, dynamic breadcrumb trail, `Tour Guide` button, `Search (⌘K)` button, `?` shortcuts button, `EnvPill` (Sandbox vs Live), theme toggle.
    - **SandboxBanner** (`env-pill.tsx`): Full-width amber banner shown in Sandbox mode: *"Sandbox. No real money moves."*
    - **HandsOnTourHUD** (`hands-on-tour-hud.tsx`): Docked game HUD rendered persistently at the bottom.
    - **ShortcutsModal** (`shortcuts-modal.tsx`): Listens for `?` key and opens cheat-sheet.

---

### 3.3 Runs Dashboard (`/runs`)
- **File:** `frontend/src/app/runs/page.tsx` $\rightarrow$ `components/runs/runs-table.tsx`
- **Wiring & Interactive Actions:**
  - **Saved View Tabs:** Filter between `All runs`, `Needs approval` (`PAUSED_FOR_APPROVAL`), and `Failed` (`FAILED` / `REJECTED`).
  - **Search Input:** Real-time multi-field search across run title, ID, counterparty, and agent name.
  - **Agent Filter Dropdown:** Scopes rows to a specific registered agent.
  - **`+ Trigger Test Run` Button:** Calls `createRunFromAgent()` in `store.ts`, creates a new invoice run, appends it to state, and immediately routes to `/runs/[newRunId]`.
  - **Keyboard Navigation:**
    - `j` or `ArrowDown`: Moves selection down one row.
    - `k` or `ArrowUp`: Moves selection up one row.
    - `Space`: Toggles the quick-peek side drawer for the selected run.
    - `Enter`: Navigates to `/runs/[id]` for the selected row.
    - `Escape`: Closes the peek drawer.
  - **Row Click:** Opens the full Run Detail Inspector.

---

### 3.4 Run Detail Inspector (`/runs/[id]`)
- **File:** `frontend/src/app/runs/[id]/page.tsx` $\rightarrow$ `components/runs/run-detail-view.tsx`
- **Header & KeyFacts:**
  - Displays title, status badge, currency-formatted amount (`Money`), counterparty, environment, and relative start time.
  - Copyable run ID with feedback icon.
  - **Header Actions:**
    - `Cancel run` (visible when `RUNNING`): Calls `rejectRun(run.id, "Manually cancelled")`.
    - `Retry from checkpoint` (visible when `FAILED`): Calls `retryRunFromCheckpoint(run.id)`, resetting state to `RUNNING` and simulating execution through to `COMPLETED`.
  - **KeyFacts Strip:** Hairline metrics: Amount, Recipient, Policy Result, Spend Cap Used, Duration.
- **Tab Views:**
  1. **Graph Tab** (`graph-view.tsx`):
     - Auto-laid-out left-to-right DAG with dagre.
     - Custom node cards (`custom-node.tsx`) showing status, execution duration, token count, AST math proofs, and verbatim quotes.
     - Node selection updates the resizable right-side **Node Inspector** showing exact inputs, outputs, and proof data.
     - When run status is `PAUSED_FOR_APPROVAL`, pins the **Approval Decision Panel** to the top of the inspector.
  2. **Timeline Tab** (`timeline-view.tsx`):
     - Temporal-style chronological event table with offsets (`+0.42s`), node IDs, and summaries.
  3. **Checkpoints Tab** (`checkpoints-view.tsx`):
     - Step-by-step state snapshots with JSON diffing (`diff-viewer.tsx`).
     - `Retry from here` button wired to `retryRunFromCheckpoint(run.id)`.
  4. **Policy Tab** (`policy-view.tsx`):
     - Table of policy rules evaluated during the run with expressions, input values, and outcomes.
  5. **Raw Tab** (`raw-view.tsx`):
     - Read-only code viewer with one-click JSON copy and JSON file download.

---

### 3.5 Approvals Inbox (`/approvals`)
- **File:** `frontend/src/app/approvals/page.tsx` $\rightarrow$ `components/runs/approval-decision-panel.tsx`
- **Wiring & Interactive Actions:**
  - Filters all runs where `status === "PAUSED_FOR_APPROVAL"`.
  - Table shows Amount, Counterparty, Rule Triggered, Waiting Duration, and Initiator.
  - Right sheet displays the **Approval Decision Panel**:
    - Amber warning banner explaining the policy threshold breach.
    - Verified checks checklist (3 of 3 items matched, AST math verified, vendor allowed, idempotency key unique).
    - Rule expression: `amount_usd > max_budget_usd (1250.00 > 500.00)`.
    - **`Reject` Button:** Opens textarea modal to enter a required rejection reason, calling `rejectRun()`.
    - **`Approve $X` Button:** Opens confirmation dialog, requiring secondary confirmation to mint and sign the cryptographic HMAC token (`atok_live_...`).
  - **Keyboard Shortcuts:**
    - `A`: Triggers approve flow for selected run.
    - `R`: Triggers reject flow for selected run.

---

### 3.6 Agent Registry & Studio (`/agents`)
- **File:** `frontend/src/app/agents/page.tsx` $\rightarrow$ `components/studio/agent-studio.tsx`
- **Wiring & Interactive Actions:**
  - **Left Rail (360px):** Registered agents list with version badges and success rate indicators.
  - **`+ New Agent Graph` Button:** Calls `createAgent()` in `store.ts`, creates a draft agent (`custom-payout-agent-...`), selects it, loads a clean starter YAML template into Studio, and flashes a confirmation badge.
  - **Right Studio Pane:**
    - Split editor with YAML definition and compiled IR views.
    - **Compiler Diagnostics Panel:** Styled like VS Code's Problems panel; lists errors, warnings, and informational diagnostics with line numbers.
    - **`Run in sandbox` Button:** Calls `createRunFromAgent(agent.id)`, creates a live run in the state store, and navigates directly to `/runs/[newRunId]`.
    - **`Publish version` Button:** Disabled if blocking compile errors exist. When clicked, calls `publishAgentVersion(agent.id)`, bumps the version tag (`v1.0.0` $\rightarrow$ `v1.1.0`), and shows a success banner.

---

### 3.2 Client Main Dashboard (`/dashboard`)
- **File:** `frontend/src/app/dashboard/page.tsx`
- **Features & Live Data Synchronization:**
  - **4 Financial KPI Cards:**
    - *Total Settled Volume:* Sum of all completed transaction amounts in USD with real-time trend.
    - *Active Agents:* Total count of registered and compiled agent specifications with live execution counter.
    - *Pending Approvals:* Count of runs in `PAUSED_FOR_APPROVAL` state with immediate amber action pill.
    - *Protected by Caps:* Protected dollar volume blocked by policy engine limits.
  - **Recent Agent Executions Table:** Real-time table displaying Agent Name, Trigger / Input, Status, Spend, and 1-click action buttons (`View Run` &rarr; `/runs/[id]`, `Review Gate` &rarr; `/approvals`).
  - **Quick Action Bar:** Direct navigation to `/studio/new`, `/sandbox`, and `/approvals`.

---

### 3.3 Agent Compiler Studio (`/studio/new`)
- **File:** `frontend/src/app/studio/new/page.tsx`
- **Features & Live Data Synchronization:**
  - **Natural Language Financial Prompt Composer:** Plain-English textarea allowing operators to express complex financial policies without writing code.
  - **Load Example Template:** Dropdown selector with 4 pre-configured templates:
    1. *E-Commerce Automated Refund Agent*
    2. *Vendor Invoice & Accounts Payable Agent*
    3. *Chargeback & Dispute Mitigation Agent*
    4. *Monthly SaaS Proration & Credit Agent*
  - **Quick Financial Settings:** Max Spend Limit ($), Human Approval Threshold ($), and Permitted Capabilities checkboxes (`paypal_get_capture`, `paypal_refund_capture`, `return_policy_rag`).
  - **Interactive Clarification Drawer:** When `POST /v1/agents/compile` returns `status: "CLARIFICATION_REQUIRED"`, slides out with the required boundary questions, suggestions, and recommendations, and allows re-compiling with `clarifications`.
  - **Pre-Flight Test Scorecard:** Renders synthetic execution test results from the compiler service.
  - **HMAC Readiness Token Seal:** Displays verified cryptographic readiness token.
  - **Synthesized Execution DAG:** Displays topologically sorted nodes dynamically from `agent_ir.nodes`.

---

### 3.4 Live Agent Sandbox & Chatbot (`/sandbox` & `/sandbox/[specId]`)
- **Files:** `frontend/src/app/sandbox/page.tsx`, `frontend/src/app/sandbox/[specId]/page.tsx`, `frontend/src/components/sandbox/sandbox-client.tsx`
- **Features & Live Data Synchronization:**
  - **1. Conversational Chat Terminal:**
    - Free-form user request input or dynamic form inputs (`order_id`, `amount_usd`, `customer_email`).
    - Quick test trigger preset pills (e.g. *$38 Auto-Refund*, *$150 Approval Gate*).
    - Chat message thread with customer request bubbles, system verification pills (`[Python Decimal AST ✓]`), and agent execution response bubbles.
  - **2. Live SSE Execution Timeline:**
    - Connects to `/api/gateway/v1/runs/{id}/stream` over Server-Sent Events.
    - Streams live `checkpoint` and `run_status` events without polling.
    - Renders step indexes, tool execution badges, duration, inputs/outputs, and real-time status badges.
    - If execution breaches policy and pauses, flashes the Human Approval banner with a 1-click link to `/approvals`.
  - **3. State, Memory & Integrity Inspector:**
    - Live JSON state variable snapshot inspection.
    - Zero-Hallucination integrity proof badges (`[AST Math Engine: 0 Variance ✓]`, `[Grounding Verifier: Quote Proof ✓]`, `[PII Redaction: Sanitized ✓]`, `[HMAC Readiness: Sealed ✓]`).
    - Mem0 persistent user memory context.

---

### 3.5 Human Approvals Gate (`/approvals`)
- **File:** `frontend/src/app/approvals/page.tsx`, `frontend/src/components/runs/approval-decision-panel.tsx`
- **Features & Live Data Synchronization:**
  - Live filterable inbox of runs in `PAUSED_FOR_APPROVAL` status.
  - **Compliance Operator Note:** Mandatory audit note textarea on approve (`operatorNote`) for SOC2/financial audit records.
  - Calls `api.decideApproval(approvalId, "APPROVED" | "REJECTED", reason)` using the actual backend `pending_approval.approval_id`.
  - Automatically fetches resumed run details and displays the cryptographically signed HMAC authorization token.

---

### 3.6 Financial Audit Ledger & Compliance Trail (`/audit`)
- **File:** `frontend/src/app/audit/page.tsx`
- **Features & Live Data Synchronization:**
  - Full audit trail with `SEQ #`, Timestamp, Agent, Action, Amount, Operator, Status, and SHA-256 Checksum.
  - **Filter Bar:** Filter by Agent, Action / Event, Date Range (24h, 7d, 30d, all), and global keyword search.
  - **Cursor Pagination:** Fast client-side cursor pagination (`Previous 20` / `Next 20`).
  - **Export Capabilities:** 1-click `Export CSV` and `Export JSON` file generation.
  - **Cryptographic Record Inspector Drawer:** Clicking any row reveals SHA-256 Checksum, Supabase PostgreSQL 16 integrity verification, PayPal Request Idempotency Key, and PII Masking Status.

---

### 3.7 Spend Policies (`/policies`)
- **File:** `frontend/src/app/policies/page.tsx`
- **Wiring & Interactive Actions:**
  - Matrix of active policy rules: Rule Name, Scope, Deterministic Expression, Current Threshold, Action on Exceed, and Active Status.
  - **`New Policy Rule` Button:** Opens modal to define a new policy guard:
    - Inputs: Policy Name, Python AST Expression (e.g. `amount_usd <= 1000.00`), Threshold Description, Action on Exceed (`REQUIRE_HUMAN_APPROVAL`, `REJECT_RUN`, `CIRCUIT_BREAK`).
    - Submitting prepends the new rule to the table and activates it immediately.

---

### 3.8 Settlement Ledger (`/ledger`)
- **File:** `frontend/src/app/ledger/page.tsx`
- **Wiring & Interactive Actions:**
  - Lists idempotent disbursement records, reference IDs, counterparties, dollar amounts, payment methods, idempotency keys, and reconciliation statuses (`reconciled`, `pending`, `discrepancy`).
  - **`Export Reconciliation CSV` Button:** Client-side CSV generation that exports all rows into `deltix-reconciliation-[date].csv` and triggers an automatic browser download.

---

### 3.9 Cryptographic Audit Trail (`/audit`)
- **File:** `frontend/src/app/audit/page.tsx`
- **Wiring & Interactive Actions:**
  - Append-only chained transaction logs with Actor, Action, Target, and SHA-256 Hash.
  - **1-Click Hash Copying:** Clicking any hash copies the full string to the clipboard with visual checkmark feedback.
  - **`Export Audit Log` Button:** Exports the immutable log entries as a formatted JSON snapshot (`deltix-audit-trail-[date].json`) via automatic browser download.

---

### 3.10 Interactive Hands-On Game Tour
- **State Store:** `frontend/src/lib/tour-store.ts`
- **HUD Component:** `frontend/src/components/onboarding/hands-on-tour-hud.tsx`
- **Wiring:**
  - Docked game control deck docked at the bottom of the screen across all pages.
  - Controls: Step indicators, Current Mission task description, `Back`, `Next Task`, and `End Tour`.
  - Seamlessly navigates across 6 live routes in sequence:
    1. **Agent Studio** (`/agents`): *"Draft & compile deterministic agent state graphs"*
    2. **Policy Engine** (`/policies`): *"Inspect spend limits & fail-closed security rules"*
    3. **Execution DAG** (`/runs/[id]`): *"Analyze DAG node telemetry & AST math proofs"*
    4. **Human Approvals** (`/approvals`): *"Review flagged transactions & sign HMAC tokens"*
    5. **Settlement Ledger** (`/ledger`): *"Verify idempotency keys & dual-entry reconciliation"*
    6. **Cryptographic Audit** (`/audit`): *"Inspect append-only SHA-256 chained transaction logs"*

---

### 3.11 Global Keyboard Shortcuts
- **Hook:** `frontend/src/lib/use-global-shortcuts.ts`
- **Modal:** `frontend/src/components/shell/shortcuts-modal.tsx`
- **Shortcuts Active Anywhere (outside text inputs):**
  - `?`: Opens the Keyboard Shortcuts Cheatsheet modal.
  - `g` then `r`: Navigates to `/runs`.
  - `g` then `a`: Navigates to `/approvals`.
  - `g` then `s`: Navigates to `/agents`.
  - `g` then `p`: Navigates to `/policies`.
  - `g` then `l`: Navigates to `/ledger`.
  - `g` then `u`: Navigates to `/audit`.
  - `⌘K` or `Ctrl+K`: Opens the Command Palette.
  - `Escape`: Dismisses open modals, drawers, or command palette.

---

## 4. Verification & Health

- **Build Command:** `npm run build` inside `frontend/` (Verified 0 errors across all 13 routes).
- **Production Server:** `npx next start -p 3001` (Serving on `http://localhost:3001`).
- **Synchronized Backend Services:** API Gateway (`:8080`), Compiler (`:8081`), Runtime (`:8082`), Capability & Policy (`:8084`), Memory (`:8083`).
- **Git Branch:** `main`.
