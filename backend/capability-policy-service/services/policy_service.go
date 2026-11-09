package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	capmodels "github.com/deltix/capability-policy-service/models"
	sharedmodels "github.com/deltix/shared/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrApprovalNotFound = errors.New("approval request not found for tenant")

type ApprovalRepository interface {
	GetApprovalByID(ctx context.Context, tenantID string, approvalID string) (sharedmodels.ApprovalRequest, error)
	UpdateApprovalDecision(
		ctx context.Context,
		tenantID string,
		approvalID string,
		status sharedmodels.ApprovalStatus,
		approvedBy string,
		reason string,
		tokenHash string,
		resolvedAt time.Time,
	) error
	RecordAuditEvent(ctx context.Context, ev sharedmodels.AuditEvent) error
}

type PostgresApprovalRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresApprovalRepository(pool *pgxpool.Pool) *PostgresApprovalRepository {
	return &PostgresApprovalRepository{pool: pool}
}

func (r *PostgresApprovalRepository) GetApprovalByID(
	ctx context.Context,
	tenantID string,
	approvalID string,
) (sharedmodels.ApprovalRequest, error) {
	const querySQL = `
		SELECT approval_id, seq_id, run_id, tenant_id, step_index, node_id,
		       capability_id, action_summary, requested_payload, amount_usd,
		       status, token_hash, COALESCE(approved_by, ''), COALESCE(decision_reason, ''),
		       created_at, expires_at, resolved_at
		FROM approval_requests
		WHERE tenant_id = $1 AND approval_id = $2
	`
	var req sharedmodels.ApprovalRequest
	err := r.pool.QueryRow(ctx, querySQL, tenantID, approvalID).Scan(
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
		&req.TokenHash,
		&req.ApprovedBy,
		&req.DecisionReason,
		&req.CreatedAt,
		&req.ExpiresAt,
		&req.ResolvedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return sharedmodels.ApprovalRequest{}, ErrApprovalNotFound
	}
	return req, err
}

func (r *PostgresApprovalRepository) UpdateApprovalDecision(
	ctx context.Context,
	tenantID string,
	approvalID string,
	status sharedmodels.ApprovalStatus,
	approvedBy string,
	reason string,
	tokenHash string,
	resolvedAt time.Time,
) error {
	const updateSQL = `
		UPDATE approval_requests
		SET status = $3,
		    approved_by = NULLIF($4, ''),
		    decision_reason = $5,
		    token_hash = $6,
		    resolved_at = $7
		WHERE tenant_id = $1 AND approval_id = $2
	`
	_, err := r.pool.Exec(ctx, updateSQL, tenantID, approvalID, string(status), approvedBy, reason, tokenHash, resolvedAt)
	return err
}

