# DelTix End-to-End Test Plan & Verification Matrix (`test.md`)

Synced with [bug.md](./bug.md) and [frontend/left.md](./frontend/left.md).

---

## 1. Dockerization & Private Bridge Coverage (`docker-compose.yml`)

All **7 runnable services** in the workspace now have multi-stage Dockerfiles and compose entries connected over the private `deltix-network` (`deltix-internal-network`) bridge:

| # | Service | Dockerfile | Port Exposure | Healthcheck | Compose Dependencies | Status |
|---|---|---|---|---|---|---|
| 1 | `frontend` | [frontend/Dockerfile](./frontend/Dockerfile) | `127.0.0.1:3000:3000` (Public UI) | `wget http://127.0.0.1:3000/` | `api-gateway` (`service_healthy`) | Dockerized — build/up pending host verification |
| 2 | `api-gateway` | [backend/api-gateway/Dockerfile](./backend/api-gateway/Dockerfile) | `127.0.0.1:8080:8080` (Edge API) | `wget http://localhost:8080/healthz` | compiler, runtime, capability, memory (`service_healthy`) | Dockerized |
| 3 | `agent-compiler-service` | [backend/agent-compiler-service/Dockerfile](./backend/agent-compiler-service/Dockerfile) | `expose: 8081` (Bridge only) | `wget http://localhost:8081/healthz` | — | Dockerized |
| 4 | `agent-runtime-service` | [backend/agent-runtime-service/Dockerfile](./backend/agent-runtime-service/Dockerfile) | `expose: 8082` (Bridge only) | `wget http://localhost:8082/healthz` | `agent-runtime-worker` (`service_healthy`) | Dockerized |
| 5 | `memory-service` | [backend/memory-service/Dockerfile](./backend/memory-service/Dockerfile) | `expose: 8083` (Bridge only) | `curl -f http://localhost:8083/healthz` | — | Dockerized |
| 6 | `capability-policy-service` | [backend/capability-policy-service/Dockerfile](./backend/capability-policy-service/Dockerfile) | `expose: 8084` (Bridge only) | `wget http://localhost:8084/healthz` | — | Dockerized |
| 7 | `agent-runtime-worker` | [backend/agent-runtime-service/worker/Dockerfile](./backend/agent-runtime-service/worker/Dockerfile) | `expose: 8085` (Bridge only) | `curl -f http://localhost:8085/healthz` | capability, memory (`service_healthy`) | Dockerized |

*(Note: `backend/shared` is a library module imported during Go builds; root `.dockerignore` keeps `node_modules` and `.env` out of backend build contexts.)*

### Compose Bring-Up & Bridge Isolation Tests
| Test ID | Check | Command / Action | Expected Result | Synced Bug |
|---|---|---|---|---|
| **DOC-01** | Compose config valid | `docker compose config --quiet` | Exit `0`, no schema/interpolation errors | Pending host run |
| **DOC-02** | Full stack build & healthy boot | `docker compose up -d --build` + `docker compose ps` | All 7 containers `healthy` / `running` | Pending host run |
| **DOC-03** | Internal ports hidden from host | Attempt HTTP `http://127.0.0.1:8081..8085/healthz` from host | Connection refused (only `3000` & `8080` bound) | — |
| **DOC-04** | Frontend -> Gateway bridge call | `curl http://127.0.0.1:3000/api/gateway/healthz` | `200 OK` proxied via `http://api-gateway:8080/healthz` | — |
| **DOC-05** | Frontend env secret isolation | `docker exec deltix-frontend env` | Contains `NEXT_PUBLIC_*` / `API_GATEWAY_INTERNAL_URL` only; zero PayPal/Gemini/Supabase/Redis secrets | — |

---

## 2. Automated Unit & Module Tests (Latest Execution Status)

| Suite | Command | Latest Observed Result | Synced Bug |
|---|---|---|---|
| **Go Shared** | `go test -C DelTix/backend/shared ./...` | PASS (`auth`, `models` ok) | — |
| **Go API Gateway** | `go test -C DelTix/backend/api-gateway ./...` | PASS (`tests` ok) | — |
| **Go Compiler** | `go test -C DelTix/backend/agent-compiler-service ./...` | PASS (`tests` ok) | — |
| **Go Runtime** | `go test -C DelTix/backend/agent-runtime-service ./...` | PASS (`tests` ok) | Fixed in `bug.md` §1.1 |
| **Go Capability & Policy** | `go test -C DelTix/backend/capability-policy-service ./...` | PASS (`tests` ok) | Fixed in `bug.md` §1.4 |
| **Python Worker** | `python -m unittest DelTix/backend/agent-runtime-service/worker/tests/test_worker.py` | PASS (`Ran 9 tests in 3.036s`, `OK`) | Fixed in `bug.md` §1.2–1.3 |
| **Python Memory Service** | `python -m pytest DelTix/backend/memory-service/tests/test_memory.py -v` | FAIL on host (`No module named pytest`) | `bug.md` §2.4 |
| **Frontend Typecheck** | `npm --prefix DelTix/frontend run typecheck` | FAIL on host (`'tsc' is not recognized`) | `bug.md` §3.9 |

