# DelTix Integration, Docker & Route Audit Bug Report

Synced with [test.md](./test.md) and [frontend/left.md](./frontend/left.md).

---

## 1. Git Rebase & Infrastructure Regressions (Fixed & Verified)

1. **`backend/agent-runtime-service/handlers/runtime_handler.go` (Compile Failure — FIXED)**
   - **Cause:** Rebase dropped `sharedmodels "github.com/deltix/shared/models"`, used stale `cp.ID` instead of `cp.CheckpointID`, and referenced undefined `runtimemodels.RunStatus*`.
   - **Fix:** Restored import, `cp.CheckpointID`, and `status.IsTerminal() || status == sharedmodels.RunStatusPausedForApproval`.
   - **Verification:** `go test -C DelTix/backend/agent-runtime-service ./...` passed.

2. **`backend/agent-runtime-service/worker/api/grpc_server.py` (Runtime ImportError — FIXED)**
   - **Cause:** Rebase dropped `import asyncio`, `from concurrent import futures`, `import json`, `import os` while retaining unused `PayPalAgentToolkitDispatcher`.
   - **Fix:** Restored stdlib imports, removed unused import, kept `tool_dispatcher = http_dispatcher` (`:8084` policy/audit invariant).
   - **Verification:** `python -m unittest DelTix/backend/agent-runtime-service/worker/tests/test_worker.py` (`Ran 9 tests`, `OK`).

3. **`backend/agent-runtime-service/worker/services/executor_service.py` (Memory URL Mismatch — FIXED)**
   - **Cause:** Rebase reverted `HTTPMemoryClient` to stale endpoints.
   - **Fix:** Restored `/internal/v1/memory/retrieve` and `/internal/v1/memory/store` with `X-Tenant-ID`.
   - **Verification:** `test_worker.py` (`Ran 9 tests`, `OK`).

4. **`backend/capability-policy-service/adapters/paypal_adapter.go` (PayPal Payload Shape — FIXED)**
   - **Cause:** Flat inputs (`amount_usd`, `customer_email`, `item_name`) and raw toolkit `items` were forwarded unmodified to PayPal REST v2 endpoints.
   - **Fix:** Added PayPal v2 schema formatters for `/v2/checkout/orders` and `/v2/invoicing/invoices`.
   - **Verification:** `go test -C DelTix/backend/capability-policy-service ./...` passed.

5. **Whole-Project Dockerization & Bridge Isolation (`docker-compose.yml`, `frontend/Dockerfile`, `.dockerignore` — FIXED IN FILES, COMPOSE BUILD PENDING)**
   - **Fixed:** Added multi-stage `frontend/Dockerfile`, `frontend/.dockerignore`, root `.dockerignore`, `frontend/.env(.example)`, and runtime proxy `/api/gateway/[...path]` (`src/app/api/gateway/[...path]/route.ts`) so Next.js calls `http://api-gateway:8080` over `deltix-network` without exposing backend secrets or internal service ports (`8081`–`8085` changed from host `ports:` to `expose:` only; `agent-compiler-service` also given bridge `MEMORY_SERVICE_URL` and `CAPABILITY_POLICY_SERVICE_URL`).
   - **Remaining Check:** `docker compose config` / `docker compose up -d --build` has not yet been executed after these edits.

---

## 2. Active Backend, Auth & Configuration Bugs (Open)

1. **Google OAuth "Sign In" Link Fails (`400 MISSING_TENANT_ID`) (`frontend/src/components/shell/topbar.tsx:153` vs `backend/api-gateway/handlers/gateway_handler.go:114-129`)**
   - **Bug:** `TopBar` links directly to `${API_BASE}/v1/auth/google/login` with no query params. `HandleGoogleLogin` rejects requests without `?tenant_id=...` (`400 MISSING_TENANT_ID`) and returns JSON `{ auth_url }` instead of redirecting unless `&redirect=true` is also present.
   - **Impact:** Clicking **Sign In** in the UI fails with JSON `400` in the browser.

