package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/deltix/agent-compiler-service/handlers"
	compilermodels "github.com/deltix/agent-compiler-service/models"
	"github.com/deltix/agent-compiler-service/routes"
	"github.com/deltix/agent-compiler-service/services"
	sharedmodels "github.com/deltix/shared/models"
)

// Test-only mocks live strictly in tests/compiler_test.go (zero fake data in production services/).

type mockCapabilityCatalog struct {
	contracts map[string]services.CapabilityMetadata
}

func newMockCapabilityCatalog() *mockCapabilityCatalog {
	return &mockCapabilityCatalog{
		contracts: map[string]services.CapabilityMetadata{
			"paypal.captures.refund": {
				CapabilityID: "paypal.captures.refund",
				Version:      "1.0.0",
				Description:  "Refund a captured PayPal payment",
				IsMutation:   true,
				IsSensitive:  true,
			},
			"paypal.transactions.list": {
				CapabilityID: "paypal.transactions.list",
				Version:      "1.0.0",
				Description:  "List PayPal transactions",
				IsMutation:   false,
				IsSensitive:  false,
			},
		},
	}
}

func (m *mockCapabilityCatalog) ResolveCapability(_ context.Context, capabilityID string) (services.CapabilityMetadata, bool, error) {
	meta, ok := m.contracts[capabilityID]
	return meta, ok, nil
}

func (m *mockCapabilityCatalog) ListActiveCapabilities(_ context.Context) ([]services.CapabilityMetadata, error) {
	var list []services.CapabilityMetadata
	for _, c := range m.contracts {
		list = append(list, c)
	}
	return list, nil
}

type mockSpecRepo struct {
	specs map[string]sharedmodels.AgentSpec
	logs  []services.CompilationLogEntry
}

func newMockSpecRepo() *mockSpecRepo {
	return &mockSpecRepo{specs: make(map[string]sharedmodels.AgentSpec)}
}

func (m *mockSpecRepo) SaveCompiledSpec(_ context.Context, spec sharedmodels.AgentSpec) error {
	m.specs[spec.SpecID] = spec
	return nil
}

func (m *mockSpecRepo) RecordCompilationLog(_ context.Context, entry services.CompilationLogEntry) error {
	m.logs = append(m.logs, entry)
	return nil
}

func (m *mockSpecRepo) GetSpecByID(_ context.Context, tenantID string, specID string) (sharedmodels.AgentSpec, error) {
	spec, ok := m.specs[specID]
	if !ok || spec.TenantID != tenantID {
		return sharedmodels.AgentSpec{}, services.ErrSpecNotFound
	}
	return spec, nil
}

func (m *mockSpecRepo) ListSpecsByTenant(_ context.Context, tenantID string, _ int64, _ int) ([]sharedmodels.AgentSpec, int64, error) {
	var out []sharedmodels.AgentSpec
	for _, s := range m.specs {
		if s.TenantID == tenantID {
			out = append(out, s)
		}
	}
	return out, 0, nil
}

type mockIRSynthesizer struct{}

