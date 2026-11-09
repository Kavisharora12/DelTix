package models

import (
	"encoding/json"
	"errors"
	"strings"

	sharedmodels "github.com/deltix/shared/models"
)

var (
	ErrMissingSpecID      = errors.New("spec_id is required")
	ErrUncompiledSpec     = errors.New("cannot execute agent spec that is not in COMPILED status")
	ErrInvalidReadiness   = errors.New("agent spec readiness_token failed cryptographic HMAC verification")
	ErrRunLocked          = errors.New("agent run is currently locked by another active worker")
	ErrRunNotPaused       = errors.New("agent run is not in PAUSED_FOR_APPROVAL status")
	ErrMissingApprovalDecision = errors.New("approval_status must be APPROVED or REJECTED")
)

type StartRunRequest struct {
	SpecID string                 `json:"spec_id"`
	Inputs map[string]interface{} `json:"inputs"`
}

func (r StartRunRequest) Validate() error {
	if strings.TrimSpace(r.SpecID) == "" {
		return ErrMissingSpecID
	}
	return nil
}

type ResumeRunRequest struct {
	ApprovalID     string `json:"approval_id"`
	ApprovalStatus string `json:"approval_status"`
	ApprovalToken  string `json:"approval_token,omitempty"`
	ApprovedBy     string `json:"approved_by,omitempty"`
	Reason         string `json:"reason,omitempty"`
}

func (r ResumeRunRequest) Validate() error {
	status := strings.ToUpper(strings.TrimSpace(r.ApprovalStatus))
	if status != "APPROVED" && status != "REJECTED" {
		return ErrMissingApprovalDecision
	}
	return nil
}

type WorkerExecuteRequest struct {
	RunID            string                 `json:"run_id"`
	TenantID         string                 `json:"tenant_id"`
	AgentIR          sharedmodels.AgentIR   `json:"agent_ir"`
	Inputs           map[string]interface{} `json:"inputs"`
	PriorState       map[string]interface{} `json:"prior_state,omitempty"`
	ResumeFromNodeID string                 `json:"resume_from_node_id,omitempty"`
	ApprovalStatus   string                 `json:"approval_status,omitempty"`
	ApprovalToken    string                 `json:"approval_token,omitempty"`
}

type WorkerCheckpointItem struct {
	StepIndex  int                    `json:"step_index"`
	NodeID     string                 `json:"node_id"`
	NodeType   sharedmodels.NodeType  `json:"node_type"`
	NodeInput  map[string]interface{} `json:"node_input"`
	NodeOutput map[string]interface{} `json:"node_output"`
	Status     string                 `json:"status"`
	DurationMs int64                  `json:"duration_ms"`
}

type WorkerExecuteResponse struct {
	RunID           string                 `json:"run_id"`
	RunStatus       string                 `json:"run_status"`
	StepIndex       int                    `json:"step_index"`
	CurrentNodeID   string                 `json:"current_node_id"`
	CumulativeSpend float64                `json:"cumulative_spend"`
	Variables       map[string]interface{} `json:"variables"`
	MemoryDegraded  bool                   `json:"memory_degraded"`
	PauseRequested  bool                   `json:"pause_requested"`
	PausedAtNodeID  string                 `json:"paused_at_node_id"`
	PauseSummary    string                 `json:"pause_summary"`
	ErrorMessage    string                 `json:"error_message"`
	Checkpoints     []WorkerCheckpointItem `json:"checkpoints"`
	FinalState      json.RawMessage        `json:"final_state"`
}

type RunDetailResponse struct {
	Run             sharedmodels.AgentRun        `json:"run"`
	Checkpoints     []sharedmodels.RunCheckpoint `json:"checkpoints"`
	PendingApproval *sharedmodels.ApprovalRequest `json:"pending_approval,omitempty"`
	TraceID         string                       `json:"trace_id"`
}

type RunListResponse struct {
	Runs       []sharedmodels.AgentRun `json:"runs"`
	NextCursor int64                   `json:"next_cursor,omitempty"`
	TraceID    string                  `json:"trace_id"`
}
