# DelTix Integration, Auth, Docker & Route Audit Bug Report (`bug.md`)

Synced with [test.md](./test.md) and [frontend/left.md](./frontend/left.md).

---

## 1. Fixed & Verified Bugs

1. **Google OAuth Flow & Tenant Auth Integration (`frontend/src/app/login/page.tsx`, `src/app/page.tsx`, `src/components/shell/topbar.tsx`, `src/components/shell/app-shell.tsx`, `src/lib/api.ts`, `src/lib/store.ts`, `src/app/api/gateway/[...path]/route.ts`, `backend/api-gateway/handlers/gateway_handler.go` — FIXED)**
   - **Previous Bug:** No `/login` route existed; landing `Sign In with Google` linked straight to `/dashboard`; `TopBar` linked to `/v1/auth/google/login` without `?tenant_id=...` (`400 MISSING_TENANT_ID`) and read `sess?.user` instead of `sess?.session`; `api.ts` and Next.js proxy `route.ts` unconditionally injected `Bearer dev_token_deltix` + `org_prod_442` overriding real `deltix_session` cookies; `HandleGoogleCallback` returned raw JSON instead of redirecting back to frontend.
   - **Fix:** Added dedicated `/login` page (with Workspace Tenant selector, Google OAuth CTA, error banner, and explicit opt-in Dev Sandbox button when `NEXT_PUBLIC_ALLOW_DEV_AUTH=true`), configured `FRONTEND_URL=http://localhost:3000`, added browser `302` callback redirect to `${FRONTEND_URL}/dashboard?auth=google` (preserving JSON for `Accept: application/json`), removed forced `dev_token_deltix` proxy injection, wired unauthenticated console redirect to `/login`, and added `Sign Out` (`POST /v1/auth/logout`).
   - **Verification:** `go test -C backend/api-gateway ./...` (`TestGatewayGoogleCallbackBrowserRedirect`) passed; live Google OAuth sign-in verified reaching `http://localhost:3000/dashboard?auth=google` with authenticated user & `TENANT: org_prod_442`.

2. **Next.js 16 Proxy Param Type & Compiler `getSpec` Unwrap (`frontend/src/app/api/gateway/[...path]/route.ts`, `frontend/src/lib/api.ts`, `frontend/package.json` — FIXED)**
   - **Previous Bug:** Next.js 16 requires `context.params` to be `Promise<{ path: string[] }>` (blocking `next build` TypeScript validation); `api.getSpec()` did not unwrap `{ spec, trace_id }`; Next.js 16 Turbopack panicked spawning Windows PostCSS workers on `@xyflow/react/dist/style.css`.
   - **Fix:** Updated all HTTP methods in `route.ts` to `await context.params`, unwrapped `data.spec` in `api.getSpec()`, and updated `frontend/package.json` `build` script to `next build --webpack`.
   - **Verification:** `npm --prefix frontend run typecheck` exited `0`; `next build --webpack` completed TypeScript & compilation cleanly (`Compiled successfully`, `Finished TypeScript`; local Windows sandbox hit transient `mkdir EPERM` during static prerender).

3. **Memory Service Port Env Var Name (`backend/memory-service/config/config.py` — FIXED)**
   - **Previous Bug:** `.env.example` / `.env` defined `MEMORY_HTTP_PORT=8083` while `memory-service/config/config.py` only read `MEMORY_SERVICE_PORT`.
   - **Fix:** Updated `load_memory_config_from_env()` to read `MEMORY_HTTP_PORT` first with fallback to `MEMORY_SERVICE_PORT` (`8083`).
   - **Verification:** Python `load_memory_config_from_env()` + `validate_storage()` passed against root `.env`.

