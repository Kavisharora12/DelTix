package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	sharedmodels "github.com/deltix/shared/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

var (
	ErrRunNotFound  = errors.New("agent run not found for tenant")
	ErrSpecNotFound = errors.New("agent spec not found for tenant")
)

// RunStateRepository defines ACID persistence for agent_runs, checkpoints, and approval_requests.
type RunStateRepository interface {
	GetSpecByID(ctx context.Context, tenantID string, specID string) (sharedmodels.AgentSpec, error)
	CreateRun(ctx context.Context, run sharedmodels.AgentRun) error
	UpdateRunProgress(ctx context.Context, run sharedmodels.AgentRun) error
	GetRunByID(ctx context.Context, tenantID string, runID string) (sharedmodels.AgentRun, error)
	ListRuns(ctx context.Context, tenantID string, cursorSeqID int64, limit int) ([]sharedmodels.AgentRun, error)
	SaveCheckpoint(ctx context.Context, cp sharedmodels.RunCheckpoint) error
	ListCheckpoints(ctx context.Context, tenantID string, runID string) ([]sharedmodels.RunCheckpoint, error)
	CreateApprovalRequest(ctx context.Context, req sharedmodels.ApprovalRequest) error
	GetPendingApprovalForRun(ctx context.Context, tenantID string, runID string) (*sharedmodels.ApprovalRequest, error)
}

// RunLockManager enforces single-worker execution concurrency per run_id via Upstash Redis.
type RunLockManager interface {
	AcquireRunLock(ctx context.Context, runID string, ttl time.Duration) (bool, error)
	ReleaseRunLock(ctx context.Context, runID string) error
}

type RedisRunLockManager struct {
	client *redis.Client
}

func NewRedisRunLockManager(client *redis.Client) *RedisRunLockManager {
	return &RedisRunLockManager{client: client}
}

func (m *RedisRunLockManager) AcquireRunLock(ctx context.Context, runID string, ttl time.Duration) (bool, error) {
	if m.client == nil {
		return true, nil
	}
	key := "lock:" + runID
	return m.client.SetNX(ctx, key, "locked", ttl).Result()
}

func (m *RedisRunLockManager) ReleaseRunLock(ctx context.Context, runID string) error {
	if m.client == nil {
		return nil
	}
	return m.client.Del(ctx, "lock:"+runID).Err()
}

type PostgresRunStateRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRunStateRepository(pool *pgxpool.Pool) *PostgresRunStateRepository {
	return &PostgresRunStateRepository{pool: pool}
}

func (r *PostgresRunStateRepository) GetSpecByID(
	ctx context.Context,
	tenantID string,
	specID string,
) (sharedmodels.AgentSpec, error) {
	const querySQL = `
		SELECT spec_id, seq_id, agent_id, version, tenant_id, name, category,
		       ir_payload, validation_report, readiness_token, status, COALESCE(created_by, ''), created_at, updated_at
		FROM agent_specs
		WHERE tenant_id = $1 AND spec_id = $2
	`
	var spec sharedmodels.AgentSpec
	var irBytes, valBytes []byte
	err := r.pool.QueryRow(ctx, querySQL, tenantID, specID).Scan(
		&spec.SpecID,
		&spec.SeqID,
		&spec.AgentID,
		&spec.Version,
		&spec.TenantID,
		&spec.Name,
		&spec.Category,
		&irBytes,
		&valBytes,
		&spec.ReadinessToken,
		&spec.Status,
		&spec.CreatedBy,
		&spec.CreatedAt,
		&spec.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return sharedmodels.AgentSpec{}, ErrSpecNotFound
	}
	if err != nil {
		return sharedmodels.AgentSpec{}, fmt.Errorf("query agent_spec %s: %w", specID, err)
	}
	if err := json.Unmarshal(irBytes, &spec.IR); err != nil {
		return sharedmodels.AgentSpec{}, fmt.Errorf("unmarshal spec ir: %w", err)
	}
	_ = json.Unmarshal(valBytes, &spec.ValidationReport)
	return spec, nil
}

func (r *PostgresRunStateRepository) CreateRun(ctx context.Context, run sharedmodels.AgentRun) error {
	const insertSQL = `
		INSERT INTO agent_runs (
			run_id, spec_id, tenant_id, triggered_by, status,
			current_step_index, current_node_id, cumulative_spend,
			inputs_payload, state_payload, started_at, updated_at
		) VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12)
	`
	_, err := r.pool.Exec(
		ctx,
		insertSQL,
		run.RunID,
		run.SpecID,
		run.TenantID,
		run.TriggeredBy,
		string(run.Status),
		run.CurrentStepIndex,
		run.CurrentNodeID,
		run.CumulativeSpend,
		string(defaultJSON(run.InputsPayload)),
		string(defaultJSON(run.StatePayload)),
		run.StartedAt,
		run.UpdatedAt,
	)
	return err
}

