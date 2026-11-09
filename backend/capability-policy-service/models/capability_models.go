package models

import (
	"errors"
	"strings"

	sharedmodels "github.com/deltix/shared/models"
)

var (
	ErrMissingCapabilityID  = errors.New("capability_id is required")
	ErrUnknownCapability    = errors.New("capability_id is not registered or active")
	ErrMissingApprovalToken = errors.New("sensitive capability requires a verified approval_token")
	ErrInvalidDecision      = errors.New("decision must be APPROVED or REJECTED")
)

type ToolDispatchRequest struct {
	RunID          string                 `json:"run_id"`
	TenantID       string                 `json:"tenant_id"`
	StepIndex      int                    `json:"step_index"`
	CapabilityID   string                 `json:"capability_id"`
	Operation      string                 `json:"operation"`
	Parameters     map[string]interface{} `json:"parameters"`
	ApprovalToken  string                 `json:"approval_token,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
}

func (r ToolDispatchRequest) Validate() error {
	if strings.TrimSpace(r.CapabilityID) == "" {
		return ErrMissingCapabilityID
	}
	return nil
}

type ApprovalDecisionRequest struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason"`
}

func (r ApprovalDecisionRequest) Validate() error {
	d := strings.ToUpper(strings.TrimSpace(r.Decision))
	if d != "APPROVED" && d != "REJECTED" {
		return ErrInvalidDecision
	}
	return nil
}

type ApprovalDecisionResponse struct {
	ApprovalID    string                      `json:"approval_id"`
	RunID         string                      `json:"run_id"`
	Status        sharedmodels.ApprovalStatus `json:"status"`
	ApprovalToken string                      `json:"approval_token,omitempty"`
	ResumedStatus string                      `json:"resumed_status,omitempty"`
	TraceID       string                      `json:"trace_id"`
}

type CapabilityListResponse struct {
	Capabilities []sharedmodels.CapabilityContract `json:"capabilities"`
	TraceID      string                            `json:"trace_id"`
}
