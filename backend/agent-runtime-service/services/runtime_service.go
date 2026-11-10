package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	runtimemodels "github.com/deltix/agent-runtime-service/models"
	sharedmodels "github.com/deltix/shared/models"
	runtimev1 "github.com/deltix/shared/proto/runtimev1"
	"google.golang.org/grpc"
)

// WorkerBridgeClient dispatches compiled AgentIR graphs to the Python LangGraph Worker (:8085).
type WorkerBridgeClient interface {
	ExecuteGraph(ctx context.Context, req runtimemodels.WorkerExecuteRequest) (runtimemodels.WorkerExecuteResponse, error)
}

type HTTPWorkerBridgeClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewHTTPWorkerBridgeClient(baseURL string, httpClient *http.Client) *HTTPWorkerBridgeClient {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 60 * time.Second}
	}
	return &HTTPWorkerBridgeClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: httpClient,
	}
}

func (c *HTTPWorkerBridgeClient) ExecuteGraph(
	ctx context.Context,
	req runtimemodels.WorkerExecuteRequest,
) (runtimemodels.WorkerExecuteResponse, error) {
	bodyBytes, err := json.Marshal(req)
	if err != nil {
		return runtimemodels.WorkerExecuteResponse{}, fmt.Errorf("marshal worker execute request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/internal/v1/worker/execute",
		bytes.NewReader(bodyBytes),
	)
	if err != nil {
		return runtimemodels.WorkerExecuteResponse{}, fmt.Errorf("build worker execute request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Tenant-ID", req.TenantID)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return runtimemodels.WorkerExecuteResponse{}, fmt.Errorf("call python langgraph worker: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return runtimemodels.WorkerExecuteResponse{}, fmt.Errorf("python langgraph worker returned status %d", resp.StatusCode)
	}

	var out runtimemodels.WorkerExecuteResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return runtimemodels.WorkerExecuteResponse{}, fmt.Errorf("decode worker execute response: %w", err)
	}
	return out, nil
}

type GRPCWorkerBridgeClient struct {
	client runtimev1.AgentExecutionServiceClient
}

func NewGRPCWorkerBridgeClient(conn grpc.ClientConnInterface) *GRPCWorkerBridgeClient {
	return &GRPCWorkerBridgeClient{
		client: runtimev1.NewAgentExecutionServiceClient(conn),
	}
}

func (c *GRPCWorkerBridgeClient) ExecuteGraph(
	ctx context.Context,
	req runtimemodels.WorkerExecuteRequest,
) (runtimemodels.WorkerExecuteResponse, error) {
	agentIRBytes, err := json.Marshal(req.AgentIR)
	if err != nil {
		return runtimemodels.WorkerExecuteResponse{}, fmt.Errorf("marshal agent_ir: %w", err)
	}
	inputsBytes, _ := json.Marshal(req.Inputs)
	priorStateBytes, _ := json.Marshal(req.PriorState)

	protoReq := &runtimev1.ExecuteGraphRequest{
		RunId:            req.RunID,
		TenantId:         req.TenantID,
		AgentIrJson:      string(agentIRBytes),
		InputsJson:       string(inputsBytes),
		PriorStateJson:   string(priorStateBytes),
		ResumeFromNodeId: req.ResumeFromNodeID,
		ApprovalStatus:   req.ApprovalStatus,
		ApprovalToken:    req.ApprovalToken,
	}

	protoResp, err := c.client.ExecuteGraph(ctx, protoReq)
	if err != nil {
		return runtimemodels.WorkerExecuteResponse{}, fmt.Errorf("grpc execute graph: %w", err)
	}

	var variables map[string]interface{}
	if protoResp.VariablesJson != "" {
		_ = json.Unmarshal([]byte(protoResp.VariablesJson), &variables)
	}

	checkpoints := make([]runtimemodels.WorkerCheckpointItem, 0, len(protoResp.Checkpoints))
	for _, cp := range protoResp.Checkpoints {
		var nodeInput, nodeOutput map[string]interface{}
		_ = json.Unmarshal([]byte(cp.NodeInputJson), &nodeInput)
		_ = json.Unmarshal([]byte(cp.NodeOutputJson), &nodeOutput)
		checkpoints = append(checkpoints, runtimemodels.WorkerCheckpointItem{
			StepIndex:  int(cp.StepIndex),
			NodeID:     cp.NodeId,
			NodeType:   sharedmodels.NodeType(cp.NodeType),
			NodeInput:  nodeInput,
			NodeOutput: nodeOutput,
			Status:     cp.Status,
			DurationMs: cp.DurationMs,
		})
	}

	return runtimemodels.WorkerExecuteResponse{
		RunID:           protoResp.RunId,
		RunStatus:       protoResp.RunStatus,
		StepIndex:       int(protoResp.StepIndex),
		CurrentNodeID:   protoResp.CurrentNodeId,
		CumulativeSpend: protoResp.CumulativeSpend,
		Variables:       variables,
		MemoryDegraded:  protoResp.MemoryDegraded,
		PauseRequested:  protoResp.PauseRequested,
		PausedAtNodeID:  protoResp.PausedAtNodeId,
		PauseSummary:    protoResp.PauseSummary,
		ErrorMessage:    protoResp.ErrorMessage,
		Checkpoints:     checkpoints,
		FinalState:      json.RawMessage(protoResp.FinalStateJson),
	}, nil
}

type RuntimeService struct {
	repo        RunStateRepository
	lockMgr     RunLockManager
	worker      WorkerBridgeClient
	hmacSecret  []byte
	lockTTL     time.Duration
	nowUTC      func() time.Time
	idGenerator func(prefix string) string
}

func NewRuntimeService(
	repo RunStateRepository,
	lockMgr RunLockManager,
	worker WorkerBridgeClient,
	readinessHMACSecret string,
	lockTTL time.Duration,
) *RuntimeService {
	if lockTTL <= 0 {
		lockTTL = 60 * time.Second
	}
	return &RuntimeService{
		repo:        repo,
		lockMgr:     lockMgr,
		worker:      worker,
		hmacSecret:  []byte(readinessHMACSecret),
		lockTTL:     lockTTL,
		nowUTC:      func() time.Time { return time.Now().UTC() },
		idGenerator: generatePrefixedID,
	}
}

// StartRun verifies the compiled AgentSpec readiness_token, creates the ACID agent_run record,
// acquires a distributed Redis lock, and executes the LangGraph worker up to completion or pause.
func (s *RuntimeService) StartRun(
	ctx context.Context,
	tenantID string,
	userID string,
	req runtimemodels.StartRunRequest,
	traceID string,
) (runtimemodels.RunDetailResponse, error) {
	if err := req.Validate(); err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}

	spec, err := s.repo.GetSpecByID(ctx, tenantID, req.SpecID)
	if err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}
	if spec.Status != sharedmodels.SpecStatusCompiled {
		return runtimemodels.RunDetailResponse{}, runtimemodels.ErrUncompiledSpec
	}
	if !s.VerifyReadinessToken(spec.SpecID, spec.IR, spec.ReadinessToken) {
		return runtimemodels.RunDetailResponse{}, runtimemodels.ErrInvalidReadiness
	}

	runID := s.idGenerator("run")
	if s.lockMgr != nil {
		locked, lockErr := s.lockMgr.AcquireRunLock(ctx, runID, s.lockTTL)
		if lockErr != nil {
			return runtimemodels.RunDetailResponse{}, fmt.Errorf("acquire run lock: %w", lockErr)
		}
		if !locked {
			return runtimemodels.RunDetailResponse{}, runtimemodels.ErrRunLocked
		}
		defer func() { _ = s.lockMgr.ReleaseRunLock(context.Background(), runID) }()
	}

	inputsBytes, _ := json.Marshal(req.Inputs)
	now := s.nowUTC()
	entryNodeID := ""
	if len(spec.IR.Nodes) > 0 {
		entryNodeID = spec.IR.Nodes[0].ID
	}

	run := sharedmodels.AgentRun{
		RunID:            runID,
		SpecID:           spec.SpecID,
		TenantID:         tenantID,
		TriggeredBy:      userID,
		Status:           sharedmodels.RunStatusRunning,
		CurrentStepIndex: 0,
		CurrentNodeID:    entryNodeID,
		CumulativeSpend:  0.0,
		InputsPayload:    inputsBytes,
		StatePayload:     []byte("{}"),
		StartedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return runtimemodels.RunDetailResponse{}, fmt.Errorf("create agent_run in supabase: %w", err)
	}

	workerResp, err := s.worker.ExecuteGraph(ctx, runtimemodels.WorkerExecuteRequest{
		RunID:    runID,
		TenantID: tenantID,
		AgentIR:  spec.IR,
		Inputs:   req.Inputs,
	})
	if err != nil {
		run.Status = sharedmodels.RunStatusFailed
		run.ErrorMessage = err.Error()
		completed := s.nowUTC()
		run.UpdatedAt = completed
		run.CompletedAt = &completed
		_ = s.repo.UpdateRunProgress(ctx, run)
		return runtimemodels.RunDetailResponse{}, err
	}

	return s.persistWorkerOutcome(ctx, run, spec.IR, workerResp, traceID)
}

