package tests

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	runtimemodels "github.com/deltix/agent-runtime-service/models"
	"github.com/deltix/agent-runtime-service/services"
	sharedmodels "github.com/deltix/shared/models"
)

type inMemoryRunRepo struct {
	mu          sync.Mutex
	specs       map[string]sharedmodels.AgentSpec
	runs        map[string]sharedmodels.AgentRun
	checkpoints map[string][]sharedmodels.RunCheckpoint
	approvals   map[string]sharedmodels.ApprovalRequest
}

func newInMemoryRunRepo() *inMemoryRunRepo {
	return &inMemoryRunRepo{
		specs:       make(map[string]sharedmodels.AgentSpec),
		runs:        make(map[string]sharedmodels.AgentRun),
		checkpoints: make(map[string][]sharedmodels.RunCheckpoint),
		approvals:   make(map[string]sharedmodels.ApprovalRequest),
	}
}

func (r *inMemoryRunRepo) GetSpecByID(_ context.Context, tenantID string, specID string) (sharedmodels.AgentSpec, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	spec, ok := r.specs[specID]
	if !ok || spec.TenantID != tenantID {
		return sharedmodels.AgentSpec{}, services.ErrSpecNotFound
	}
	return spec, nil
}

func (r *inMemoryRunRepo) CreateRun(_ context.Context, run sharedmodels.AgentRun) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.runs[run.RunID] = run
	return nil
}

func (r *inMemoryRunRepo) UpdateRunProgress(_ context.Context, run sharedmodels.AgentRun) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.runs[run.RunID] = run
	return nil
}

func (r *inMemoryRunRepo) GetRunByID(_ context.Context, tenantID string, runID string) (sharedmodels.AgentRun, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	run, ok := r.runs[runID]
	if !ok || run.TenantID != tenantID {
		return sharedmodels.AgentRun{}, services.ErrRunNotFound
	}
	return run, nil
}

func (r *inMemoryRunRepo) ListRuns(_ context.Context, tenantID string, _ int64, _ int) ([]sharedmodels.AgentRun, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var list []sharedmodels.AgentRun
	for _, run := range r.runs {
		if run.TenantID == tenantID {
			list = append(list, run)
		}
	}
	return list, nil
}

func (r *inMemoryRunRepo) SaveCheckpoint(_ context.Context, cp sharedmodels.RunCheckpoint) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.checkpoints[cp.RunID] = append(r.checkpoints[cp.RunID], cp)
	return nil
}

func (r *inMemoryRunRepo) ListCheckpoints(_ context.Context, _ string, runID string) ([]sharedmodels.RunCheckpoint, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.checkpoints[runID], nil
}

func (r *inMemoryRunRepo) CreateApprovalRequest(_ context.Context, req sharedmodels.ApprovalRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.approvals[req.RunID] = req
	return nil
}

func (r *inMemoryRunRepo) GetPendingApprovalForRun(_ context.Context, _ string, runID string) (*sharedmodels.ApprovalRequest, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	req, ok := r.approvals[runID]
	if !ok {
		return nil, nil
	}
	return &req, nil
}

type fakeWorkerBridge struct {
	calls []runtimemodels.WorkerExecuteRequest
}

func (f *fakeWorkerBridge) ExecuteGraph(
	_ context.Context,
	req runtimemodels.WorkerExecuteRequest,
) (runtimemodels.WorkerExecuteResponse, error) {
	f.calls = append(f.calls, req)
	if req.ApprovalStatus != "APPROVED" {
		return runtimemodels.WorkerExecuteResponse{
			RunID:          req.RunID,
			RunStatus:      "PAUSED_FOR_APPROVAL",
			StepIndex:      2,
			CurrentNodeID:  "node_human_approval",
			PauseRequested: true,
			PausedAtNodeID: "node_human_approval",
			PauseSummary:   "Operator approval required for $45.00 refund",
			Variables:      map[string]interface{}{"amount_usd": 45.0},
			Checkpoints: []runtimemodels.WorkerCheckpointItem{
				{
					StepIndex: 1,
					NodeID:    "node_reason",
					NodeType:  sharedmodels.NodeTypeLLMReasoning,
					Status:    "SUCCEEDED",
				},
				{
					StepIndex: 2,
					NodeID:    "node_human_approval",
					NodeType:  sharedmodels.NodeTypeHumanApproval,
					Status:    "INTERRUPTED",
				},
			},
			FinalState: []byte(`{"step_index":2}`),
		}, nil
	}

	return runtimemodels.WorkerExecuteResponse{
		RunID:           req.RunID,
		RunStatus:       "COMPLETED",
		StepIndex:       4,
		CurrentNodeID:   "node_paypal_refund",
		CumulativeSpend: 45.0,
		Variables: map[string]interface{}{
			"amount_usd":       45.0,
			"paypal_refund_id": "REF_991",
		},
		Checkpoints: []runtimemodels.WorkerCheckpointItem{
			{
				StepIndex: 3,
				NodeID:    "node_human_approval",
				NodeType:  sharedmodels.NodeTypeHumanApproval,
				Status:    "SUCCEEDED",
			},
			{
				StepIndex: 4,
				NodeID:    "node_paypal_refund",
				NodeType:  sharedmodels.NodeTypeToolExecution,
				Status:    "SUCCEEDED",
			},
		},
		FinalState: []byte(`{"step_index":4}`),
	}, nil
}