func (m *mockIRSynthesizer) Synthesize(
	_ context.Context,
	tenantID string,
	userID string,
	agentID string,
	req compilermodels.CompileRequest,
	_ []services.CapabilityMetadata,
) (services.LLMSynthesisOutput, error) {
	isRefund := strings.Contains(strings.ToLower(req.NaturalLanguagePrompt), "refund")
	if isRefund {
		var questions []compilermodels.ClarificationQuestion
		if strings.TrimSpace(req.Clarifications["max_budget_usd"]) == "" {
			questions = append(questions, compilermodels.ClarificationQuestion{
				Field:       "max_budget_usd",
				Question:    "What is the maximum USD budget cap?",
				WhyRequired: "Required for mutating PayPal agents.",
			})
		}
		if strings.TrimSpace(req.Clarifications["require_human_approval"]) == "" {
			questions = append(questions, compilermodels.ClarificationQuestion{
				Field:       "require_human_approval",
				Question:    "Require human approval before refund?",
				WhyRequired: "Required for sensitive PayPal capabilities.",
			})
		}
		if len(questions) > 0 {
			return services.LLMSynthesisOutput{
				NeedsClarification:     true,
				ClarificationQuestions: questions,
			}, nil
		}

		budget, _ := strconv.ParseFloat(req.Clarifications["max_budget_usd"], 64)
		ir := &sharedmodels.AgentIR{
			IRVersion: sharedmodels.SupportedIRVersion,
			AgentID:   agentID,
			TenantID:  tenantID,
			Metadata: sharedmodels.IRMetadata{
				Name:     req.Name,
				Category: req.Category,
				Author:   userID,
			},
			Capabilities: []sharedmodels.CapabilityRef{
				{CapabilityID: "paypal.captures.refund", Version: "1.0.0", IsSensitive: true},
			},
			Policies: sharedmodels.PolicyConfig{
				ReadOnly:             false,
				MaxBudgetUSD:         budget,
				RequireHumanApproval: true,
			},
			ExecutionLimits: sharedmodels.ExecutionLimits{
				MaxSteps:             10,
				TimeoutSeconds:       30,
				MaxLoopIterations:    1,
				MaxConsecutiveErrors: 2,
			},
			Nodes: []sharedmodels.NodeDefinition{
				{
					ID:          "node_approval",
					Type:        sharedmodels.NodeTypeHumanApproval,
					Description: "Await human approval",
				},
				{
					ID:          "node_refund",
					Type:        sharedmodels.NodeTypeToolExecution,
					Description: "Execute PayPal refund",
					Payload:     sharedmodels.NodePayload{CapabilityID: "paypal.captures.refund"},
				},
				{
					ID:          "node_end",
					Type:        sharedmodels.NodeTypeDeterministicProcess,
					Description: "Terminal sink",
				},
			},
			Transitions: []sharedmodels.TransitionEdge{
				{FromNode: "node_approval", ToNode: "node_refund", IsDefault: true},
				{FromNode: "node_refund", ToNode: "node_end", IsDefault: true},
			},
		}
		return services.LLMSynthesisOutput{AgentIR: ir}, nil
	}

	ir := &sharedmodels.AgentIR{
		IRVersion: sharedmodels.SupportedIRVersion,
		AgentID:   agentID,
		TenantID:  tenantID,
		Metadata: sharedmodels.IRMetadata{
			Name:     req.Name,
			Category: req.Category,
			Author:   userID,
		},
		Capabilities: []sharedmodels.CapabilityRef{
			{CapabilityID: "paypal.transactions.list", Version: "1.0.0", IsSensitive: false},
		},
		Policies: sharedmodels.PolicyConfig{
			ReadOnly:             true,
			MaxBudgetUSD:         0,
			RequireHumanApproval: false,
		},
		ExecutionLimits: sharedmodels.ExecutionLimits{
			MaxSteps:             10,
			TimeoutSeconds:       30,
			MaxLoopIterations:    1,
			MaxConsecutiveErrors: 2,
		},
		Nodes: []sharedmodels.NodeDefinition{
			{
				ID:          "node_list",
				Type:        sharedmodels.NodeTypeToolExecution,
				Description: "List transactions",
				Payload:     sharedmodels.NodePayload{CapabilityID: "paypal.transactions.list"},
			},
			{
				ID:          "node_end",
				Type:        sharedmodels.NodeTypeDeterministicProcess,
				Description: "Terminal sink",
			},
		},
		Transitions: []sharedmodels.TransitionEdge{
			{FromNode: "node_list", ToNode: "node_end", IsDefault: true},
		},
	}
	return services.LLMSynthesisOutput{AgentIR: ir}, nil
}

