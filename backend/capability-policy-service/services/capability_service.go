package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/deltix/capability-policy-service/adapters"
	capmodels "github.com/deltix/capability-policy-service/models"
	sharedmodels "github.com/deltix/shared/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CapabilityRepository interface {
	UpsertCapability(ctx context.Context, cap sharedmodels.CapabilityContract) error
	GetCapability(ctx context.Context, capabilityID string) (sharedmodels.CapabilityContract, bool, error)
	ListActiveCapabilities(ctx context.Context) ([]sharedmodels.CapabilityContract, error)
	FindIntentByIdempotencyKey(ctx context.Context, idempotencyKey string) (*sharedmodels.ActionIntent, error)
	CreateActionIntent(ctx context.Context, intent sharedmodels.ActionIntent) error
	UpdateActionIntent(ctx context.Context, intent sharedmodels.ActionIntent) error
	RecordAuditEvent(ctx context.Context, ev sharedmodels.AuditEvent) error
}

type PostgresCapabilityRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresCapabilityRepository(pool *pgxpool.Pool) *PostgresCapabilityRepository {
	return &PostgresCapabilityRepository{pool: pool}
}

func (r *PostgresCapabilityRepository) UpsertCapability(
	ctx context.Context,
	c sharedmodels.CapabilityContract,
) error {
	const upsertSQL = `
		INSERT INTO capability_registry (
			capability_id, version, description, http_method, endpoint_path,
			parameters_schema, output_schema, is_sensitive, is_mutation,
			idempotent, timeout_seconds, max_retries, required_permissions,
			status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		ON CONFLICT (capability_id, version) DO UPDATE SET
			description = EXCLUDED.description,
			http_method = EXCLUDED.http_method,
			endpoint_path = EXCLUDED.endpoint_path,
			parameters_schema = EXCLUDED.parameters_schema,
			output_schema = EXCLUDED.output_schema,
			is_sensitive = EXCLUDED.is_sensitive,
			is_mutation = EXCLUDED.is_mutation,
			status = EXCLUDED.status,
			updated_at = EXCLUDED.updated_at
	`
	now := time.Now().UTC()
	method := c.HTTPMethod
	if method == "" {
		method = "POST"
	}
	_, err := r.pool.Exec(
		ctx,
		upsertSQL,
		c.CapabilityID,
		c.Version,
		c.Description,
		method,
		c.EndpointPath,
		defaultJSON(c.ParametersSchema),
		defaultJSON(c.OutputSchema),
		c.IsSensitive,
		c.IsMutation,
		c.Idempotent,
		c.TimeoutSeconds,
		c.MaxRetries,
		c.RequiredPermissions,
		c.Status,
		now,
		now,
	)
	return err
}

func (r *PostgresCapabilityRepository) GetCapability(
	ctx context.Context,
	capabilityID string,
) (sharedmodels.CapabilityContract, bool, error) {
	const querySQL = `
		SELECT capability_id, version, seq_id, description,
		       COALESCE(http_method, 'POST'), COALESCE(endpoint_path, ''),
		       parameters_schema, output_schema, is_sensitive, is_mutation,
		       idempotent, timeout_seconds, max_retries, required_permissions,
		       status, created_at, updated_at
		FROM capability_registry
		WHERE capability_id = $1 AND status = 'ACTIVE'
		ORDER BY seq_id DESC
		LIMIT 1
	`
	var c sharedmodels.CapabilityContract
	err := r.pool.QueryRow(ctx, querySQL, capabilityID).Scan(
		&c.CapabilityID,
		&c.Version,
		&c.SeqID,
		&c.Description,
		&c.HTTPMethod,
		&c.EndpointPath,
		&c.ParametersSchema,
		&c.OutputSchema,
		&c.IsSensitive,
		&c.IsMutation,
		&c.Idempotent,
		&c.TimeoutSeconds,
		&c.MaxRetries,
		&c.RequiredPermissions,
		&c.Status,
		&c.CreatedAt,
		&c.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return sharedmodels.CapabilityContract{}, false, nil
	}
	if err != nil {
		return sharedmodels.CapabilityContract{}, false, err
	}
	return c, true, nil
}