// ResumeRun resumes a PAUSED_FOR_APPROVAL run from its paused node when an operator approves or rejects.
func (s *RuntimeService) ResumeRun(
	ctx context.Context,
	tenantID string,
	runID string,
	req runtimemodels.ResumeRunRequest,
	traceID string,
) (runtimemodels.RunDetailResponse, error) {
	if err := req.Validate(); err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}

	if s.lockMgr != nil {
		locked, lockErr := s.lockMgr.AcquireRunLock(ctx, runID, s.lockTTL)
		if lockErr != nil {
			return runtimemodels.RunDetailResponse{}, fmt.Errorf("acquire run lock: %w", lockErr)
		}
		if !locked {
			return runtimemodels.RunDetailResponse{}, runtimemodels.ErrRunLocked
		}
		defer func() { _ = s.lockMgr.ReleaseRunLock(context.Background(), runID) }()
	}

	run, err := s.repo.GetRunByID(ctx, tenantID, runID)
	if err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}
	if run.Status != sharedmodels.RunStatusPausedForApproval {
		return runtimemodels.RunDetailResponse{}, runtimemodels.ErrRunNotPaused
	}

	decision := strings.ToUpper(strings.TrimSpace(req.ApprovalStatus))
	if decision == "REJECTED" {
		now := s.nowUTC()
		run.Status = sharedmodels.RunStatusRejected
		run.ErrorMessage = "Operator rejected human approval gate: " + req.Reason
		run.UpdatedAt = now
		run.CompletedAt = &now
		if err := s.repo.UpdateRunProgress(ctx, run); err != nil {
			return runtimemodels.RunDetailResponse{}, err
		}
		cps, _ := s.repo.ListCheckpoints(ctx, tenantID, runID)
		return runtimemodels.RunDetailResponse{
			Run:         run,
			Checkpoints: cps,
			TraceID:     traceID,
		}, nil
	}

	spec, err := s.repo.GetSpecByID(ctx, tenantID, run.SpecID)
	if err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}

	var inputsMap map[string]interface{}
	_ = json.Unmarshal(run.InputsPayload, &inputsMap)
	var priorStateMap map[string]interface{}
	_ = json.Unmarshal(run.StatePayload, &priorStateMap)

	workerResp, err := s.worker.ExecuteGraph(ctx, runtimemodels.WorkerExecuteRequest{
		RunID:            run.RunID,
		TenantID:         tenantID,
		AgentIR:          spec.IR,
		Inputs:           inputsMap,
		PriorState:       priorStateMap,
		ResumeFromNodeID: run.CurrentNodeID,
		ApprovalStatus:   "APPROVED",
		ApprovalToken:    req.ApprovalToken,
	})
	if err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}

	return s.persistWorkerOutcome(ctx, run, spec.IR, workerResp, traceID)
}