func (r *PostgresRunStateRepository) UpdateRunProgress(ctx context.Context, run sharedmodels.AgentRun) error {
	const updateSQL = `
		UPDATE agent_runs
		SET status = $3,
		    current_step_index = $4,
		    current_node_id = $5,
		    cumulative_spend = $6,
		    state_payload = $7::jsonb,
		    final_output = $8::jsonb,
		    error_message = NULLIF($9, ''),
		    updated_at = $10,
		    completed_at = $11
		WHERE tenant_id = $1 AND run_id = $2
	`
	_, err := r.pool.Exec(
		ctx,
		updateSQL,
		run.TenantID,
		run.RunID,
		string(run.Status),
		run.CurrentStepIndex,
		run.CurrentNodeID,
		run.CumulativeSpend,
		string(defaultJSON(run.StatePayload)),
		nullableJSON(run.FinalOutput),
		run.ErrorMessage,
		run.UpdatedAt,
		run.CompletedAt,
	)
	return err
}

func (r *PostgresRunStateRepository) GetRunByID(
	ctx context.Context,
	tenantID string,
	runID string,
) (sharedmodels.AgentRun, error) {
	const querySQL = `
		SELECT run_id, seq_id, spec_id, tenant_id, COALESCE(triggered_by, ''),
		       status, current_step_index, COALESCE(current_node_id, ''),
		       cumulative_spend, inputs_payload, state_payload,
		       COALESCE(final_output, '{}'::jsonb), COALESCE(error_message, ''),
		       started_at, updated_at, completed_at
		FROM agent_runs
		WHERE tenant_id = $1 AND run_id = $2
	`
	var run sharedmodels.AgentRun
	err := r.pool.QueryRow(ctx, querySQL, tenantID, runID).Scan(
		&run.RunID,
		&run.SeqID,
		&run.SpecID,
		&run.TenantID,
		&run.TriggeredBy,
		&run.Status,
		&run.CurrentStepIndex,
		&run.CurrentNodeID,
		&run.CumulativeSpend,
		&run.InputsPayload,
		&run.StatePayload,
		&run.FinalOutput,
		&run.ErrorMessage,
		&run.StartedAt,
		&run.UpdatedAt,
		&run.CompletedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return sharedmodels.AgentRun{}, ErrRunNotFound
	}
	if err != nil {
		return sharedmodels.AgentRun{}, fmt.Errorf("get agent_run %s: %w", runID, err)
	}
	return run, nil
}

func (r *PostgresRunStateRepository) ListRuns(
	ctx context.Context,
	tenantID string,
	cursorSeqID int64,
	limit int,
) ([]sharedmodels.AgentRun, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if cursorSeqID <= 0 {
		cursorSeqID = 1<<62 - 1
	}

	const listSQL = `
		SELECT run_id, seq_id, spec_id, tenant_id, COALESCE(triggered_by, ''),
		       status, current_step_index, COALESCE(current_node_id, ''),
		       cumulative_spend, inputs_payload, state_payload,
		       COALESCE(final_output, '{}'::jsonb), COALESCE(error_message, ''),
		       started_at, updated_at, completed_at
		FROM agent_runs
		WHERE tenant_id = $1 AND seq_id < $2
		ORDER BY seq_id DESC
		LIMIT $3
	`
	rows, err := r.pool.Query(ctx, listSQL, tenantID, cursorSeqID, limit)
	if err != nil {
		return nil, fmt.Errorf("list agent_runs: %w", err)
	}
	defer rows.Close()

	var runs []sharedmodels.AgentRun
	for rows.Next() {
		var run sharedmodels.AgentRun
		if err := rows.Scan(
			&run.RunID,
			&run.SeqID,
			&run.SpecID,
			&run.TenantID,
			&run.TriggeredBy,
			&run.Status,
			&run.CurrentStepIndex,
			&run.CurrentNodeID,
			&run.CumulativeSpend,
			&run.InputsPayload,
			&run.StatePayload,
			&run.FinalOutput,
			&run.ErrorMessage,
			&run.StartedAt,
			&run.UpdatedAt,
			&run.CompletedAt,
		); err != nil {
			return nil, err
		}
		runs = append(runs, run)
	}
	return runs, rows.Err()
}

