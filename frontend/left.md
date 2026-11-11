# DelTix Frontend — What Is Left vs `docs.md` (`left.md`)

**Source of Comparison:** [docs.md](./docs.md) (Screens 1–6 & Client Quick-Start) vs actual implementation in `DelTix/frontend/src/`.  
**Overall Verdict:** **Incomplete.** The UI shell, layout, and several visual/demo views exist, but key end-user prompt/chat flows from `docs.md` are not built yet, three console pages are mock/local-only, and live backend calls have payload/schema mismatches.

---

## Screen-by-Screen Gap Analysis (Against `docs.md`)

### Screen 1: Public Landing Page (`/`) — Mostly Built (Differences from `docs.md`)
- **Implemented:** [src/app/page.tsx](./src/app/page.tsx), [src/components/animation/stickman-story.tsx](./src/components/animation/stickman-story.tsx), [src/components/animation/interactive-simulator.tsx](./src/components/animation/interactive-simulator.tsx) *(legacy static `landing/` folder removed)*.
- **Left vs `docs.md`:**
  - **Interactive Prompt Playground (try-before-login prompt pills + guardrail preview):** Replaced by a numeric invoice-amount / spend-cap simulator (`InteractiveSimulator`); there is no plain-English sample prompt input on `/`.
  - **Top Navigation Links (`Platform`, `Guardrails`, `Pricing`, `Docs`) & `Sign In with Google` CTA on `/`:** Next.js `LandingPage` only shows `Direct Console` and `Interactive Game Tour` — there is **no Google Sign-In button or `/login` route** anywhere in the Next.js app (`src/app/`).
  - **Broken `Sign In` Link & Auth Redirect (`src/components/shell/topbar.tsx:153`):** The console `TopBar` links to `${API_BASE}/v1/auth/google/login` without `?tenant_id=...&redirect=true` (`backend/api-gateway/handlers/gateway_handler.go:114-129` returns `400 MISSING_TENANT_ID`), and `HandleGoogleCallback` returns raw JSON instead of redirecting back to the frontend console. Furthermore, `src/lib/api.ts:16` automatically attaches `"dev_token_deltix"` (`ten_dev_workspace`), masking Google login completely in dev mode.
  - **`Book Enterprise Demo` Modal:** Not implemented in Next.js `/`.

---

### Screen 2: Client Main Dashboard (`/dashboard`) — Missing Route
- **Implemented:** No `src/app/dashboard/page.tsx` route exists; users go straight to `/runs` ([src/app/runs/page.tsx](./src/app/runs/page.tsx)).
- **Left vs `docs.md`:**
  - **KPI Summary Cards:** Missing cards for *Total Settled Volume*, *Active Agents*, *Pending Approvals*, and *Saved by Caps*.
  - **`[+ Compile New Agent]` Dashboard CTA & Notification Bell Drawer:** Sidebar shows a numeric badge for pending approvals, but there is no `/dashboard` overview screen or topbar notification bell dropdown.

---

