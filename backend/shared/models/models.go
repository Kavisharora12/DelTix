package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var (
	ErrEmptyIdentifier      = errors.New("identifier must not be empty")
	ErrEmptyTenantID        = errors.New("tenant id must not be empty")
	ErrInvalidRunStatus     = errors.New("invalid agent run status")
	ErrInvalidIntentStatus  = errors.New("invalid action intent status")
	ErrInvalidApprovalState = errors.New("invalid approval request status")
	ErrNegativeAmount       = errors.New("monetary amount must not be negative")
)

type TenantStatus string

const (
	TenantStatusActive    TenantStatus = "ACTIVE"
	TenantStatusSuspended TenantStatus = "SUSPENDED"
)

type UserRole string

const (
	UserRoleAdmin    UserRole = "ADMIN"
	UserRoleOperator UserRole = "OPERATOR"
	UserRoleViewer   UserRole = "VIEWER"
)

type SpecStatus string

const (
	SpecStatusDraft              SpecStatus = "DRAFT"
	SpecStatusNeedsClarification SpecStatus = "NEEDS_CLARIFICATION"
	SpecStatusCompiled           SpecStatus = "COMPILED"
	SpecStatusRejected           SpecStatus = "REJECTED"
	SpecStatusArchived           SpecStatus = "ARCHIVED"
)

type RunStatus string

const (
	RunStatusInitializing      RunStatus = "INITIALIZING"
	RunStatusRunning           RunStatus = "RUNNING"
	RunStatusPausedForApproval RunStatus = "PAUSED_FOR_APPROVAL"
	RunStatusResuming          RunStatus = "RESUMING"
	RunStatusCompleted         RunStatus = "COMPLETED"
	RunStatusFailed            RunStatus = "FAILED"
	RunStatusRejected          RunStatus = "REJECTED"
)

func (s RunStatus) IsValid() bool {
	switch s {
	case RunStatusInitializing,
		RunStatusRunning,
		RunStatusPausedForApproval,
		RunStatusResuming,
		RunStatusCompleted,
		RunStatusFailed,
		RunStatusRejected:
		return true
	default:
		return false
	}
}

func (s RunStatus) IsTerminal() bool {
	return s == RunStatusCompleted || s == RunStatusFailed || s == RunStatusRejected
}

type CheckpointStatus string

const (
	CheckpointStatusStarted     CheckpointStatus = "STARTED"
	CheckpointStatusSucceeded   CheckpointStatus = "SUCCEEDED"
	CheckpointStatusInterrupted CheckpointStatus = "INTERRUPTED"
	CheckpointStatusFailed      CheckpointStatus = "FAILED"
)

type ActionIntentStatus string

const (
	IntentStatusRecorded              ActionIntentStatus = "INTENT_RECORDED"
	IntentStatusDispatched            ActionIntentStatus = "DISPATCHED"
	IntentStatusNeedsReconciliation   ActionIntentStatus = "UNKNOWN_NEEDS_RECONCILIATION"
	IntentStatusSucceeded             ActionIntentStatus = "SUCCEEDED"
	IntentStatusFailed                ActionIntentStatus = "FAILED"
)

func (s ActionIntentStatus) IsValid() bool {
	switch s {
	case IntentStatusRecorded,
		IntentStatusDispatched,
		IntentStatusNeedsReconciliation,
		IntentStatusSucceeded,
		IntentStatusFailed:
		return true
	default:
		return false
	}
}

type ApprovalStatus string

const (
	ApprovalStatusPending  ApprovalStatus = "PENDING"
	ApprovalStatusApproved ApprovalStatus = "APPROVED"
	ApprovalStatusRejected ApprovalStatus = "REJECTED"
	ApprovalStatusExpired  ApprovalStatus = "EXPIRED"
)

func (s ApprovalStatus) IsValid() bool {
	switch s {
	case ApprovalStatusPending, ApprovalStatusApproved, ApprovalStatusRejected, ApprovalStatusExpired:
		return true
	default:
		return false
	}
}

type AuditEventType string