4. **Missing Frontend Dashboard, NL Studio & Chat Sandbox Routes + Core Contract Fixes (FIXED)**
   - Built `/dashboard` (`src/app/dashboard/page.tsx`), `/studio/new` (`src/app/studio/new/page.tsx` with Clarification Drawer & Synthetic Scorecard), and `/sandbox` / `/sandbox/[specId]` (`src/components/sandbox/sandbox-client.tsx` with live SSE stream).
   - Fixed `compilePrompt` (`natural_language_prompt`), `startRun` (`resp.run.run_id`), `decideApproval` (`approvalId` + `{ decision, reason }`), `getSpec` (`data.spec`), and removed duplicate inner `<AppShell>` wrappers from `/dashboard`, `/studio/new`, `/sandbox`, `/sandbox/[specId]`.

5. **Backend Rebase & PayPal Adapter Regressions (FIXED)**
   - `runtime_handler.go`: restored `sharedmodels` import and `cp.CheckpointID` / `sharedmodels.RunStatusPausedForApproval`.
   - `worker/api/grpc_server.py` & `executor_service.py`: restored stdlib imports and `/internal/v1/memory/{retrieve,store}` URLs.
   - `capability-policy-service/adapters/paypal_adapter.go`: mapped PayPal v2 `/v2/checkout/orders` and `/v2/invoicing/invoices` payloads cleanly.
   - **Verification:** All 5 Go test suites (`-count=1`), all 4 Go binary builds, and `worker` (`9 tests OK`) passed.

---

## 2. Active & Remaining Bugs / Limitations (Open)

1. **SSE Stream Auth in Explicit Dev Sandbox Mode (`401 UNAUTHORIZED`) (`frontend/src/lib/api.ts:640`, `backend/api-gateway/middleware/auth_middleware.go:91-106`)**
   - **Bug:** `api.createRunStream` uses browser `EventSource(url, { withCredentials: true })`, which sends the `HttpOnly` `deltix_session` cookie (so **Google OAuth works end-to-end**), but cannot send `Authorization: Bearer dev_token_deltix` if a user signs in via the explicit Dev Sandbox bypass button.
   - **Impact:** Live SSE (`/v1/runs/{run_id}/stream`) requires Google OAuth cookie auth (or replacing `EventSource` with `fetch` streaming when using Bearer tokens).

2. **`approveRun` / `rejectRun` Local Optimistic Fallback Masking (`frontend/src/lib/store.ts:308-360`)**
   - **Bug:** Unlike `createRunFromAgent` (which now throws backend errors cleanly), `approveRun` and `rejectRun` still catch backend failures with `console.warn` and locally flip status to `COMPLETED` / fabricate a random `atok_live_*` string instead of surfacing HTTP errors (`403`, `404`, `500`) to the UI.

3. **Mock / Client-Derived Console Pages & Unwired Controls (`frontend/src/app/audit/page.tsx`, `ledger/page.tsx`, `policies/page.tsx`, `store.ts:271-294`)**
   - `/policies` **Capabilities** tab fetches live `GET /v1/capabilities`, whereas **Policy Rules** (`INITIAL_POLICIES` & `+ New Policy Rule`) is local React state only (no backend policy CRUD endpoint).
   - `/ledger` and `/audit` derive settlement rows and `sha256_*` audit hashes client-side from `runs` (no dedicated backend `/v1/ledger` or `/v1/audit` HTTP endpoints exist yet).
   - `retryRunFromCheckpoint` (`store.ts:271-294`) only refreshes `GET /v1/runs/{run_id}` rather than calling a backend replay endpoint; **Cancel run** has no backend endpoint wired.

4. **Frontend Prerender & `memory-service` Host Test Tooling**
   - `npm --prefix frontend run build` (`next build --webpack`) compiles and passes Next.js TypeScript checks, but Windows sandbox blocks `mkdir` on `_not-found` / `_global-error` prerender directories (`EPERM`); run build/up via Docker or outside sandbox.
   - Host Python lacks `pytest` (`memory-service/tests/test_memory.py` passes syntax check and `load_memory_config_from_env()`, full pytest execution runs in container/venv with `requirements.txt`).