### Screen 3: Agent Compiler Studio (`/studio/new` vs current `/agents`) — Partially Built, Core Prompt UX Left
- **Implemented:** [src/app/agents/page.tsx](./src/app/agents/page.tsx) + [src/components/studio/agent-studio.tsx](./src/components/studio/agent-studio.tsx).
- **Left vs `docs.md`:**
  - **Dedicated `/studio/new` Route & Natural Language Prompt Input Box:** Currently `/agents` renders a raw YAML `<textarea>` (`agent_graph.yaml`) and sends raw YAML as `{ prompt }` instead of a plain-English requirement prompt composer (`natural_language_prompt`) with an Agent Name field and *Load Example Template* selector.
  - **Quick Settings (Max Spend Limit / Human Approval Threshold / Tool Permission Checkboxes) Auto-Synced with Prompt:** Missing in Studio.
  - **Interactive Clarification Drawer:** When `POST /v1/agents/compile` returns `status: "CLARIFICATION_REQUIRED"` and `clarification_questions[]`, there is **no drawer/modal** to display questions/suggestions, collect user answers (`clarifications`), and re-compile.
  - **Pre-Flight Synthetic Test Scorecard & HMAC Readiness Seal:** `CompileResponse` returns `synthetic_tests[]`, `validation_report`, and `readiness_token`, none of which are rendered as a scorecard panel in `agent-studio.tsx`.
  - **Live Graph Preview & Agent Switching State:** The *Synthesized Node Execution Order* block (`agent-studio.tsx:229-242`) renders hardcoded placeholder steps instead of `compiledIR.nodes`, and `yamlContent` does not reset when selecting a different agent in the left rail.
  - **API & Spec Contract Mismatches:** `api.compilePrompt` (`src/lib/api.ts:352-357`) sends `{ prompt, category }` instead of `{ natural_language_prompt, category }` and reads `resp.ir` instead of `resp.agent_ir`. Note that `GET /v1/agents/specs` does return `ir_payload` (`AgentSpec.IR`), so spec nodes render in the YAML editor, but `src/lib/api.ts:45-49` types `transitions` as `{ source, target }` instead of backend `AgentIR`'s `{ from_node, to_node }`, and `mapBackendSpecToAgentItem` (`src/lib/api.ts:128-149`) hardcodes `totalRuns: 0` and defaults `successRate` to `100` instead of deriving metrics from real runs.

---

### Screen 4: Live Agent Sandbox & Chatbot (`/sandbox/:specId`) — Completely Missing
- **Implemented:** Nothing in `src/app/sandbox/`; `/runs` and `/agents` call `createRunFromAgent()` with hardcoded `defaultInputs` (`amount_usd: 1250.0`, `"Apex Logistics Corp"` in `src/lib/store.ts:206-214`). Instead of a chat sandbox, inspecting a run goes to `/runs/[id]` ([run-detail-view.tsx](./src/components/runs/run-detail-view.tsx)).
- **Left vs `docs.md`:**
  - **1. Conversational Chat Terminal:** Missing user message input box, customer/request chat bubbles, system event pills, and agent response bubbles (`Send Test Trigger`).
  - **Dynamic Run Input Form / Modal:** No UI anywhere in `/agents` or `/runs` lets a user type task requirements (`customer_email`, `amount_usd`, `item_name`, `invoice_id`, free-text request) before triggering a run.
  - **2. Live SSE Execution Stream (Working End-to-End):** `api.createRunStream` uses browser `EventSource`, which cannot attach `Authorization: Bearer dev_token_deltix` in dev mode and gets `401` unless cookie auth or proxy auth injection is fixed; `api.startRun` also fails to unwrap `resp.run.run_id`, causing `store.ts` to create fake local runs.
  - **3. Live State / Memory / Integrity Inspector:** `RunDetailView` shows Graph DAG, Timeline, Checkpoints diff, Policy, and Raw JSON tabs when backend data matches, but `BackendCheckpoint` field names (`timestamp`, `full_state`, `state_delta`) do not match backend (`created_at`, `state_snapshot`), and `RunItem` has no Mem0 memory panel.

---

### Screen 5: Human Approval Gate (`/approvals`) — UI Built, Backend Decision Flow Broken
- **Implemented:** [src/app/approvals/page.tsx](./src/app/approvals/page.tsx) + [src/components/runs/approval-decision-panel.tsx](./src/components/runs/approval-decision-panel.tsx).
- **Left vs `docs.md`:**
  - **Required Operator Compliance Note on Approve:** `handleApprove` (`approval-decision-panel.tsx:43`) sends a hardcoded string `"Verified against vendor PO & invoices"` instead of letting the operator type an audit note (only Reject has a `<textarea>`).
  - **Target PayPal Payload & Grounded Evidence / Citations:** Needs real backend payload/citations from `PendingApproval` rather than static checklist labels.
  - **Backend Contract Bugs:** `mapBackendRunToRunItem` drops `pending_approval.approval_id`, so `store.ts` calls `POST /v1/approvals/{runId}/decide` instead of `{apr_id}`, and `api.decideApproval` sends `{ approval_status, decision_reason, approved_by }` instead of `{ decision: "APPROVED" | "REJECTED", reason }`. `store.ts` also fabricates a fake `atok_live_...` locally instead of persisting the resumed run response.

---