const (
	AuditEventSpecCompiled          AuditEventType = "SPEC_COMPILED"
	AuditEventPolicyAllowed         AuditEventType = "POLICY_ALLOWED"
	AuditEventPolicyDenied          AuditEventType = "POLICY_DENIED"
	AuditEventApprovalRequested     AuditEventType = "APPROVAL_REQUESTED"
	AuditEventApprovalGranted       AuditEventType = "APPROVAL_GRANTED"
	AuditEventApprovalRejected      AuditEventType = "APPROVAL_REJECTED"
	AuditEventToolDispatched        AuditEventType = "TOOL_DISPATCHED"
	AuditEventToolSucceeded         AuditEventType = "TOOL_SUCCEEDED"
	AuditEventToolFailed            AuditEventType = "TOOL_FAILED"
	AuditEventReconciliationChecked AuditEventType = "RECONCILIATION_VERIFIED"
)

type Tenant struct {
	TenantID  string       `json:"tenant_id"`
	SeqID     int64        `json:"seq_id"`
	Name      string       `json:"name"`
	Status    TenantStatus `json:"status"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type User struct {
	UserID     string    `json:"user_id"`
	SeqID      int64     `json:"seq_id"`
	TenantID   string    `json:"tenant_id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	PictureURL string    `json:"picture_url,omitempty"`
	Role       UserRole  `json:"role"`
	CreatedAt  time.Time `json:"created_at"`
	LastLogin  time.Time `json:"last_login"`
}

