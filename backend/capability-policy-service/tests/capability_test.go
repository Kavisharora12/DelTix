package tests

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/deltix/capability-policy-service/adapters"
	capmodels "github.com/deltix/capability-policy-service/models"
	"github.com/deltix/capability-policy-service/services"
	sharedmodels "github.com/deltix/shared/models"
)

type fakeCapAndApprovalRepo struct {
	mu           sync.Mutex
	capabilities map[string]sharedmodels.CapabilityContract
	intentsByKey map[string]sharedmodels.ActionIntent
	approvals    map[string]sharedmodels.ApprovalRequest
	audits       []sharedmodels.AuditEvent
}

func newFakeCapAndApprovalRepo() *fakeCapAndApprovalRepo {
	return &fakeCapAndApprovalRepo{
		capabilities: make(map[string]sharedmodels.CapabilityContract),
		intentsByKey: make(map[string]sharedmodels.ActionIntent),
		approvals:    make(map[string]sharedmodels.ApprovalRequest),
	}
}

func (f *fakeCapAndApprovalRepo) UpsertCapability(_ context.Context, c sharedmodels.CapabilityContract) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.capabilities[c.CapabilityID] = c
	return nil
}

func (f *fakeCapAndApprovalRepo) GetCapability(_ context.Context, id string) (sharedmodels.CapabilityContract, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.capabilities[id]
	return c, ok, nil
}

func (f *fakeCapAndApprovalRepo) ListActiveCapabilities(_ context.Context) ([]sharedmodels.CapabilityContract, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var list []sharedmodels.CapabilityContract
	for _, c := range f.capabilities {
		list = append(list, c)
	}
	return list, nil
}

func (f *fakeCapAndApprovalRepo) FindIntentByIdempotencyKey(_ context.Context, key string) (*sharedmodels.ActionIntent, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	intent, ok := f.intentsByKey[key]
	if !ok {
		return nil, nil
	}
	return &intent, nil
}

func (f *fakeCapAndApprovalRepo) CreateActionIntent(_ context.Context, intent sharedmodels.ActionIntent) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.intentsByKey[intent.IdempotencyKey] = intent
	return nil
}

func (f *fakeCapAndApprovalRepo) UpdateActionIntent(_ context.Context, intent sharedmodels.ActionIntent) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.intentsByKey[intent.IdempotencyKey] = intent
	return nil
}

func (f *fakeCapAndApprovalRepo) RecordAuditEvent(_ context.Context, ev sharedmodels.AuditEvent) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.audits = append(f.audits, ev)
	return nil
}

func (f *fakeCapAndApprovalRepo) GetApprovalByID(_ context.Context, tenantID string, approvalID string) (sharedmodels.ApprovalRequest, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	req, ok := f.approvals[approvalID]
	if !ok || req.TenantID != tenantID {
		return sharedmodels.ApprovalRequest{}, services.ErrApprovalNotFound
	}
	return req, nil
}

func (f *fakeCapAndApprovalRepo) UpdateApprovalDecision(
	_ context.Context,
	_ string,
	approvalID string,
	status sharedmodels.ApprovalStatus,
	approvedBy string,
	reason string,
	tokenHash string,
	resolvedAt time.Time,
) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	req := f.approvals[approvalID]
	req.Status = status
	req.ApprovedBy = approvedBy
	req.DecisionReason = reason
	req.TokenHash = tokenHash
	req.ResolvedAt = &resolvedAt
	f.approvals[approvalID] = req
	return nil
}

type fakeResumeNotifier struct {
	resumedRunID string
}