### Screen 6: Financial Audit & Compliance Ledger (`/audit` + `/ledger` + `/policies`) — Mock / Client-Derived Only
- **Implemented:**
  - `/audit` ([src/app/audit/page.tsx](./src/app/audit/page.tsx))
  - `/ledger` ([src/app/ledger/page.tsx](./src/app/ledger/page.tsx))
  - `/policies` ([src/app/policies/page.tsx](./src/app/policies/page.tsx))
- **Left vs `docs.md`:**
  - **Live Backend Audit Trail (`/audit`):** Currently derives synthetic `sha256_*` logs client-side from `runs`; missing real backend audit endpoint (`SEQ #`, real `action_intents`, PayPal idempotency key, PII sanitization status), cursor pagination (`Previous 20` / `Next`), Agent/Event/Date filters, search box, row click Cryptographic Record Inspector drawer, and CSV/PDF export (only JSON export exists).
  - **Live Settlement Ledger (`/ledger`):** Currently derives synthetic `REF-*` and `idem_sha256_*` rows client-side from `runs` instead of live settlement/PayPal payout records.
  - **Persistent Policy Rules (`/policies`):** Capabilities tab fetches live `GET /v1/capabilities`, but the Policy Rules matrix (`INITIAL_POLICIES` & `+ New Policy Rule`) is local React state only with no backend policy CRUD API.

---

## Cross-Cutting Items & Why Fake / Hardcoded Data Appears in the UI

1. **Google Auth Page / Login Flow Missing in Next.js Console:**
   - There is no `/login`, `/auth`, or Sign-In button on `/` in `frontend/src/app/`.
   - Console auto-authenticates via hardcoded `tenantId: "ten_dev_workspace"` (`src/lib/store.ts:54`) + fallback `Bearer dev_token_deltix` (`src/lib/api.ts:16`).
   - Console `TopBar` `Sign In` button omits `?tenant_id=...&redirect=true`, hitting `400 MISSING_TENANT_ID`.
2. **Where Real Data Ends & Fake / Hardcoded Data Begins:**
   - **Real:** Left-rail agent specs & YAML `nodes:` on `/agents` (`GET /v1/agents/specs`), Capabilities list on `/policies` (`GET /v1/capabilities`), and fetched runs/checkpoints when un-errored.
   - **Fake / Hardcoded:**
     - `totalRuns: 0` & `successRate: 100` in `mapBackendSpecToAgentItem` (`src/lib/api.ts:128-149`).
     - `Synthesized Node Execution Order` list (`1. [INGEST] ingest_invoice` ... `6. [TOOL] disburse_payout`) is static JSX in `agent-studio.tsx:234-241`.
     - `createRunFromAgent` sends hardcoded `$1,250 Apex Logistics Corp` inputs and falls back to fabricating a local `run_*` after `startRun` fails to unwrap `resp.run.run_id` (`src/lib/store.ts:206-273`).
     - `approveRun` fabricates a local `atok_live_*` token and marks status `COMPLETED` even if `decideApproval` fails (`src/lib/store.ts:301-347`).
     - Landing KPI strip (`$42.8M+`, `0.00%`, `14,200+`, `99.99%`), Policy Rules (`INITIAL_POLICIES`), Ledger (`REF-*`, `idem_sha256_*`), and Audit (`sha256_*`) are hardcoded or synthesized client-side.
3. **Client Quick-Start Flow Broken (`docs.md` Section 7):** Step 2 (NL prompt + clarification drawer), Step 3 (chat sandbox / live SSE), and Step 4 (real approval resume + audit trail) cannot complete end-to-end until the gaps above and the [src/lib/api.ts](./src/lib/api.ts) / [src/lib/store.ts](./src/lib/store.ts) contracts are aligned with the backend.
4. **Cancel / Retry Run Controls:** `Cancel run` and `Retry from checkpoint` in `run-detail-view.tsx` / `checkpoints-view.tsx` have no real backend cancel/retry endpoints wired.
5. **Local Node Tooling:** `DelTix/frontend/node_modules/.bin` is incomplete locally (`tsc` missing) until a clean `npm install` is run (or built via `DelTix/frontend/Dockerfile`).