type CapabilityContract struct {
	CapabilityID        string          `json:"capability_id"`
	Version             string          `json:"version"`
	SeqID               int64           `json:"seq_id,omitempty"`
	Description         string          `json:"description"`
	HTTPMethod          string          `json:"http_method"`
	EndpointPath        string          `json:"endpoint_path"`
	ParametersSchema    json.RawMessage `json:"parameters_schema"`
	OutputSchema        json.RawMessage `json:"output_schema"`
	IsSensitive         bool            `json:"is_sensitive"`
	IsMutation          bool            `json:"is_mutation"`
	Idempotent          bool            `json:"idempotent"`
	TimeoutSeconds      int             `json:"timeout_seconds"`
	MaxRetries          int             `json:"max_retries"`
	RequiredPermissions []string        `json:"required_permissions"`
	Status              string          `json:"status"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

func (c CapabilityContract) Validate() error {
	if c.CapabilityID == "" || c.Version == "" {
		return ErrEmptyIdentifier
	}
	if c.TimeoutSeconds <= 0 {
		return errors.New("capability timeout_seconds must be positive")
	}
	if c.MaxRetries < 0 {
		return errors.New("capability max_retries must not be negative")
	}
	return nil
}

type ValidationReport struct {
	SchemaValid          bool     `json:"schema_valid"`
	TopologyValid        bool     `json:"topology_valid"`
	CapabilitiesResolved []string `json:"capabilities_resolved"`
	PolicyCompliant      bool     `json:"policy_compliant"`
	TestsRun             int      `json:"tests_run"`
	TestsPassed          int      `json:"tests_passed"`
	Errors               []string `json:"errors,omitempty"`
}

type AgentSpec struct {
	SpecID           string           `json:"spec_id"`
	SeqID            int64            `json:"seq_id"`
	AgentID          string           `json:"agent_id"`
	Version          string           `json:"version"`
	TenantID         string           `json:"tenant_id"`
	Name             string           `json:"name"`
	Category         string           `json:"category"`
	IR               AgentIR          `json:"ir_payload"`
	ValidationReport ValidationReport `json:"validation_report"`
	ReadinessToken   string           `json:"readiness_token"`
	Status           SpecStatus       `json:"status"`
	CreatedBy        string           `json:"created_by,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

type AgentRun struct {
	RunID            string          `json:"run_id"`
	SeqID            int64           `json:"seq_id"`
	SpecID           string          `json:"spec_id"`
	TenantID         string          `json:"tenant_id"`
	TriggeredBy      string          `json:"triggered_by,omitempty"`
	Status           RunStatus       `json:"status"`
	CurrentStepIndex int             `json:"current_step_index"`
	CurrentNodeID    string          `json:"current_node_id,omitempty"`
	CumulativeSpend  float64         `json:"cumulative_spend"`
	InputsPayload    json.RawMessage `json:"inputs_payload"`
	StatePayload     json.RawMessage `json:"state_payload"`
	FinalOutput      json.RawMessage `json:"final_output,omitempty"`
	ErrorMessage     string          `json:"error_message,omitempty"`
	StartedAt        time.Time       `json:"started_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	CompletedAt      *time.Time      `json:"completed_at,omitempty"`
}

func (r AgentRun) Validate() error {
	if r.RunID == "" || r.SpecID == "" {
		return ErrEmptyIdentifier
	}
	if r.TenantID == "" {
		return ErrEmptyTenantID
	}
	if !r.Status.IsValid() {
		return fmt.Errorf("%w: %s", ErrInvalidRunStatus, r.Status)
	}
	if r.CumulativeSpend < 0 {
		return ErrNegativeAmount
	}
	return nil
}

type RunCheckpoint struct {
	CheckpointID  string           `json:"checkpoint_id"`
	SeqID         int64            `json:"seq_id"`
	RunID         string           `json:"run_id"`
	TenantID      string           `json:"tenant_id"`
	StepIndex     int              `json:"step_index"`
	AttemptNum    int              `json:"attempt_num"`
	NodeID        string           `json:"node_id"`
	NodeType      NodeType         `json:"node_type"`
	NodeInput     json.RawMessage  `json:"node_input"`
	NodeOutput    json.RawMessage  `json:"node_output"`
	StateSnapshot json.RawMessage  `json:"state_snapshot"`
	Status        CheckpointStatus `json:"status"`
	DurationMs    int64            `json:"duration_ms"`
	CreatedAt     time.Time        `json:"created_at"`
}

// ActionIntent records a money-moving or mutating tool intent prior to external execution.
type ActionIntent struct {
	IntentID           string             `json:"intent_id"`
	SeqID              int64              `json:"seq_id"`
	RunID              string             `json:"run_id"`
	TenantID           string             `json:"tenant_id"`
	StepIndex          int                `json:"step_index"`
	CapabilityID       string             `json:"capability_id"`
	IdempotencyKey     string             `json:"idempotency_key"`
	AmountUSD          float64            `json:"amount_usd"`
	RequestPayload     json.RawMessage    `json:"request_payload"`
	ResponsePayload    json.RawMessage    `json:"response_payload,omitempty"`
	ProviderResourceID string             `json:"provider_resource_id,omitempty"`
	Status             ActionIntentStatus `json:"status"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
}

func (a ActionIntent) Validate() error {
	if a.IntentID == "" || a.RunID == "" || a.CapabilityID == "" || a.IdempotencyKey == "" {
		return ErrEmptyIdentifier
	}
	if a.TenantID == "" {
		return ErrEmptyTenantID
	}
	if !a.Status.IsValid() {
		return fmt.Errorf("%w: %s", ErrInvalidIntentStatus, a.Status)
	}
	if a.AmountUSD < 0 {
		return ErrNegativeAmount
	}
	return nil
}

type ApprovalRequest struct {
	ApprovalID       string          `json:"approval_id"`
	SeqID            int64           `json:"seq_id"`
	RunID            string          `json:"run_id"`
	TenantID         string          `json:"tenant_id"`
	StepIndex        int             `json:"step_index"`
	NodeID           string          `json:"node_id"`
	CapabilityID     string          `json:"capability_id"`
	ActionSummary    string          `json:"action_summary"`
	RequestedPayload json.RawMessage `json:"requested_payload"`
	AmountUSD        float64         `json:"amount_usd"`
	Status           ApprovalStatus  `json:"status"`
	TokenHash        string          `json:"-"`
	ApprovedBy       string          `json:"approved_by,omitempty"`
	DecisionReason   string          `json:"decision_reason,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	ExpiresAt        time.Time       `json:"expires_at"`
	ResolvedAt       *time.Time      `json:"resolved_at,omitempty"`
}

func (ar ApprovalRequest) Validate() error {
	if ar.ApprovalID == "" || ar.RunID == "" || ar.CapabilityID == "" || ar.TokenHash == "" {
		return ErrEmptyIdentifier
	}
	if ar.TenantID == "" {
		return ErrEmptyTenantID
	}
	if !ar.Status.IsValid() {
		return fmt.Errorf("%w: %s", ErrInvalidApprovalState, ar.Status)
	}
	if ar.AmountUSD < 0 {
		return ErrNegativeAmount
	}
	return nil
}

type AuditEvent struct {
	EventID        string          `json:"event_id"`
	SeqID          int64           `json:"seq_id"`
	RunID          string          `json:"run_id,omitempty"`
	TenantID       string          `json:"tenant_id"`
	ActorID        string          `json:"actor_id"`
	EventType      AuditEventType  `json:"event_type"`
	CapabilityID   string          `json:"capability_id,omitempty"`
	PolicyDecision string          `json:"policy_decision"`
	RequestDigest  string          `json:"request_digest,omitempty"`
	ResponseDigest string          `json:"response_digest,omitempty"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}