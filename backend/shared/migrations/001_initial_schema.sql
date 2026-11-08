-- ============================================================================
-- DELTIX — Complete Single-Database Relational Schema (Supabase / PostgreSQL 16)
-- Pure DDL Schema Only — Zero Predefined or Seed Data
-- Safe to Re-Run (Idempotent CREATE + ALTER + Cleanup of Obsolete Tables)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 0. CLEANUP / ALTER FROM PREVIOUS SCHEMA VERSIONS (Safe to Re-Run)
-- ----------------------------------------------------------------------------
-- Drop mem0_memories from Supabase since Mem0 manages long-term semantic memory directly.
DROP TABLE IF EXISTS mem0_memories CASCADE;

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

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Workspace',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

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

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS picture_url TEXT,
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'OPERATOR',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

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

ALTER TABLE capability_registry
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS parameters_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_mutation BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS idempotent BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS required_permissions TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

CREATE INDEX IF NOT EXISTS idx_capability_registry_status_seq ON capability_registry (status, seq_id ASC);

-- ----------------------------------------------------------------------------
-- 3. AGENT SPECIFICATIONS (Service 2: Final Compiled & Validated Agent IR)
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

ALTER TABLE agent_specs
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS agent_id TEXT,
    ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS ir_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS readiness_token TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPILED',
    ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

CREATE INDEX IF NOT EXISTS idx_agent_specs_tenant_seq ON agent_specs (tenant_id, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_agent_specs_tenant_status_seq ON agent_specs (tenant_id, status, seq_id DESC);

-- ----------------------------------------------------------------------------
-- 4. AGENT COMPILATION LOGS (Service 2: Clarification & Validation History)
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

ALTER TABLE agent_compilation_logs
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS spec_id TEXT REFERENCES agent_specs(spec_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS raw_prompt TEXT,
    ADD COLUMN IF NOT EXISTS clarification_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS compiler_stage TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

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

ALTER TABLE agent_runs
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS spec_id TEXT REFERENCES agent_specs(spec_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS triggered_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS current_step_index INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_node_id TEXT,
    ADD COLUMN IF NOT EXISTS cumulative_spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS inputs_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS final_output JSONB,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

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

ALTER TABLE agent_run_checkpoints
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS run_id TEXT REFERENCES agent_runs(run_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS step_index INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attempt_num INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS node_id TEXT,
    ADD COLUMN IF NOT EXISTS node_type TEXT,
    ADD COLUMN IF NOT EXISTS node_input JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS node_output JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS duration_ms BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

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

ALTER TABLE action_intents
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS run_id TEXT REFERENCES agent_runs(run_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS step_index INTEGER,
    ADD COLUMN IF NOT EXISTS capability_id TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS response_payload JSONB,
    ADD COLUMN IF NOT EXISTS provider_resource_id TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

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

ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS run_id TEXT REFERENCES agent_runs(run_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS step_index INTEGER,
    ADD COLUMN IF NOT EXISTS node_id TEXT,
    ADD COLUMN IF NOT EXISTS capability_id TEXT,
    ADD COLUMN IF NOT EXISTS action_summary TEXT,
    ADD COLUMN IF NOT EXISTS requested_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS token_hash TEXT,
    ADD COLUMN IF NOT EXISTS approved_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS decision_reason TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

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

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS seq_id BIGSERIAL,
    ADD COLUMN IF NOT EXISTS run_id TEXT REFERENCES agent_runs(run_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS actor_id TEXT,
    ADD COLUMN IF NOT EXISTS event_type TEXT,
    ADD COLUMN IF NOT EXISTS capability_id TEXT,
    ADD COLUMN IF NOT EXISTS policy_decision TEXT,
    ADD COLUMN IF NOT EXISTS request_digest TEXT,
    ADD COLUMN IF NOT EXISTS response_digest TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc');

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_seq ON audit_events (tenant_id, seq_id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_run_seq ON audit_events (run_id, seq_id ASC);
