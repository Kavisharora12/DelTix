# DelTix Frontend — Content & Component Specification (Current Built Scope)

**Status:** Aligned with Completed Backend Services (**Workstream 1: API Gateway** & **Workstream 2: Agent Compiler Service**)  
**Scope Rule:** This documentation covers **only** the features and APIs currently built and live in the backend. Downstream features that currently return `501 DOWNSTREAM_API_TODO` (`agent-runtime-service`, `capability-policy-service`, `memory-service`) are explicitly marked as **Pending / Disabled UI Placeholders**.

---

## Live Backend APIs Powered by This Frontend

| Service | Method & Path | Purpose | Frontend View / Component |
| :--- | :--- | :--- | :--- |
| **API Gateway (`:8080`)** | `GET /healthz` | Gateway health status & `trace_id` | `SystemStatusBadge` (Footer / Topbar) |
| **API Gateway (`:8080`)** | `GET /v1/auth/google/login?tenant_id=...` | Initiates Google OAuth 2.0 flow with Redis CSRF state | `WorkspaceLoginModal` (`LandingPage`) |
| **API Gateway (`:8080`)** | `GET /v1/auth/google/callback` | Exchanges Google code, upserts Supabase `tenants` & `users`, sets `deltix_session` cookie | `OAuthCallbackScreen` (`/auth/callback`) |
| **API Gateway (`:8080`)** | `GET /v1/auth/me` | Returns active `UserSession` (`user_id`, `tenant_id`, `email`, `name`, `picture`) | `AuthSessionProvider` & `UserProfileMenu` |
| **API Gateway (`:8080`)** | `POST /v1/auth/logout` | Revokes Redis session and clears `deltix_session` cookie | `LogoutButton` (`TopNavigationBar`) |
| **Compiler Service (`:8081`)** | `POST /v1/agents/compile` | Runs the 7-guardrail compilation pipeline (Clarification loop, `AgentIR` synthesis, Topology & Policy validation, 3 Pre-Flight tests, `readiness_token`) | `AgentCompilerStudioPage` (`/studio/compile`) |
| **Compiler Service (`:8081`)** | `GET /v1/agents/specs?cursor=0&limit=20` | Lists tenant's compiled `AgentSpec` records via `seq_id` cursor pagination | `AgentSpecsLibraryPage` (`/studio/specs`) |
| **Compiler Service (`:8081`)** | `GET /v1/agents/specs/{spec_id}` | Fetches full `AgentSpec`, `AgentIR`, `ValidationReport`, and `readiness_token` | `AgentSpecDetailModal` (`/studio/specs/:specId`) |

---

## Frontend Documentation Files

1. **[`01-landing-and-auth.md`](./01-landing-and-auth.md)** — Public Landing Page, Value Proposition Content, 7-Guardrail Showcase, and Google OAuth Workspace Login Components.
2. **[`02-agent-compiler-studio.md`](./02-agent-compiler-studio.md)** — Interactive Prompt-to-`AgentIR` Compiler Studio, Missing Guardrail Clarification Drawer, Validation Scorecard, 3 Pre-Flight Mock Test Results, and Visual Graph Inspector.
3. **[`03-agent-specs-library.md`](./03-agent-specs-library.md)** — Compiled Agent Specifications Catalog (`seq_id` Cursor Paginated), Spec Detail Inspector, and Pending Runtime `TODO` Placeholders.