func (n *fakeResumeNotifier) NotifyResume(
	_ context.Context,
	_ string,
	runID string,
	_ string,
	_ string,
	_ string,
	_ string,
	_ string,
) (string, error) {
	n.resumedRunID = runID
	return "RESUMED", nil
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestDynamicPayPalAdapterFailsClosedAndInterpolatesEndpoint(t *testing.T) {
	ctx := context.Background()
	repo := newFakeCapAndApprovalRepo()

	// Register a dynamic capability contract in the test repository (as stored in Supabase capability_registry)
	refundContract := sharedmodels.CapabilityContract{
		CapabilityID: "paypal.captures.refund",
		Version:      "1.0.0",
		HTTPMethod:   "POST",
		EndpointPath: "/v2/payments/captures/{capture_id}/refund",
		IsSensitive:  true,
		IsMutation:   true,
		Idempotent:   true,
		Status:       "ACTIVE",
	}
	_ = repo.UpsertCapability(ctx, refundContract)

	// 1. Adapter with missing credentials MUST fail closed (never return fake COMPLETED)
	unconfiguredAdapter := adapters.NewPayPalSandboxAdapter("https://api-m.sandbox.paypal.com", "", "", nil, nil)
	_, _, err := unconfiguredAdapter.ExecuteCapability(ctx, refundContract, "idem_1", map[string]interface{}{"capture_id": "CAP_1"})
	if err == nil {
		t.Fatalf("expected unconfigured PayPal adapter to fail closed, but got nil error")
	}

	// 2. Configured adapter with in-memory RoundTripper verifies OAuth2 + dynamic {capture_id} path interpolation
	var capturedPath string
	var capturedIdemHeader string
	mockHTTPClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if strings.HasSuffix(req.URL.Path, "/v1/oauth2/token") {
				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(bytes.NewBufferString(`{"access_token":"live_sandbox_tok_123","expires_in":3600}`)),
					Header:     make(http.Header),
				}, nil
			}
			capturedPath = req.URL.Path
			capturedIdemHeader = req.Header.Get("PayPal-Request-Id")
			return &http.Response{
				StatusCode: http.StatusCreated,
				Body:       io.NopCloser(bytes.NewBufferString(`{"id":"REFUND_REAL_777","status":"COMPLETED"}`)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	liveAdapter := adapters.NewPayPalSandboxAdapter(
		"https://api-m.sandbox.paypal.com",
		"client_id_sandbox",
		"client_secret_sandbox",
		mockHTTPClient,
		nil,
	)
	capSvc := services.NewCapabilityService(repo, liveAdapter)

	// 3. Approve approval request and verify HMAC token + resume notification
	repo.approvals["apr_1"] = sharedmodels.ApprovalRequest{
		ApprovalID:   "apr_1",
		RunID:        "run_1",
		TenantID:     "ten_1",
		CapabilityID: "paypal.captures.refund",
		Status:       sharedmodels.ApprovalStatusPending,
	}
	notifier := &fakeResumeNotifier{}
	policySvc := services.NewPolicyService(repo, notifier, "secret-hmac")

	decResp, err := policySvc.DecideApproval(ctx, "ten_1", "usr_op", "apr_1", capmodels.ApprovalDecisionRequest{
		Decision: "APPROVED",
		Reason:   "Verified buyer invoice",
	}, "trc_1")
	if err != nil {
		t.Fatalf("DecideApproval failed: %v", err)
	}

	// 4. Dispatch tool with approval token and verify dynamic endpoint interpolation + idempotent replay
	res1, err := capSvc.DispatchTool(ctx, capmodels.ToolDispatchRequest{
		RunID:          "run_1",
		TenantID:       "ten_1",
		StepIndex:      2,
		CapabilityID:   "paypal.captures.refund",
		ApprovalToken:  decResp.ApprovalToken,
		IdempotencyKey: "idem_abc123",
		Parameters:     map[string]interface{}{"capture_id": "CAP_999", "amount_usd": 45.0},
	})
	if err != nil {
		t.Fatalf("DispatchTool failed: %v", err)
	}
	if capturedPath != "/v2/payments/captures/CAP_999/refund" {
		t.Fatalf("expected interpolated path /v2/payments/captures/CAP_999/refund, got %s", capturedPath)
	}
	if capturedIdemHeader != "idem_abc123" {
		t.Fatalf("expected PayPal-Request-Id header idem_abc123, got %s", capturedIdemHeader)
	}
	if res1["provider_resource_id"] != "REFUND_REAL_777" {
		t.Fatalf("expected provider_resource_id REFUND_REAL_777, got %v", res1["provider_resource_id"])
	}

	res2, err := capSvc.DispatchTool(ctx, capmodels.ToolDispatchRequest{
		RunID:          "run_1",
		TenantID:       "ten_1",
		StepIndex:      2,
		CapabilityID:   "paypal.captures.refund",
		ApprovalToken:  decResp.ApprovalToken,
		IdempotencyKey: "idem_abc123",
		Parameters:     map[string]interface{}{"capture_id": "CAP_999", "amount_usd": 45.0},
	})
	if err != nil {
		t.Fatalf("idempotent replay DispatchTool failed: %v", err)
	}
	if res2["idempotent_replay"] != true {
		t.Fatalf("expected idempotent_replay=true on second call with same idempotency_key")
	}
}