func (r *PostgresRunStateRepository) SaveCheckpoint(
	ctx context.Context,
	cp sharedmodels.RunCheckpoint,
) error {
	const insertSQL = `
		INSERT INTO agent_run_checkpoints (
			checkpoint_id, run_id, tenant_id, step_index, attempt_num,
			node_id, node_type, node_input, node_output, state_snapshot,
			status, duration_ms, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13)
		ON CONFLICT (run_id, step_index, attempt_num) DO UPDATE SET
			node_output = EXCLUDED.node_output,
			state_snapshot = EXCLUDED.state_snapshot,
			status = EXCLUDED.status,
			duration_ms = EXCLUDED.duration_ms
	`
	_, err := r.pool.Exec(
		ctx,
		insertSQL,
		cp.CheckpointID,
		cp.RunID,
		cp.TenantID,
		cp.StepIndex,
		maxInt(1, cp.AttemptNum),
		cp.NodeID,
		string(cp.NodeType),
		string(defaultJSON(cp.NodeInput)),
		string(defaultJSON(cp.NodeOutput)),
		string(defaultJSON(cp.StateSnapshot)),
		string(cp.Status),
		cp.DurationMs,
		cp.CreatedAt,
	)
	return err
}

func (r *PostgresRunStateRepository) ListCheckpoints(
	ctx context.Context,
	tenantID string,
	runID string,
) ([]sharedmodels.RunCheckpoint, error) {
	const querySQL = `
		SELECT checkpoint_id, seq_id, run_id, tenant_id, step_index, attempt_num,
		       node_id, node_type, node_input, node_output, state_snapshot,
		       status, duration_ms, created_at
		FROM agent_run_checkpoints
		WHERE tenant_id = $1 AND run_id = $2
		ORDER BY step_index ASC, attempt_num ASC
	`
	rows, err := r.pool.Query(ctx, querySQL, tenantID, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []sharedmodels.RunCheckpoint
	for rows.Next() {
		var cp sharedmodels.RunCheckpoint
		if err := rows.Scan(
			&cp.CheckpointID,
			&cp.SeqID,
			&cp.RunID,
			&cp.TenantID,
			&cp.StepIndex,
			&cp.AttemptNum,
			&cp.NodeID,
			&cp.NodeType,
			&cp.NodeInput,
			&cp.NodeOutput,
			&cp.StateSnapshot,
			&cp.Status,
			&cp.DurationMs,
			&cp.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, cp)
	}
	return list, rows.Err()
}

func (r *PostgresRunStateRepository) CreateApprovalRequest(
	ctx context.Context,
	req sharedmodels.ApprovalRequest,
) error {
	const insertSQL = `
		INSERT INTO approval_requests (
			approval_id, run_id, tenant_id, step_index, node_id,
			capability_id, action_summary, requested_payload, amount_usd,
			status, token_hash, created_at, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
	`
	_, err := r.pool.Exec(
		ctx,
		insertSQL,
		req.ApprovalID,
		req.RunID,
		req.TenantID,
		req.StepIndex,
		req.NodeID,
		req.CapabilityID,
		req.ActionSummary,
		string(defaultJSON(req.RequestedPayload)),
		req.AmountUSD,
		string(req.Status),
		req.TokenHash,
		req.CreatedAt,
		req.ExpiresAt,
	)
	return err
}

func (r *PostgresRunStateRepository) GetPendingApprovalForRun(
	ctx context.Context,
	tenantID string,
	runID string,
) (*sharedmodels.ApprovalRequest, error) {
	const querySQL = `
		SELECT approval_id, seq_id, run_id, tenant_id, step_index, node_id,
		       capability_id, action_summary, requested_payload, amount_usd,
		       status, created_at, expires_at
		FROM approval_requests
		WHERE tenant_id = $1 AND run_id = $2 AND status = 'PENDING'
		ORDER BY seq_id DESC
		LIMIT 1
	`
	var req sharedmodels.ApprovalRequest
	err := r.pool.QueryRow(ctx, querySQL, tenantID, runID).Scan(
		&req.ApprovalID,
		&req.SeqID,
		&req.RunID,
		&req.TenantID,
		&req.StepIndex,
		&req.NodeID,
		&req.CapabilityID,
		&req.ActionSummary,
		&req.RequestedPayload,
		&req.AmountUSD,
		&req.Status,
		&req.CreatedAt,
		&req.ExpiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func defaultJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("{}")
	}
	return raw
}

func nullableJSON(raw json.RawMessage) *string {
	if len(raw) == 0 {
		return nil
	}
	s := string(raw)
	return &s
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