func (r *PostgresApprovalRepository) RecordAuditEvent(
	ctx context.Context,
	ev sharedmodels.AuditEvent,
) error {
	const insertSQL = `
		INSERT INTO audit_events (
			event_id, run_id, tenant_id, actor_id, event_type,
			capability_id, policy_decision, metadata, created_at
		) VALUES ($1, NULLIF($2, ''), $3, $4, $5, NULLIF($6, ''), $7, $8, $9)
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
		defaultJSON(ev.Metadata),
		ev.CreatedAt,
	)
	return err
}

type RuntimeResumeNotifier interface {
	NotifyResume(
		ctx context.Context,
		tenantID string,
		runID string,
		approvalID string,
		status string,
		approvalToken string,
		approvedBy string,
		reason string,
	) (string, error)
}

type HTTPRuntimeResumeNotifier struct {
	runtimeBaseURL string
	httpClient     *http.Client
}

func NewHTTPRuntimeResumeNotifier(runtimeBaseURL string, httpClient *http.Client) *HTTPRuntimeResumeNotifier {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &HTTPRuntimeResumeNotifier{
		runtimeBaseURL: strings.TrimRight(runtimeBaseURL, "/"),
		httpClient:     httpClient,
	}
}

func (n *HTTPRuntimeResumeNotifier) NotifyResume(
	ctx context.Context,
	tenantID string,
	runID string,
	approvalID string,
	status string,
	approvalToken string,
	approvedBy string,
	reason string,
) (string, error) {
	bodyBytes, _ := json.Marshal(map[string]string{
		"approval_id":     approvalID,
		"approval_status": status,
		"approval_token":  approvalToken,
		"approved_by":     approvedBy,
		"reason":          reason,
	})
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("%s/internal/v1/runs/%s/resume", n.runtimeBaseURL, runID),
		bytes.NewReader(bodyBytes),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("runtime resume returned status %d", resp.StatusCode)
	}
	return "RESUMED", nil
}

type PolicyService struct {
	repo       ApprovalRepository
	notifier   RuntimeResumeNotifier
	hmacSecret []byte
}

func NewPolicyService(
	repo ApprovalRepository,
	notifier RuntimeResumeNotifier,
	approvalHMACSecret string,
) *PolicyService {
	return &PolicyService{
		repo:       repo,
		notifier:   notifier,
		hmacSecret: []byte(approvalHMACSecret),
	}
}

func (s *PolicyService) DecideApproval(
	ctx context.Context,
	tenantID string,
	userID string,
	approvalID string,
	req capmodels.ApprovalDecisionRequest,
	traceID string,
) (capmodels.ApprovalDecisionResponse, error) {
	if err := req.Validate(); err != nil {
		return capmodels.ApprovalDecisionResponse{}, err
	}

	approvalReq, err := s.repo.GetApprovalByID(ctx, tenantID, approvalID)
	if err != nil {
		return capmodels.ApprovalDecisionResponse{}, err
	}

	decision := sharedmodels.ApprovalStatus(strings.ToUpper(strings.TrimSpace(req.Decision)))
	now := time.Now().UTC()

	var approvalToken string
	tokenHash := approvalReq.TokenHash
	eventType := sharedmodels.AuditEventApprovalRejected

	if decision == sharedmodels.ApprovalStatusApproved {
		approvalToken = s.SignApprovalToken(approvalReq.ApprovalID, approvalReq.RunID, approvalReq.CapabilityID)
		sum := sha256.Sum256([]byte(approvalToken))
		tokenHash = hex.EncodeToString(sum[:])
		eventType = sharedmodels.AuditEventApprovalGranted
	}

	if err := s.repo.UpdateApprovalDecision(
		ctx,
		tenantID,
		approvalID,
		decision,
		userID,
		req.Reason,
		tokenHash,
		now,
	); err != nil {
		return capmodels.ApprovalDecisionResponse{}, err
	}

	_ = s.repo.RecordAuditEvent(ctx, sharedmodels.AuditEvent{
		EventID:        generateID("aud"),
		RunID:          approvalReq.RunID,
		TenantID:       tenantID,
		ActorID:        userID,
		EventType:      eventType,
		CapabilityID:   approvalReq.CapabilityID,
		PolicyDecision: string(decision),
		CreatedAt:      now,
	})

	resumedStatus := ""
	if s.notifier != nil {
		resumed, _ := s.notifier.NotifyResume(
			ctx,
			tenantID,
			approvalReq.RunID,
			approvalID,
			string(decision),
			approvalToken,
			userID,
			req.Reason,
		)
		resumedStatus = resumed
	}

	return capmodels.ApprovalDecisionResponse{
		ApprovalID:    approvalID,
		RunID:         approvalReq.RunID,
		Status:        decision,
		ApprovalToken: approvalToken,
		ResumedStatus: resumedStatus,
		TraceID:       traceID,
	}, nil
}

func (s *PolicyService) SignApprovalToken(approvalID string, runID string, capabilityID string) string {
	mac := hmac.New(sha256.New, s.hmacSecret)
	_, _ = mac.Write([]byte(fmt.Sprintf("%s:%s:%s:APPROVED", approvalID, runID, capabilityID)))
	return "atok_" + hex.EncodeToString(mac.Sum(nil))
}