func (r *PostgresCapabilityRepository) ListActiveCapabilities(
	ctx context.Context,
) ([]sharedmodels.CapabilityContract, error) {
	const listSQL = `
		SELECT capability_id, version, seq_id, description,
		       COALESCE(http_method, 'POST'), COALESCE(endpoint_path, ''),
		       parameters_schema, output_schema, is_sensitive, is_mutation,
		       idempotent, timeout_seconds, max_retries, required_permissions,
		       status, created_at, updated_at
		FROM capability_registry
		WHERE status = 'ACTIVE'
		ORDER BY seq_id ASC
	`
	rows, err := r.pool.Query(ctx, listSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []sharedmodels.CapabilityContract
	for rows.Next() {
		var c sharedmodels.CapabilityContract
		if err := rows.Scan(
			&c.CapabilityID,
			&c.Version,
			&c.SeqID,
			&c.Description,
			&c.HTTPMethod,
			&c.EndpointPath,
			&c.ParametersSchema,
			&c.OutputSchema,
			&c.IsSensitive,
			&c.IsMutation,
			&c.Idempotent,
			&c.TimeoutSeconds,
			&c.MaxRetries,
			&c.RequiredPermissions,
			&c.Status,
			&c.CreatedAt,
			&c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func (r *PostgresCapabilityRepository) FindIntentByIdempotencyKey(
	ctx context.Context,
	idempotencyKey string,
) (*sharedmodels.ActionIntent, error) {
	const querySQL = `
		SELECT intent_id, seq_id, run_id, tenant_id, step_index, capability_id,
		       idempotency_key, amount_usd, request_payload,
		       COALESCE(response_payload, '{}'::jsonb), COALESCE(provider_resource_id, ''),
		       status, created_at, updated_at
		FROM action_intents
		WHERE idempotency_key = $1
	`
	var intent sharedmodels.ActionIntent
	err := r.pool.QueryRow(ctx, querySQL, idempotencyKey).Scan(
		&intent.IntentID,
		&intent.SeqID,
		&intent.RunID,
		&intent.TenantID,
		&intent.StepIndex,
		&intent.CapabilityID,
		&intent.IdempotencyKey,
		&intent.AmountUSD,
		&intent.RequestPayload,
		&intent.ResponsePayload,
		&intent.ProviderResourceID,
		&intent.Status,
		&intent.CreatedAt,
		&intent.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &intent, nil
}

func (r *PostgresCapabilityRepository) CreateActionIntent(
	ctx context.Context,
	intent sharedmodels.ActionIntent,
) error {
	const insertSQL = `
		INSERT INTO action_intents (
			intent_id, run_id, tenant_id, step_index, capability_id,
			idempotency_key, amount_usd, request_payload, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.pool.Exec(
		ctx,
		insertSQL,
		intent.IntentID,
		intent.RunID,
		intent.TenantID,
		intent.StepIndex,
		intent.CapabilityID,
		intent.IdempotencyKey,
		intent.AmountUSD,
		defaultJSON(intent.RequestPayload),
		string(intent.Status),
		intent.CreatedAt,
		intent.UpdatedAt,
	)
	return err
}

func (r *PostgresCapabilityRepository) UpdateActionIntent(
	ctx context.Context,
	intent sharedmodels.ActionIntent,
) error {
	const updateSQL = `
		UPDATE action_intents
		SET response_payload = $2,
		    provider_resource_id = $3,
		    status = $4,
		    updated_at = $5
		WHERE intent_id = $1
	`
	_, err := r.pool.Exec(
		ctx,
		updateSQL,
		intent.IntentID,
		defaultJSON(intent.ResponsePayload),
		intent.ProviderResourceID,
		string(intent.Status),
		intent.UpdatedAt,
	)
	return err
}

func (r *PostgresCapabilityRepository) RecordAuditEvent(
	ctx context.Context,
	ev sharedmodels.AuditEvent,
) error {
	const insertSQL = `
		INSERT INTO audit_events (
			event_id, run_id, tenant_id, actor_id, event_type,
			capability_id, policy_decision, request_digest, response_digest,
			metadata, created_at
		) VALUES ($1, NULLIF($2, ''), $3, $4, $5, NULLIF($6, ''), $7, $8, $9, $10, $11)
	`
	_, err := r.pool.Exec(
		ctx,
		insertSQL,
		ev.EventID,
		ev.RunID,
		ev.TenantID,
		ev.ActorID,
		string(ev.EventType),
		ev.CapabilityID,
		ev.PolicyDecision,
		ev.RequestDigest,
		ev.ResponseDigest,
		defaultJSON(ev.Metadata),
		ev.CreatedAt,
	)
	return err
}

type CapabilityService struct {
	repo     CapabilityRepository
	provider adapters.PayPalProvider
}

func NewCapabilityService(
	repo CapabilityRepository,
	provider adapters.PayPalProvider,
) *CapabilityService {
	return &CapabilityService{
		repo:     repo,
		provider: provider,
	}
}

func (s *CapabilityService) ListCapabilities(ctx context.Context) ([]sharedmodels.CapabilityContract, error) {
	return s.repo.ListActiveCapabilities(ctx)
}

func (s *CapabilityService) DispatchTool(
	ctx context.Context,
	req capmodels.ToolDispatchRequest,
) (map[string]interface{}, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	capContract, exists, err := s.repo.GetCapability(ctx, req.CapabilityID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, capmodels.ErrUnknownCapability
	}

	if capContract.IsSensitive && req.ApprovalToken == "" {
		return nil, capmodels.ErrMissingApprovalToken
	}

	idemKey := req.IdempotencyKey
	if idemKey == "" {
		paramBytes, _ := json.Marshal(req.Parameters)
		sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%d:%s:%s", req.TenantID, req.RunID, req.StepIndex, req.CapabilityID, string(paramBytes))))
		idemKey = "idem_" + hex.EncodeToString(sum[:12])
	}

	// Idempotent deduplication check in action_intents
	existing, err := s.repo.FindIntentByIdempotencyKey(ctx, idemKey)
	if err == nil && existing != nil && existing.Status == sharedmodels.IntentStatusSucceeded {
		var cached map[string]interface{}
		_ = json.Unmarshal(existing.ResponsePayload, &cached)
		if cached != nil {
			cached["idempotent_replay"] = true
			return cached, nil
		}
	}

	now := time.Now().UTC()
	reqBytes, _ := json.Marshal(req.Parameters)
	amountUSD, _ := req.Parameters["amount_usd"].(float64)

	intent := sharedmodels.ActionIntent{
		IntentID:       generateID("int"),
		RunID:          req.RunID,
		TenantID:       req.TenantID,
		StepIndex:      req.StepIndex,
		CapabilityID:   req.CapabilityID,
		IdempotencyKey: idemKey,
		AmountUSD:      amountUSD,
		RequestPayload: reqBytes,
		Status:         sharedmodels.IntentStatusRecorded,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	_ = s.repo.CreateActionIntent(ctx, intent)

	out, resourceID, err := s.provider.ExecuteCapability(ctx, capContract, idemKey, req.Parameters)
	if err != nil {
		intent.Status = sharedmodels.IntentStatusFailed
		intent.UpdatedAt = time.Now().UTC()
		_ = s.repo.UpdateActionIntent(ctx, intent)
		_ = s.repo.RecordAuditEvent(ctx, sharedmodels.AuditEvent{
			EventID:        generateID("aud"),
			RunID:          req.RunID,
			TenantID:       req.TenantID,
			ActorID:        "runtime_worker",
			EventType:      sharedmodels.AuditEventToolFailed,
			CapabilityID:   req.CapabilityID,
			PolicyDecision: "DENIED_OR_FAILED",
			CreatedAt:      time.Now().UTC(),
		})
		return nil, err
	}

	respBytes, _ := json.Marshal(out)
	intent.ResponsePayload = respBytes
	intent.ProviderResourceID = resourceID
	intent.Status = sharedmodels.IntentStatusSucceeded
	intent.UpdatedAt = time.Now().UTC()
	_ = s.repo.UpdateActionIntent(ctx, intent)

	_ = s.repo.RecordAuditEvent(ctx, sharedmodels.AuditEvent{
		EventID:        generateID("aud"),
		RunID:          req.RunID,
		TenantID:       req.TenantID,
		ActorID:        "runtime_worker",
		EventType:      sharedmodels.AuditEventToolSucceeded,
		CapabilityID:   req.CapabilityID,
		PolicyDecision: "ALLOWED",
		CreatedAt:      time.Now().UTC(),
	})

	return out, nil
}

func defaultJSON(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return []byte("{}")
	}
	return raw
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}