func TestCompilerSupabaseAndGuardrailPipeline(t *testing.T) {
	repo := newMockSpecRepo()
	catalog := newMockCapabilityCatalog()
	synthesizer := &mockIRSynthesizer{}
	validator := services.NewValidatorService(catalog)
	compiler := services.NewCompilerService(repo, catalog, synthesizer, validator, "test_hmac_secret")
	handler := handlers.NewCompilerHandler(compiler)
	router := routes.NewRouter(handler)

	t.Run("Step 1: money-moving refund prompt without constraints returns CLARIFICATION_REQUIRED and logs to Supabase", func(t *testing.T) {
		body, _ := json.Marshal(compilermodels.CompileRequest{
			Name:                  "Dispute Refund Bot",
			Category:              "REFUNDS",
			NaturalLanguagePrompt: "Refund customer PayPal captures when an item is damaged.",
		})

		req := httptest.NewRequest(http.MethodPost, "/v1/agents/compile", bytes.NewReader(body))
		req.Header.Set("X-Tenant-ID", "ten_1")
		req.Header.Set("X-User-ID", "usr_1")
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var resp compilermodels.CompileResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if resp.Status != compilermodels.OutcomeClarificationRequired {
			t.Fatalf("expected CLARIFICATION_REQUIRED, got %s", resp.Status)
		}
		if len(repo.logs) != 1 || repo.logs[0].Status != "NEEDS_CLARIFICATION" {
			t.Fatalf("expected NEEDS_CLARIFICATION log in Supabase repo, got %+v", repo.logs)
		}
	})

	t.Run("Step 2: prompt WITH clarifications compiles to READY and saves spec to Supabase", func(t *testing.T) {
		body, _ := json.Marshal(compilermodels.CompileRequest{
			Name:                  "Dispute Refund Bot",
			Category:              "REFUNDS",
			NaturalLanguagePrompt: "Refund customer PayPal captures when an item is damaged.",
			Clarifications: map[string]string{
				"max_budget_usd":         "75.00",
				"require_human_approval": "true",
			},
		})

		req := httptest.NewRequest(http.MethodPost, "/v1/agents/compile", bytes.NewReader(body))
		req.Header.Set("X-Tenant-ID", "ten_1")
		req.Header.Set("X-User-ID", "usr_1")
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp compilermodels.CompileResponse
		_ = json.NewDecoder(rec.Body).Decode(&resp)
		if resp.Status != compilermodels.OutcomeReady {
			t.Fatalf("expected READY, got %s (errors: %v)", resp.Status, resp.ValidationReport.Errors)
		}
		if !strings.HasPrefix(resp.ReadinessToken, "rtok_") {
			t.Fatalf("expected signed readiness_token starting with rtok_, got %q", resp.ReadinessToken)
		}
	})
}

func TestValidatorDetectsGraphAndPolicyViolations(t *testing.T) {
	catalog := newMockCapabilityCatalog()
	validator := services.NewValidatorService(catalog)

	badIR := sharedmodels.AgentIR{
		IRVersion: sharedmodels.SupportedIRVersion,
		AgentID:   "agt_bad",
		TenantID:  "ten_1",
		Metadata: sharedmodels.IRMetadata{
			Name:     "Unsafe Agent",
			Category: "PAYMENTS",
		},
		Capabilities: []sharedmodels.CapabilityRef{
			{CapabilityID: "paypal.captures.refund", Version: "1.0.0", IsSensitive: true},
		},
		Policies: sharedmodels.PolicyConfig{
			ReadOnly:             false,
			MaxBudgetUSD:         100.0,
			RequireHumanApproval: false,
		},
		ExecutionLimits: sharedmodels.ExecutionLimits{
			MaxSteps:             10,
			TimeoutSeconds:       30,
			MaxLoopIterations:    1,
			MaxConsecutiveErrors: 2,
		},
		Nodes: []sharedmodels.NodeDefinition{
			{
				ID:          "node_entry",
				Type:        sharedmodels.NodeTypeToolExecution,
				Description: "Refund directly without approval",
				Payload:     sharedmodels.NodePayload{CapabilityID: "paypal.captures.refund"},
			},
			{
				ID:          "node_terminal",
				Type:        sharedmodels.NodeTypeDeterministicProcess,
				Description: "End",
			},
			{
				ID:          "node_orphan",
				Type:        sharedmodels.NodeTypeDeterministicProcess,
				Description: "Orphan node with no incoming edges",
			},
		},
		Transitions: []sharedmodels.TransitionEdge{
			{FromNode: "node_entry", ToNode: "node_terminal", IsDefault: true},
		},
	}

	report, _ := validator.ValidateAndTestIR(context.Background(), badIR)
	if report.TopologyValid {
		t.Fatal("expected TopologyValid=false due to orphan node")
	}
	if report.PolicyCompliant {
		t.Fatal("expected PolicyCompliant=false due to missing approval gate on sensitive tool")
	}
}