func (s *RuntimeService) GetRunDetail(
	ctx context.Context,
	tenantID string,
	runID string,
	traceID string,
) (runtimemodels.RunDetailResponse, error) {
	run, err := s.repo.GetRunByID(ctx, tenantID, runID)
	if err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}
	checkpoints, err := s.repo.ListCheckpoints(ctx, tenantID, runID)
	if err != nil {
		return runtimemodels.RunDetailResponse{}, err
	}
	pendingApproval, _ := s.repo.GetPendingApprovalForRun(ctx, tenantID, runID)
	return runtimemodels.RunDetailResponse{
		Run:             run,
		Checkpoints:     checkpoints,
		PendingApproval: pendingApproval,
		TraceID:         traceID,
	}, nil
}

func (s *RuntimeService) ListRuns(
	ctx context.Context,
	tenantID string,
	cursor int64,
	limit int,
) ([]sharedmodels.AgentRun, int64, error) {
	runs, err := s.repo.ListRuns(ctx, tenantID, cursor, limit)
	if err != nil {
		return nil, 0, err
	}
	var nextCursor int64
	if len(runs) > 0 {
		nextCursor = runs[len(runs)-1].SeqID
	}
	return runs, nextCursor, nil
}

func (s *RuntimeService) persistWorkerOutcome(
	ctx context.Context,
	run sharedmodels.AgentRun,
	ir sharedmodels.AgentIR,
	workerResp runtimemodels.WorkerExecuteResponse,
	traceID string,
) (runtimemodels.RunDetailResponse, error) {
	now := s.nowUTC()
	var savedCheckpoints []sharedmodels.RunCheckpoint

	for _, item := range workerResp.Checkpoints {
		inBytes, _ := json.Marshal(item.NodeInput)
		outBytes, _ := json.Marshal(item.NodeOutput)
		cp := sharedmodels.RunCheckpoint{
			CheckpointID:  s.idGenerator("chk"),
			RunID:         run.RunID,
			TenantID:      run.TenantID,
			StepIndex:     item.StepIndex,
			AttemptNum:    1,
			NodeID:        item.NodeID,
			NodeType:      item.NodeType,
			NodeInput:     inBytes,
			NodeOutput:    outBytes,
			StateSnapshot: defaultJSON(workerResp.FinalState),
			Status:        sharedmodels.CheckpointStatus(item.Status),
			DurationMs:    item.DurationMs,
			CreatedAt:     now,
		}
		_ = s.repo.SaveCheckpoint(ctx, cp)
		savedCheckpoints = append(savedCheckpoints, cp)
	}

	run.Status = sharedmodels.RunStatus(workerResp.RunStatus)
	run.CurrentStepIndex = workerResp.StepIndex
	run.CurrentNodeID = workerResp.CurrentNodeID
	run.CumulativeSpend = workerResp.CumulativeSpend
	run.StatePayload = defaultJSON(workerResp.FinalState)
	run.ErrorMessage = workerResp.ErrorMessage
	run.UpdatedAt = now

	if workerResp.Variables != nil {
		outBytes, _ := json.Marshal(workerResp.Variables)
		run.FinalOutput = outBytes
	}

	var pendingApproval *sharedmodels.ApprovalRequest
	if run.Status == sharedmodels.RunStatusPausedForApproval {
		run.CurrentNodeID = workerResp.PausedAtNodeID
		capID, capErr := resolveTargetCapabilityForPausedNode(ir, workerResp.PausedAtNodeID)
		if capErr != nil {
			return runtimemodels.RunDetailResponse{}, capErr
		}
		amountUSD := extractAmountUSD(workerResp.Variables)
		reqBytes, _ := json.Marshal(workerResp.Variables)
		tokenSeed := s.idGenerator("thash")
		approvalReq := sharedmodels.ApprovalRequest{
			ApprovalID:       s.idGenerator("apr"),
			RunID:            run.RunID,
			TenantID:         run.TenantID,
			StepIndex:        workerResp.StepIndex,
			NodeID:           workerResp.PausedAtNodeID,
			CapabilityID:     capID,
			ActionSummary:    workerResp.PauseSummary,
			RequestedPayload: reqBytes,
			AmountUSD:        amountUSD,
			Status:           sharedmodels.ApprovalStatusPending,
			TokenHash:        tokenSeed,
			CreatedAt:        now,
			ExpiresAt:        now.Add(24 * time.Hour),
		}
		_ = s.repo.CreateApprovalRequest(ctx, approvalReq)
		pendingApproval = &approvalReq
	} else if run.Status.IsTerminal() {
		run.CompletedAt = &now
	}

	if err := s.repo.UpdateRunProgress(ctx, run); err != nil {
		return runtimemodels.RunDetailResponse{}, fmt.Errorf("update agent_run progress: %w", err)
	}

	allCheckpoints, err := s.repo.ListCheckpoints(ctx, run.TenantID, run.RunID)
	if err == nil && len(allCheckpoints) > 0 {
		savedCheckpoints = allCheckpoints
	}

	return runtimemodels.RunDetailResponse{
		Run:             run,
		Checkpoints:     savedCheckpoints,
		PendingApproval: pendingApproval,
		TraceID:         traceID,
	}, nil
}

