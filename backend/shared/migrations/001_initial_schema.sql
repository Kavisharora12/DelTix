-- ============================================================================
-- DELTIX — Complete Single-Database Schema (Supabase / PostgreSQL 16)
-- Pure DDL Schema Only — Zero Predefined or Seed Data
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ----------------------------------------------------------------------------
-- 1. TENANTS & USERS (Auth & Multi-Tenant Isolation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id   TEXT PRIMARY KEY,
    seq_id      BIGSERIAL UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_tenants_seq_id ON tenants (seq_id DESC);

CREATE TABLE IF NOT EXISTS users (
    user_id     TEXT PRIMARY KEY,
    seq_id      BIGSERIAL UNIQUE NOT NULL,
    tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    picture_url TEXT,
    role        TEXT NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    last_login  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_seq ON users (tenant_id, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ----------------------------------------------------------------------------
-- 2. CAPABILITY REGISTRY (Service 5: Dynamically Registered by Go Code)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capability_registry (
    capability_id        TEXT NOT NULL,
    version              TEXT NOT NULL DEFAULT '1.0.0',
    seq_id               BIGSERIAL UNIQUE NOT NULL,
    description          TEXT NOT NULL,
    parameters_schema    JSONB NOT NULL,
    output_schema        JSONB NOT NULL,
    is_sensitive         BOOLEAN NOT NULL DEFAULT FALSE,
    is_mutation          BOOLEAN NOT NULL DEFAULT FALSE,
    idempotent           BOOLEAN NOT NULL DEFAULT TRUE,
    timeout_seconds      INTEGER NOT NULL DEFAULT 15 CHECK (timeout_seconds > 0),
    max_retries          INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
    required_permissions TEXT[] NOT NULL DEFAULT '{}',
    status               TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPRECATED', 'DISABLED')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    PRIMARY KEY (capability_id, version)
);

CREATE INDEX IF NOT EXISTS idx_capability_registry_status_seq ON capability_registry (status, seq_id ASC);

-- ----------------------------------------------------------------------------
-- 3. AGENT SPECIFICATIONS (Service 2: Compiled & Validated Agent IR)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_specs (
    spec_id           TEXT PRIMARY KEY,
    seq_id            BIGSERIAL UNIQUE NOT NULL,
    agent_id          TEXT NOT NULL,
    version           TEXT NOT NULL DEFAULT '1.0.0',
    tenant_id         TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    name              TEXT NOT NULL,
    category          TEXT NOT NULL,
    ir_payload        JSONB NOT NULL,
    validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    readiness_token   TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'COMPILED' CHECK (status IN ('DRAFT', 'NEEDS_CLARIFICATION', 'COMPILED', 'REJECTED', 'ARCHIVED')),
    created_by        TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    UNIQUE (tenant_id, agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_specs_tenant_seq ON agent_specs (tenant_id, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_agent_specs_tenant_status_seq ON agent_specs (tenant_id, status, seq_id DESC);

-- ----------------------------------------------------------------------------
-- 4. AGENT COMPILATION LOGS (Service 2: Clarification & Test History)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_compilation_logs (
    log_id                TEXT PRIMARY KEY,
    seq_id                BIGSERIAL UNIQUE NOT NULL,
    tenant_id             TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    spec_id               TEXT REFERENCES agent_specs(spec_id) ON DELETE CASCADE,
    raw_prompt            TEXT NOT NULL,
    clarification_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    compiler_stage        TEXT NOT NULL,
    status                TEXT NOT NULL CHECK (status IN ('NEEDS_CLARIFICATION', 'PASSED', 'FAILED')),
    diagnostics           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_compilation_logs_tenant_seq ON agent_compilation_logs (tenant_id, seq_id DESC);

-- ----------------------------------------------------------------------------
-- 5. AGENT RUNS (Service 3: Stateful Execution State Machine)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_runs (
    run_id             TEXT PRIMARY KEY,
    seq_id             BIGSERIAL UNIQUE NOT NULL,
    spec_id            TEXT NOT NULL REFERENCES agent_specs(spec_id) ON DELETE RESTRICT,
    tenant_id          TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    triggered_by       TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    status             TEXT NOT NULL CHECK (status IN (
                           'INITIALIZING',
                           'RUNNING',
                           'PAUSED_FOR_APPROVAL',
                           'RESUMING',
                           'COMPLETED',
                           'FAILED',
                           'REJECTED'
                       )),
    current_step_index INTEGER NOT NULL DEFAULT 0,
    current_node_id    TEXT,
    cumulative_spend   NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cumulative_spend >= 0),
    inputs_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    state_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    final_output       JSONB,
    error_message      TEXT,
    started_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_seq ON agent_runs (tenant_id, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_status_seq ON agent_runs (tenant_id, status, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_recovery ON agent_runs (status, updated_at ASC) WHERE status = 'RUNNING';

-- ----------------------------------------------------------------------------
-- 6. AGENT RUN CHECKPOINTS (Service 3: Step-by-Step Resumable Snapshots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_run_checkpoints (
    checkpoint_id  TEXT PRIMARY KEY,
    seq_id         BIGSERIAL UNIQUE NOT NULL,
    run_id         TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
    tenant_id      TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    step_index     INTEGER NOT NULL CHECK (step_index >= 0),
    attempt_num    INTEGER NOT NULL DEFAULT 1 CHECK (attempt_num >= 1),
    node_id        TEXT NOT NULL,
    node_type      TEXT NOT NULL,
    node_input     JSONB NOT NULL DEFAULT '{}'::jsonb,
    node_output    JSONB NOT NULL DEFAULT '{}'::jsonb,
    state_snapshot JSONB NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('STARTED', 'SUCCEEDED', 'INTERRUPTED', 'FAILED')),
    duration_ms    BIGINT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    UNIQUE (run_id, step_index, attempt_num)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_run_step ON agent_run_checkpoints (run_id, step_index DESC, attempt_num DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_tenant_seq ON agent_run_checkpoints (tenant_id, seq_id DESC);

-- ----------------------------------------------------------------------------
-- 7. ACTION INTENTS (Service 5: Pre-Execution Payment Intent & Reconciliation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS action_intents (
    intent_id            TEXT PRIMARY KEY,
    seq_id               BIGSERIAL UNIQUE NOT NULL,
    run_id               TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE RESTRICT,
    tenant_id            TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    step_index           INTEGER NOT NULL,
    capability_id        TEXT NOT NULL,
    idempotency_key      TEXT NOT NULL UNIQUE,
    amount_usd           NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    request_payload      JSONB NOT NULL,
    response_payload     JSONB,
    provider_resource_id TEXT,
    status               TEXT NOT NULL CHECK (status IN (
                             'INTENT_RECORDED',
                             'DISPATCHED',
                             'UNKNOWN_NEEDS_RECONCILIATION',
                             'SUCCEEDED',
                             'FAILED'
                         )),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_action_intents_run_step ON action_intents (run_id, step_index);
CREATE INDEX IF NOT EXISTS idx_action_intents_reconcile ON action_intents (status, created_at ASC)
    WHERE status = 'UNKNOWN_NEEDS_RECONCILIATION';

-- ----------------------------------------------------------------------------
-- 8. APPROVAL REQUESTS (Service 5: Human-in-the-Loop Gatekeeping)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_requests (
    approval_id       TEXT PRIMARY KEY,
    seq_id            BIGSERIAL UNIQUE NOT NULL,
    run_id            TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
    tenant_id         TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    step_index        INTEGER NOT NULL,
    node_id           TEXT NOT NULL,
    capability_id     TEXT NOT NULL,
    action_summary    TEXT NOT NULL,
    requested_payload JSONB NOT NULL,
    amount_usd        NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    token_hash        TEXT NOT NULL UNIQUE,
    approved_by       TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    decision_reason   TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    expires_at        TIMESTAMPTZ NOT NULL,
    resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_tenant_status_seq ON approval_requests (tenant_id, status, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_run_id ON approval_requests (run_id);

-- ----------------------------------------------------------------------------
-- 9. AUDIT EVENTS (Service 5: Immutable Append-Only Security & Tool Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    event_id        TEXT PRIMARY KEY,
    seq_id          BIGSERIAL UNIQUE NOT NULL,
    run_id          TEXT REFERENCES agent_runs(run_id) ON DELETE RESTRICT,
    tenant_id       TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    actor_id        TEXT NOT NULL,
    event_type      TEXT NOT NULL CHECK (event_type IN (
                        'SPEC_COMPILED',
                        'POLICY_ALLOWED',
                        'POLICY_DENIED',
                        'APPROVAL_REQUESTED',
                        'APPROVAL_GRANTED',
                        'APPROVAL_REJECTED',
                        'TOOL_DISPATCHED',
                        'TOOL_SUCCEEDED',
                        'TOOL_FAILED',
                        'RECONCILIATION_VERIFIED'
                    )),
    capability_id   TEXT,
    policy_decision TEXT NOT NULL,
    request_digest  TEXT,
    response_digest TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_seq ON audit_events (tenant_id, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_run_seq ON audit_events (run_id, seq_id ASC);

-- ----------------------------------------------------------------------------
-- 10. MEM0 SEMANTIC MEMORIES (Service 4: Vector Store with Tenant Isolation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mem0_memories (
    memory_id   TEXT PRIMARY KEY,
    seq_id      BIGSERIAL UNIQUE NOT NULL,
    tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    agent_id    TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(1536) NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_stale    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_mem0_tenant_agent_seq ON mem0_memories (tenant_id, agent_id, seq_id DESC) WHERE is_stale = FALSE;
CREATE INDEX IF NOT EXISTS idx_mem0_embedding_hnsw ON mem0_memories USING hnsw (embedding vector_cosine_ops);