func signTestReadinessToken(secret string, specID string, ir sharedmodels.AgentIR) string {
	irBytes, _ := json.Marshal(ir)
	digest := sha256.Sum256(irBytes)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(fmt.Sprintf("%s:%s:READY", specID, hex.EncodeToString(digest[:]))))
	return "rtok_" + hex.EncodeToString(mac.Sum(nil))
}

func TestRuntimeStartPauseAndApprovalResume(t *testing.T) {
	ctx := context.Background()
	repo := newInMemoryRunRepo()
	worker := &fakeWorkerBridge{}
	secret := "test-hmac-secret-2026"

	ir := sharedmodels.AgentIR{
		IRVersion: "1.0.0",
		AgentID:   "agt_01",
		TenantID:  "ten_01",
		Capabilities: []sharedmodels.CapabilityRef{
			{CapabilityID: "paypal.captures.refund", Version: "1.0.0", IsSensitive: true},
		},
		Nodes: []sharedmodels.NodeDefinition{
			{ID: "node_reason", Type: sharedmodels.NodeTypeLLMReasoning},
			{ID: "node_human_approval", Type: sharedmodels.NodeTypeHumanApproval},
			{ID: "node_paypal_refund", Type: sharedmodels.NodeTypeToolExecution},
		},
	}

	specID := "spc_01"
	repo.specs[specID] = sharedmodels.AgentSpec{
		SpecID:         specID,
		AgentID:        "agt_01",
		TenantID:       "ten_01",
		Status:         sharedmodels.SpecStatusCompiled,
		IR:             ir,
		ReadinessToken: signTestReadinessToken(secret, specID, ir),
	}

	svc := services.NewRuntimeService(repo, nil, worker, secret, 30*time.Second)

	// 1. StartRun verifies HMAC readiness_token, invokes worker, and pauses on PAUSED_FOR_APPROVAL
	pausedDetail, err := svc.StartRun(ctx, "ten_01", "usr_01", runtimemodels.StartRunRequest{
		SpecID: specID,
		Inputs: map[string]interface{}{"capture_id": "CAP_100"},
	}, "trc_1")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	if pausedDetail.Run.Status != sharedmodels.RunStatusPausedForApproval {
		t.Fatalf("expected status PAUSED_FOR_APPROVAL, got %s", pausedDetail.Run.Status)
	}
	if pausedDetail.PendingApproval == nil {
		t.Fatalf("expected PendingApproval to be created")
	}

	// 2. ResumeRun with APPROVED status and token completes the run
	completedDetail, err := svc.ResumeRun(ctx, "ten_01", pausedDetail.Run.RunID, runtimemodels.ResumeRunRequest{
		ApprovalID:     pausedDetail.PendingApproval.ApprovalID,
		ApprovalStatus: "APPROVED",
		ApprovalToken:  "atok_verified_123",
	}, "trc_2")
	if err != nil {
		t.Fatalf("ResumeRun failed: %v", err)
	}
	if completedDetail.Run.Status != sharedmodels.RunStatusCompleted {
		t.Fatalf("expected status COMPLETED, got %s", completedDetail.Run.Status)
	}
	if completedDetail.Run.CumulativeSpend != 45.0 {
		t.Fatalf("expected cumulative spend 45.0, got %.2f", completedDetail.Run.CumulativeSpend)
	}
}
