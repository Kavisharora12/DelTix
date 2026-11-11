# DelTix Integration & Audit Bug Report

## 1. Git Rebase Regressions (Fixed & Verified)

Rebasing `58470e3` onto `168203c` (merging `origin/d-frontend` / `f9233e5` / `4191954`) left compilation and runtime regressions across the backend services. These have been repaired and verified with unit tests:

1. **`backend/agent-runtime-service/handlers/runtime_handler.go` (Compile Failure — FIXED)**
   - **Cause:** Missing `sharedmodels "github.com/deltix/shared/models"` import, stale `cp.ID` field reference (actual field: `cp.CheckpointID`), and undefined `runtimemodels.RunStatus*` constants in `HandleStreamRun`.
   - **Fix:** Restored `sharedmodels` import, updated `cp.ID` -> `cp.CheckpointID`, and replaced status checks with `status.IsTerminal() || status == sharedmodels.RunStatusPausedForApproval`.
   - **Verification:** `go test -C DelTix/backend/agent-runtime-service ./...` passed.

2. **`backend/agent-runtime-service/worker/api/grpc_server.py` (Runtime ImportError — FIXED)**
   - **Cause:** Rebase dropped `import asyncio`, `from concurrent import futures`, `import json`, and `import os`, while keeping unused `PayPalAgentToolkitDispatcher`.
   - **Fix:** Restored standard library imports, removed unused import, and preserved `tool_dispatcher = http_dispatcher` (`capability-policy-service:8084` policy/audit invariant).
   - **Verification:** `python -m unittest DelTix/backend/agent-runtime-service/worker/tests/test_worker.py` (9/9 OK).

3. **`backend/agent-runtime-service/worker/services/executor_service.py` (Memory Endpoint Mismatch — FIXED)**
   - **Cause:** Rebase reverted `HTTPMemoryClient` to stale memory URLs/headers.
   - **Fix:** Restored `/internal/v1/memory/retrieve` (`X-Tenant-ID`, `limit`) and `/internal/v1/memory/store` (`X-Tenant-ID`, `messages`), and added `test_worker_healthz_and_http_memory_endpoints`.
   - **Verification:** `test_worker.py` (9/9 OK).

4. **`backend/capability-policy-service/adapters/paypal_adapter.go` (Flat Input & Toolkit Payload Formatting — FIXED)**
   - **Cause:** Rebase routed all PayPal tool executions through `:8084`, which forwarded raw flat inputs (e.g., `amount_usd`, `customer_email`, `item_name`) or raw toolkit `items` directly to PayPal REST endpoints instead of PayPal v2 schemas.
   - **Fix:** Added `isFlatPayPalInputKey`, `firstNonEmptyString`, `toFloat64`, `extractPositiveAmount`, and updated `dispatchDynamicRESTCall` + `buildPayPalRequestBody` for `/v2/checkout/orders` (`intent` + `purchase_units`) and `/v2/invoicing/invoices` (`detail` + `primary_recipients` + `items`). Added `TestPayPalAdapterFormatsOrderAndInvoiceCreateBodies`.
   - **Verification:** `go test -C DelTix/backend/capability-policy-service ./...` passed.

---

## 2. Frontend Completeness & Backend-Frontend Integration Bugs (Pending Fix & Verification)

Audit of `DelTix/frontend` against `DelTix/backend` services (`:8080` API Gateway, `:8081` Compiler, `:8082` Runtime, `:8084` Capability/Policy):

### Blocking API / Schema Mismatches
1. **Compile Prompt Request/Response Mismatch (`src/lib/api.ts`, `src/components/studio/agent-studio.tsx`)**
   - `api.compilePrompt` sends `{ prompt, category }`, whereas `POST /v1/agents/compile` requires `{ natural_language_prompt }` (returns `400 EMPTY_PROMPT` on `{ prompt }`).
   - UI expects `{ ir }`, whereas backend returns `{ agent_ir, status, clarification_questions, validation_report, spec_id }`.
   - `agent-studio.tsx` does not sync `yamlContent` when switching agents, compiles raw YAML string instead of a natural language prompt, and does not handle `CLARIFICATION_REQUIRED`.

2. **Start Run Response & Fallback Masking (`src/lib/api.ts`, `src/lib/store.ts`)**
   - `api.startRun` expects `{ run_id, status }`, whereas `POST /v1/runs` returns `RunDetailResponse` (`{ run: { run_id, ... }, checkpoints, pending_approval }`).
   - `store.ts` reads `resp.run_id` (`undefined`), triggers a 404 on `api.getRun(undefined)`, catches the error, and silently creates a local mock run instead of using the real backend run.

3. **Approval Decision & ID Mismatch (`src/lib/api.ts`, `src/lib/store.ts`)**
   - `api.decideApproval` sends `{ approval_id, approval_status, decision_reason, approved_by }`, whereas `POST /v1/approvals/{approval_id}/decide` expects `{ decision: "APPROVED" | "REJECTED", reason }`.
   - `mapBackendRunToRunItem` drops `pendingApproval.approval_id`, causing `store.ts` to submit `runId` instead of `apr_...` (404).
   - `store.ts` fabricates a fake `atok_live_...` locally instead of using the backend response's `approval_token` and refreshing the resumed run.

4. **Backend Spec & Checkpoint Field Name Mismatches (`src/lib/api.ts`)**
   - `BackendAgentSpec` expects `ir_payload` (`agent_name`, `capability`), while backend returns `agent_ir` (`nodes[].payload.capability_id`, `transitions[].from_node`/`to_node`).
   - `BackendCheckpoint` expects `timestamp`, `full_state`, `state_delta`, while backend returns `created_at`, `state_snapshot`.

5. **SSE Stream Authentication Failure in Browser (`src/lib/api.ts`, `backend/api-gateway/middleware/auth_middleware.go`)**
   - `api.createRunStream` uses `new EventSource(url, { withCredentials: true })`, which cannot attach `Authorization: Bearer dev_token_deltix`. Gateway `auth_middleware.go` only accepts `Bearer` header or `deltix_session` cookie (not query token), resulting in `401 UNAUTHORIZED` on SSE streams in dev mode.

6. **`GetRunDetail` Pending Approval Field (`backend/agent-runtime-service/services/runtime_service.go`)**
   - Needs verification/fix so `GET /v1/runs/{run_id}` populates `pending_approval` alongside `run` and `checkpoints` when paused for human approval.

### Missing / Mock-Only Frontend Flows & Dependency State
7. **Frontend Dependencies Not Installed:** `DelTix/frontend/node_modules` missing; `typecheck` and `build` not yet verified.
8. **Policy Rules Page (`src/app/policies/page.tsx`):** `GET /v1/capabilities` is live, but Policy Rules (`INITIAL_POLICIES` & "+ Add Policy Rule") are local React state only (no backend policy CRUD endpoint).
9. **Ledger & Audit Pages (`src/app/ledger/page.tsx`, `src/app/audit/page.tsx`):** Derive synthetic `REF-*`, `idem_sha256_*`, and `sha256_*` client-side from `runs` instead of live `action_intents` / `audit_events` backend endpoints.
10. **Checkpoint Retry (`src/lib/store.ts`):** `retryRunFromCheckpoint` only calls `api.getRun(runId)` (no backend retry endpoint).
