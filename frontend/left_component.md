# DelTix Frontend — Left / Missing Components & Integration Gaps (`left_component.md`)

**Status:** Incomplete for real end-to-end production use (UI shell & static/demo views exist, but multiple spec components, API contracts, and live data bindings remain unfinished).

---

## 1. Missing UI Components & Screens (Compared to `frontend/docs.md`)

1. **Interactive Clarification Drawer (`src/components/studio/`)**
   - `POST /v1/agents/compile` returns `status: "CLARIFICATION_REQUIRED"` with `clarification_questions[]` when a prompt is ambiguous.
   - Missing UI drawer/modal to display compiler questions + `suggestions`, collect answers (`clarifications`), and re-submit `compile`.

2. **Natural Language Prompt Composer & Spend Cap Sliders in Agent Studio (`src/components/studio/agent-studio.tsx`)**
   - Currently shows a static YAML `<textarea>` and passes raw YAML as `{ prompt }` instead of a dedicated natural-language prompt builder + spend-cap / approval-threshold inputs.
   - Missing live Graph Structure Preview synced to `compiledIR.nodes` (lines 234–241 of `agent-studio.tsx` currently render hardcoded placeholder steps).
   - Missing `yamlContent` reset when switching between agents in the left rail.

3. **Run Input Modal / Conversational Sandbox Trigger (`src/components/studio/agent-studio.tsx`, `src/components/runs/runs-table.tsx`)**
   - `Run in sandbox` and `+ Trigger Test Run` do not prompt the operator for dynamic `inputs` (`amount_usd`, `customer_email`, `item_name`, `invoice_id`, etc.) or provide the conversational chatbot + inline approval card described in `docs.md` Screen 4 (`/sandbox`).

4. **Pre-Flight Synthetic Test Scorecard Panel (`src/components/studio/agent-studio.tsx`)**
   - `CompileResponse` returns `synthetic_tests[]` and `validation_report`, which are not rendered as an interactive scorecard in Studio.

5. **Real Run Control Modals (`src/components/runs/run-detail-view.tsx`, `src/components/runs/checkpoints-view.tsx`)**
   - `Cancel run` and `Retry from checkpoint` call client-side stubs (`rejectRun` using `runId` / `retryRunFromCheckpoint` calling `GET /v1/runs/{id}`) instead of dedicated backend run-cancel / retry endpoints.

6. **Standalone Dashboard Overview Route (`/dashboard`)**
   - `docs.md` Screen 2 specifies a KPI overview (`/dashboard`) with settled volume, saved-by-caps metrics, and pending approval cards; currently `/` renders the onboarding landing story and console links jump straight to `/runs`.

7. **Dev/Demo Auth Session Helper / Auth Gate Handling**
   - `TopBar` only exposes `Sign In` (Google OAuth redirect); if Google OAuth is not configured locally, SSE (`EventSource`) fails with `401 UNAUTHORIZED` because browser `EventSource` cannot attach the `Authorization: Bearer dev_token_deltix` header that `fetch` sends.

---

## 2. Frontend <-> Backend Integration Mismatches (`src/lib/api.ts` & `src/lib/store.ts`)

1. **Compile Request/Response Contract (`api.ts:compilePrompt`)**
   - Frontend sends `{ prompt, category }` and reads `{ ir }`.
   - Backend (`agent-compiler-service`) expects `{ natural_language_prompt, name?, category?, clarifications? }` and returns `{ status, spec_id, agent_id, agent_ir, clarification_questions, validation_report, synthetic_tests, readiness_token }`.

2. **AgentSpec & Checkpoint Schema Mapping (`api.ts:BackendAgentSpec`, `BackendCheckpoint`)**
   - `BackendAgentSpec` expects `ir_payload` (`agent_name`, `capability`), while backend returns `agent_ir` (`nodes[].payload.capability_id`, `transitions[].from_node`, `transitions[].to_node`).
   - `BackendCheckpoint` expects `timestamp`, `full_state`, `state_delta`, while backend returns `created_at`, `state_snapshot`.

3. **Start Run Unwrap & Silent Mock Fallback (`api.ts:startRun`, `store.ts:createRunFromAgent`)**
   - `POST /v1/runs` returns `RunDetailResponse` (`{ run: { run_id, ... }, checkpoints, pending_approval }`), whereas `api.startRun` reads `resp.run_id` (`undefined`), triggering a 404 and causing `store.ts` to fall back to creating a fake local run.

4. **Approval Decision Contract & Approval ID (`api.ts:decideApproval`, `store.ts:approveRun` / `rejectRun`)**
   - Frontend sends `{ approval_id, approval_status, decision_reason, approved_by }` using `runId` (since `mapBackendRunToRunItem` drops `pending_approval.approval_id`).
   - Backend (`POST /v1/approvals/{approval_id}/decide`) requires the actual `apr_...` ID in the URL and body `{ decision: "APPROVED" | "REJECTED", reason }`.
   - `store.ts` fabricates `atok_live_...` locally instead of using the backend response's signed token and refreshing the resumed run.

---

## 3. Mock-Only Pages (No Live Backend Endpoints Wired)

1. **Spend Policies (`src/app/policies/page.tsx`)**
   - Capabilities list (`GET /v1/capabilities`) is live, but Policy Rules (`INITIAL_POLICIES` and `+ New Policy Rule`) only live in React local state with no backend policy CRUD persistence.
2. **Settlement Ledger (`src/app/ledger/page.tsx`)**
   - Derives synthetic `REF-*` and `idem_sha256_*` rows client-side from `runs` instead of querying real `action_intents` / PayPal settlement records.
3. **Cryptographic Audit Trail (`src/app/audit/page.tsx`)**
   - Generates synthetic client-side `sha256_*` event logs from `runs` instead of querying append-only backend `audit_events`.

---

## 4. Local Build / Tooling Note

- `frontend/node_modules/.bin` (`tsc` / `next`) is incomplete in the local workspace (`'tsc' is not recognized` when running `npm run typecheck`); run a clean `npm install` (or `npm ci`) in `DelTix/frontend/` before local dev/typechecking.
