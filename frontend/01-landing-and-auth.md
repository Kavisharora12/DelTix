# 01 — Landing Page & Google OAuth Workspace Authentication

This document defines the exact **page content** and **UI components** for the public Landing Page (`/`) and Google OAuth 2.0 Session Flow (`/auth/callback`) backed by **`backend/api-gateway`**.

---

## 1. Landing Page (`/`) — Page Content

### A. Top Navigation Bar Content
- **Brand Identity:** `DelTix` logo mark + badge `PayPal AI Agent Compiler`
- **Navigation Links:**
  - `How It Works` (scrolls to 4-Stage Compiler Pipeline section)
  - `7 Safety Guardrails` (scrolls to Deterministic Guardrails section)
  - `Agent IR v1.0` (scrolls to Canonical IR Contract preview)
- **Right Action Area:**
  - If unauthenticated: Primary CTA button **`Sign in with Google`**
  - If authenticated (`/v1/auth/me` returns 200): Workspace Pill (`Tenant: {tenant_id}`) + **`Open Compiler Studio`** CTA

### B. Hero Section Content
- **Eyebrow Badge:** `DETERMINISTIC FINANCIAL AI COMPILER`
- **Main Headline:** **Describe it. Compile it. Verify it.**
- **Sub-Headline:**
  > Never let a raw LLM prompt touch a payment API directly. DelTix compiles natural-language financial workflows into deterministic **Agent IR v1.0** state graphs—enforcing budget caps, cycle-free topology, human approval gates, and pre-flight dry-run tests before issuing a cryptographic readiness token.
- **Primary CTA:** **`Start Compiling Agents`** (opens `WorkspaceLoginModal` if signed out, or navigates to `/studio/compile` if signed in)
- **Secondary CTA:** **`Explore the 7 Guardrails`**
- **Hero Visual Preview Card (Static Content):**
  - Left side: Prompt snippet *"Refund customer PayPal captures when an item is damaged."*
  - Center arrow: `7-Guardrail Compiler`
  - Right side: Verified badges (`Max Budget: $75.00`, `Approval Gate: Required`, `Pre-Flight Tests: 3/3 Passed`, `Token: rtok_9f8a...`)

### C. "How Compilation Works" Section Content (4 Cards)
1. **Stage 1 — Ambiguity & Constraint Check:** Detects money-moving intent (`refund`, `capture`, `create order`) and pauses to ask clarifying questions if `max_budget_usd` or `require_human_approval` is missing.
2. **Stage 2 — Canonical `AgentIR` v1.0 Synthesis:** Translates intent into a typed directed graph (`MEMORY_RETRIEVAL` ➡️ `LLM_REASONING` ➡️ `HUMAN_APPROVAL` ➡️ `TOOL_EXECUTION` ➡️ `MEMORY_UPDATE` ➡️ `TERMINAL`).
3. **Stage 3 — Static Graph & Policy Verification:** Runs BFS reachability, backward terminal sink analysis, DFS cycle detection, read-only isolation, and PayPal capability allowlist checks.
4. **Stage 4 — Pre-Flight Dry Run & HMAC Signing:** Executes 3 synthetic PayPal Sandbox test scenarios (`happy_path`, `policy_budget_boundary`, `malformed_input`) and signs an HMAC-SHA256 `readiness_token`.

### D. "The 7 Deterministic Guardrails" Section Content (Grid of 7 Cards)
1. **Missing Financial Constraint Gate:** Blocks compilation of mutating prompts until USD budget and approval rules are explicitly answered.
2. **PayPal Capability Allowlist:** Restricts tools strictly to verified contracts (`paypal.orders.create`, `paypal.orders.get`, `paypal.orders.capture`, `paypal.captures.refund`, `paypal.transactions.list`).
3. **Orphan & Dead-End Graph Prevention:** Forward and backward BFS guarantee every node starts from the entry node and reaches a terminal sink.
4. **Infinite Payment Loop Prevention:** DFS cycle detector rejects unbounded loops and enforces `max_steps <= 50` and `timeout_seconds <= 300`.
5. **Read-Only Mode Isolation:** Agents marked `read_only: true` are mathematically blocked from referencing any mutating PayPal capability.
6. **Budget Ceiling Enforcement:** Mutating agents must declare a positive `max_budget_usd` within the `$10,000.00` sandbox ceiling.
7. **Mandatory Human-in-the-Loop Gate:** Sensitive tools (`paypal.captures.refund`, `paypal.orders.capture`) cannot compile without an approval gate.

### E. Footer Content
- **Left:** `DelTix Platform — Built on Go 1.23, Supabase PostgreSQL, and Upstash Redis`
- **Right:** Live Gateway Status Indicator (`GET /healthz` ➡️ `api-gateway: ok` + current `trace_id`)

---

## 2. Landing & Auth UI Components

### `TopNavigationBar`
- **Purpose:** Persistent header across public and studio views.
- **Displays:** Brand title, navigation links, and either the `SignInTriggerButton` or `AuthenticatedUserPill`.

### `WorkspaceLoginModal`
- **Purpose:** Collects the user's target `tenant_id` workspace identifier and starts the Google OAuth flow.
- **Content & Inputs:**
  - Title: `Sign in to DelTix Workspace`
  - Input Field: `Workspace / Tenant ID` (placeholder: e.g., `ten_paypal_sandbox_01`, required)
  - Primary Action Button: **`Continue with Google`**
- **API Integration:**
  - Calls `GET /v1/auth/google/login?tenant_id={tenant_id}` (or redirects with `&redirect=true`) and navigates browser to the returned `auth_url`.

### `OAuthCallbackHandlerView` (`/auth/callback`)
- **Purpose:** Handles the redirect from Google OAuth (`?state=...&code=...`).
- **Content:**
  - Loading spinner with text: `Verifying Google identity & provisioning tenant workspace...`
  - Error state card (if `400 INVALID_OAUTH_CALLBACK` or `401 INVALID_OAUTH_STATE` RFC 7807 error is returned): displays `detail` and `trace_id` with a `Try Again` button.
- **API Integration:**
  - Calls `GET /v1/auth/google/callback?state={state}&code={code}`, stores the returned `session` in client state (`deltix_session` `HttpOnly` cookie is set automatically), and redirects to `/studio/compile`.

### `UserProfileMenu`
- **Purpose:** Displays the logged-in operator's identity from `GET /v1/auth/me`.
- **Displays:**
  - User Avatar (`session.picture`), Full Name (`session.name`), Email (`session.email`)
  - Active Tenant Badge (`session.tenant_id`)
  - Session Expiration Timestamp (`session.expires_at`)
  - **`Sign Out`** button (calls `POST /v1/auth/logout` and returns to `/`).

### `ProblemDetailErrorBanner`
- **Purpose:** Global RFC 7807 error banner for API Gateway responses (`401 SESSION_EXPIRED`, `429 RATE_LIMIT_EXCEEDED`, `501 DOWNSTREAM_API_TODO`).
- **Displays:** `title`, `error_code` badge, human-readable `detail`, `Retry-After` countdown (on `429`), and copyable `trace_id`.
