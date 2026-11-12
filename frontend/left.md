# DelTix Frontend — Status & Remaining Items vs `docs.md` (`left.md`)

**Source of Comparison:** [docs.md](./docs.md) vs current implementation in `DelTix/frontend/src/` (synced with [../bug.md](../bug.md) and [../test.md](../test.md)).

---

## Completed Screens & Auth Fixes

1. **Google OAuth & Login Flow ([src/app/login/page.tsx](./src/app/login/page.tsx), [src/app/page.tsx](./src/app/page.tsx), [src/components/shell/topbar.tsx](./src/components/shell/topbar.tsx), [src/components/shell/app-shell.tsx](./src/components/shell/app-shell.tsx)):**
   - Dedicated `/login` screen with Workspace/Tenant ID selector, Google OAuth flow, callback error reporting, and optional Dev Sandbox bypass (`NEXT_PUBLIC_ALLOW_DEV_AUTH=true`).
   - Unauthenticated access to protected console routes redirects to `/login?next=...`.
   - `TopBar` shows real Google OAuth user name/avatar + **Sign Out** button (`POST /v1/auth/logout`); Next.js proxy `/api/gateway/[...path]/route.ts` no longer injects `Bearer dev_token_deltix` over real `deltix_session` cookies.
2. **Client Main Dashboard ([src/app/dashboard/page.tsx](./src/app/dashboard/page.tsx)):**
   - Implemented with live tenant badge (`tenantId` from verified session), computed KPI cards (*Total Settled Volume*, *Active Agents*, *Pending Approvals*, *Protected by Caps*), quick links, and recent executions table.
3. **Agent Compiler Studio ([src/app/studio/new/page.tsx](./src/app/studio/new/page.tsx)):**
   - Implemented with template selector, NL prompt composer, max spend/approval threshold inputs, tool toggles, **Interactive Clarification Drawer** (`CLARIFICATION_REQUIRED`), **Pre-Flight Synthetic Tests** scorecard, and HMAC `readiness_token` display.
4. **Live Agent Chatbot Sandbox ([src/app/sandbox/page.tsx](./src/app/sandbox/page.tsx), [src/app/sandbox/\[specId\]/page.tsx](./src/app/sandbox/%5BspecId%5D/page.tsx), [src/components/sandbox/sandbox-client.tsx](./src/components/sandbox/sandbox-client.tsx)):**
   - Implemented with conversational chat composer, preset pills (`$38 Auto-Refund`, `$150 Approval Gate`), `order_id` / `amount_usd` / `customer_email` inputs, live SSE checkpoint stream, and approval alert box.
5. **Human Approval Gate Panel ([src/components/runs/approval-decision-panel.tsx](./src/components/runs/approval-decision-panel.tsx)):**
   - Operator compliance note input now editable for **Approve** decisions as well as **Reject**, and `api.decideApproval` sends `{ decision, reason }` to `/v1/approvals/{approval_id}/decide`.

---

## What Is Still Left / Mocked (Open Gaps)

1. **Backend Audit & Ledger Endpoints ([src/app/audit/page.tsx](./src/app/audit/page.tsx), [src/app/ledger/page.tsx](./src/app/ledger/page.tsx)):**
   - Both pages currently synthesize table rows client-side from `runs` (no dedicated backend `GET /v1/audit` or `GET /v1/ledger` API exists yet; no server-side pagination or CSV/PDF export).
2. **Persistent Policy Rules CRUD ([src/app/policies/page.tsx](./src/app/policies/page.tsx)):**
   - The **Capabilities** tab reads live `GET /v1/capabilities`, whereas **Policy Rules** (`INITIAL_POLICIES` & `+ New Policy Rule`) only saves to local React state.
3. **Approval Optimistic Fallback in Store ([src/lib/store.ts](./src/lib/store.ts)):**
   - `approveRun` / `rejectRun` catch remote errors and still apply local `COMPLETED`/`REJECTED` state instead of failing loudly.
4. **Run Cancel / Retry Backend Endpoints & Landing Extras:**
   - `retryRunFromCheckpoint` in `store.ts` only re-fetches `GET /v1/runs/{run_id}` (no replay endpoint); `Cancel run` has no backend endpoint; landing page KPI strip (`$42.8M+`, etc.) is marketing copy and `Book Demo` does not submit a backend lead form.
5. **Dev-Mode SSE Limitation:**
   - Browser `EventSource` relies on the Google OAuth `deltix_session` cookie (`withCredentials: true`) and does not attach `Authorization: Bearer dev_token_deltix` if signed in via Dev Sandbox bypass (`bug.md` §2.1).