func (s *RuntimeService) VerifyReadinessToken(
	specID string,
	ir sharedmodels.AgentIR,
	token string,
) bool {
	if !strings.HasPrefix(token, "rtok_") {
		return false
	}
	irBytes, err := json.Marshal(ir)
	if err != nil {
		return false
	}
	irDigest := sha256.Sum256(irBytes)
	mac := hmac.New(sha256.New, s.hmacSecret)
	payload := fmt.Sprintf("%s:%s:READY", specID, hex.EncodeToString(irDigest[:]))
	_, _ = mac.Write([]byte(payload))
	expected := "rtok_" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(token))
}

func resolveTargetCapabilityForPausedNode(
	ir sharedmodels.AgentIR,
	pausedNodeID string,
) (string, error) {
	nodeByID := make(map[string]sharedmodels.NodeDefinition, len(ir.Nodes))
	for _, n := range ir.Nodes {
		nodeByID[n.ID] = n
	}

	if pausedNode, exists := nodeByID[pausedNodeID]; exists && pausedNode.Payload.CapabilityID != "" {
		return pausedNode.Payload.CapabilityID, nil
	}

	adj := make(map[string][]string, len(ir.Nodes))
	for _, edge := range ir.Transitions {
		adj[edge.FromNode] = append(adj[edge.FromNode], edge.ToNode)
	}

	// BFS from pausedNodeID to find the actual downstream TOOL_EXECUTION node guarded by this approval gate
	visited := map[string]bool{pausedNodeID: true}
	queue := []string{pausedNodeID}
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		for _, nextID := range adj[curr] {
			if visited[nextID] {
				continue
			}
			visited[nextID] = true
			if nextNode, ok := nodeByID[nextID]; ok {
				if nextNode.Type == sharedmodels.NodeTypeToolExecution && nextNode.Payload.CapabilityID != "" {
					return nextNode.Payload.CapabilityID, nil
				}
			}
			queue = append(queue, nextID)
		}
	}

	for _, c := range ir.Capabilities {
		if c.IsSensitive {
			return c.CapabilityID, nil
		}
	}
	if len(ir.Capabilities) > 0 {
		return ir.Capabilities[0].CapabilityID, nil
	}
	return "", fmt.Errorf("paused node %q has no downstream capability configured in AgentIR", pausedNodeID)
}

func extractAmountUSD(vars map[string]interface{}) float64 {
	if vars == nil {
		return 0.0
	}
	if v, ok := vars["amount_usd"].(float64); ok {
		return v
	}
	return 0.0
}

func generatePrefixedID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}