2. **SSE Stream Dev Auth Failure (`401 UNAUTHORIZED`) (`frontend/src/lib/api.ts:414-418`, `backend/api-gateway/middleware/auth_middleware.go:91-106`)**
   - **Bug:** `api.createRunStream` uses `new EventSource(url, { withCredentials: true })`, which cannot attach `Authorization: Bearer dev_token_deltix`. Gateway `ExtractSessionID` only checks `Authorization: Bearer ...` and the `deltix_session` cookie (not query param or dev cookie).
   - **Impact:** Live SSE updates (`/v1/runs/{run_id}/stream`) return `401` in browser dev mode (`GATEWAY_ALLOW_DEV_AUTH=true`) unless authenticated via Google OAuth session cookie or `fetch`-based SSE streaming.

3. **Memory Service Port Env Var Name Mismatch (`.env.example:60` vs `backend/memory-service/config/config.py:167`)**
   - **Bug:** `.env.example` documents `MEMORY_HTTP_PORT=8083`, whereas `memory-service/config/config.py` reads `MEMORY_SERVICE_PORT`. Works at default `8083`, fails if port is customized via `MEMORY_HTTP_PORT`.

4. **Host `pytest` Missing for `memory-service` Tests (`backend/memory-service/tests/test_memory.py`)**
   - **Bug / Gap:** `python -m pytest` fails on host (`No module named pytest`); `test_memory.py` uses pytest-style test functions and relative `api` imports so `python -m unittest` fails on host too. Requires `pip install -r requirements.txt` or running inside the Docker image.

---

## 3. Frontend <-> Backend Contract Bugs (Open — See [frontend/left.md](./frontend/left.md))

5. **Compile Endpoint Schema Mismatch (`frontend/src/lib/api.ts:352-357`, `frontend/src/components/studio/agent-studio.tsx:52-59`)**
   - Sends `{ prompt, category }` instead of `{ natural_language_prompt, category }` (`400 EMPTY_PROMPT`).
   - Reads `resp.ir` instead of `resp.agent_ir`.
   - `agent-studio.tsx` sends raw YAML instead of a natural-language prompt, ignores `CLARIFICATION_REQUIRED` + `clarification_questions`, ignores `synthetic_tests`, keeps hardcoded preview nodes, and does not sync `yamlContent` on agent change.

6. **Start Run Unwrap & Local Fallback Masking (`frontend/src/lib/api.ts:377-382`, `frontend/src/lib/store.ts:206-273`)**
   - `POST /v1/runs` returns `RunDetailResponse` (`{ run: { run_id, ... }, checkpoints, pending_approval }`), while `api.startRun` / `store.ts` reads `resp.run_id` (`undefined`), triggers `GET /v1/runs/undefined` (`404`), catches it, and silently creates a local mock run with hardcoded `Apex Logistics Corp` / `$1250` inputs.

7. **Approval Decision ID & Body Mismatch (`frontend/src/lib/api.ts:276-288, 387-402`, `frontend/src/lib/store.ts:303-360`)**
   - `mapBackendRunToRunItem` drops `pending_approval.approval_id`, causing `approveRun` / `rejectRun` to send `runId` instead of `apr_...` (`404`).
   - `api.decideApproval` sends `{ approval_id, approval_status, decision_reason, approved_by }` instead of `{ decision: "APPROVED" | "REJECTED", reason }`.
   - `store.ts` fabricates a fake `atok_live_...` locally instead of using the backend response and refreshing the resumed run.

8. **AgentSpec & Checkpoint Schema Mismatches (`frontend/src/lib/api.ts:25-80`)**
   - `BackendAgentSpec` expects `ir_payload` (`agent_name`, `capability`) while backend returns `agent_ir` (`nodes[].payload.capability_id`, `transitions[].from_node`/`to_node`).
   - `BackendCheckpoint` expects `timestamp`, `full_state`, `state_delta` while backend returns `created_at`, `state_snapshot`.

9. **Mock-Only / Unwired Frontend Flows (`frontend/src/app/policies/page.tsx`, `ledger/page.tsx`, `audit/page.tsx`, `run-detail-view.tsx`)**
   - No `/sandbox` chatbot route and no `/dashboard` overview route (see `frontend/left.md`).
   - Policies rules list, Ledger rows, and Audit logs are client-side/synthetic (only `GET /v1/capabilities` on Policies is live).
   - `Cancel run` and `Retry from checkpoint` have no backend endpoints wired.
   - Local `frontend/node_modules/.bin/tsc` is incomplete (`'tsc' is not recognized`) until a clean `npm install` finishes on host (Docker build handles `npm ci` internally).