---

## 3. End-to-End Route Matrix (Auth -> Execution -> UI)

### 3A. Gateway Auth & Health Routes (`:8080` / `/api/gateway`)
| ID | Method & Route | Auth | Purpose / Test Assertion | Current Status |
|---|---|---|---|---|
| **AUTH-01** | `GET /healthz` | Public | Gateway liveness `{ status: "ok", service: "api-gateway" }` | Works |
| **AUTH-02** | `GET /v1/auth/google/login?tenant_id=...&redirect=true` | Public | Generates Google OAuth state in Redis & redirects to Google (requires `tenant_id`!) | Backend works; UI TopBar button broken (`bug.md` §2.1) |
| **AUTH-03** | `GET /v1/auth/google/callback?state=...&code=...` | Public | Validates state, upserts user/tenant in Postgres, sets `HttpOnly` `deltix_session` cookie | Works with real Google OAuth creds |
| **AUTH-04** | `GET /v1/auth/me` | Protected | Valid session cookie OR `Bearer dev_token_deltix` (when `GATEWAY_ALLOW_DEV_AUTH=true`) returns `session`; unauth returns `401` | Works |
| **AUTH-05** | `POST /v1/auth/logout` | Protected | Revokes Redis session and expires `deltix_session` cookie | Works |
| **AUTH-06** | Rate Limit Enforcement | Protected | Exceeding `GATEWAY_RATE_LIMIT_PER_MIN` returns `429` | Works |

### 3B. Agent Compiler Routes (`:8080 -> :8081`)
| ID | Method & Route | Auth | Purpose / Test Assertion | Current Status |
|---|---|---|---|---|
| **CMP-01** | `GET /healthz` (`:8081` internal) | Internal | Returns compiler health OK | Works |
| **CMP-02** | `POST /v1/agents/compile` | Protected | Valid `{ natural_language_prompt }` returns `READY` + `agent_ir` + `validation_report` + `readiness_token` (or `CLARIFICATION_REQUIRED` + `clarification_questions`) | Backend works; Frontend sends wrong payload (`bug.md` §3.5) |
| **CMP-03** | `POST /v1/agents/compile` (invalid/empty) | Protected | Empty prompt returns `400 EMPTY_PROMPT` | Works |
| **CMP-04** | `GET /v1/agents/specs` | Protected | Lists tenant-scoped compiled specs (`specs[]`) | Backend works; Frontend `BackendAgentSpec` expects `ir_payload` (`bug.md` §3.8) |
| **CMP-05** | `GET /v1/agents/specs/{spec_id}` | Protected | Fetches spec by ID with tenant isolation (`404` across tenants) | Works |

### 3C. Agent Runtime & SSE Routes (`:8080 -> :8082`)
| ID | Method & Route | Auth | Purpose / Test Assertion | Current Status |
|---|---|---|---|---|
| **RUN-01** | `GET /healthz` (`:8082` internal) | Internal | Returns runtime control-plane health OK | Works |
| **RUN-02** | `POST /v1/runs` | Protected | Acquires Redis run lock, invokes worker, returns `RunDetailResponse` (`{ run, checkpoints, pending_approval }`) | Backend works; Frontend fails to unwrap `resp.run.run_id` (`bug.md` §3.6) |
| **RUN-03** | `GET /v1/runs` | Protected | Lists runs scoped by `X-Tenant-ID` | Works |
| **RUN-04** | `GET /v1/runs/{run_id}` | Protected | Returns `run`, ordered `checkpoints` (`CheckpointID`, `state_snapshot`, `created_at`), and `pending_approval` | Backend works; Frontend checkpoint field mismatch (`bug.md` §3.8) |
| **RUN-05** | `GET /v1/runs/{run_id}/stream` | Protected | Streams SSE events until `status.IsTerminal()` or `PAUSED_FOR_APPROVAL` | Rebase fixed on backend; Browser SSE fails with `401` in dev mode (`bug.md` §2.2) |
| **RUN-06** | `POST /internal/v1/runs/{run_id}/resume` | Internal (`:8084 -> :8082`) | Resumes paused graph on `APPROVED` token or marks `REJECTED` | Works |

### 3D. Capability, Policy, Approvals & PayPal Sandbox Routes (`:8080 -> :8084`)
| ID | Method & Route | Auth | Purpose / Test Assertion | Current Status |
|---|---|---|---|---|
| **CAP-01** | `GET /healthz` (`:8084` internal) | Internal | Returns capability/policy service health OK | Works |
| **CAP-02** | `GET /v1/capabilities` | Protected | Lists registered PayPal Sandbox capabilities from Postgres | Live in `/policies` Capabilities tab |
| **CAP-03** | `POST /internal/v1/tools/dispatch` | Internal (`:8085 -> :8084`) | Enforces policy thresholds, records idempotency intent, formats `/v2/checkout/orders` & `/v2/invoicing/invoices` bodies, returns `PAUSED_FOR_APPROVAL` (`apr_...`) or executes PayPal Sandbox call | Fixed in `bug.md` §1.4; container rebuild needed |
| **CAP-04** | `POST /v1/approvals/{approval_id}/decide` | Protected | Accepts `{ decision: "APPROVED" \| "REJECTED", reason }`, signs HMAC `approval_token`, triggers `/internal/v1/runs/{run_id}/resume` | Backend works; Frontend sends wrong ID & body (`bug.md` §3.7) |

### 3E. Worker & Memory Internal Routes (`:8085` & `:8083`)
| ID | Method & Route | Caller | Purpose / Test Assertion | Current Status |
|---|---|---|---|---|
| **WRK-01** | `GET /healthz` (`:8085`) | Docker / Runtime | Reports Gemini models, PayPal toolkit config, LangSmith flag | Unit-tested in `test_worker.py` |
| **WRK-02** | `POST /internal/v1/worker/execute` | Runtime (`:8082`) | Runs LangGraph DAG via Gemini cascade, `:8083` memory, `:8084` tool dispatcher | Unit-tested in `test_worker.py` |
| **WRK-03** | `POST /internal/v1/worker/resume` | Runtime (`:8082`) | Resumes paused DAG with `APPROVED` + signed `approval_token` or aborts on `REJECTED` | Unit-tested in `test_worker.py` |
| **MEM-01** | `GET /healthz` (`:8083`) | Docker / Worker | Returns `{ status: "ok" }` | Works |
| **MEM-02** | `POST /internal/v1/memory/retrieve` & `/search` | Worker (`:8085`) | Enforces `X-Tenant-ID == request.tenant_id`, respects `max_limit`, queries Mem0 | Aligned in `executor_service.py`; `pytest` missing on host |
| **MEM-03** | `POST /internal/v1/memory/store` & `/add` | Worker (`:8085`) | Stores tenant/agent messages in Mem0 | Aligned in `executor_service.py` |
| **MEM-04** | `DELETE /internal/v1/memory/{memory_id}`, `DELETE /tenant/{tenant_id}`, `POST /prune` | Admin / Cleanup | Enforces tenant header isolation & prunes stale entries | Implemented; needs container pytest check |

### 3F. Frontend Pages & Proxy Route (`:3000`)
| ID | Route | Expected Behavior | Current Status |
|---|---|---|---|
| **UI-01** | `ALL /api/gateway/[...path]` | Proxies requests & SSE streams to `API_GATEWAY_INTERNAL_URL` over `deltix-network` | Implemented ([route.ts](./frontend/src/app/api/gateway/%5B...path%5D/route.ts)); live compose verification pending |
| **UI-02** | `/` | Landing showcase (`StickmanStory` + `InteractiveSimulator`) | UI built; landing Sign-In / prompt playground from `docs.md` left (`frontend/left.md`) |
| **UI-03** | `/agents` | Compile prompt/IR & trigger sandbox run | Broken compile contract, missing NL prompt/Clarification Drawer/scorecard (`bug.md` §3.5) |
| **UI-04** | `/runs` & `/runs/[id]` | Live runs table, DAG graph, Timeline, Checkpoints, Policy, Raw | `startRun` unwrap & checkpoint/SSE bugs (`bug.md` §2.2, §3.6, §3.8) |
| **UI-05** | `/approvals` | Operator sign-off queue + decision panel | Broken approval ID & body (`bug.md` §3.7) |
| **UI-06** | `/policies` | Capabilities matrix (live) + Policy rules (local state) | Capabilities live; rules local-only (`bug.md` §3.9) |
| **UI-07** | `/ledger` & `/audit` | Settlement ledger & SHA-256 compliance trail | Client-derived synthetic data (`bug.md` §3.9) |
| **UI-08** | `/dashboard` & `/sandbox` | Dashboard KPI overview & conversational chatbot sandbox from `docs.md` | Not implemented (`frontend/left.md`) |

---

## 4. Recommended Live Verification Order (Once Local `npm install` + `docker compose up -d --build` Runs)

1. Run `docker compose config --quiet` and `docker compose up -d --build` in `DelTix/`.
2. Verify bridge proxy & auth: `GET http://127.0.0.1:3000/api/gateway/healthz` -> `200`, and `GET /api/gateway/v1/auth/me` with `Authorization: Bearer dev_token_deltix` (if `GATEWAY_ALLOW_DEV_AUTH=true`).
3. Verify compiler-to-PayPal backend pipeline through gateway: `POST /v1/agents/compile` -> `POST /v1/runs` (small amount -> auto `COMPLETED`, high amount -> `PAUSED_FOR_APPROVAL`) -> `POST /v1/approvals/{apr_id}/decide` -> resumed `COMPLETED` + real PayPal Sandbox record.
4. Fix open integration bugs in `bug.md` §2–3 before expecting full UI browser E2E testing to pass without local mock fallbacks.
