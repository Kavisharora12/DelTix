package models

import (
	"testing"
	"time"
)

func TestNodeType_IsValid(t *testing.T) {
	validTypes := []NodeType{
		NodeTypeLLMReasoning,
		NodeTypeToolExecution,
		NodeTypeDeterministicProcess,
		NodeTypeDeterministicMath,
		NodeTypeGroundingVerifier,
		NodeTypeConditionalRouter,
		NodeTypeHumanApproval,
		NodeTypeMemoryRetrieval,
		NodeTypeMemoryUpdate,
	}

	for _, nt := range validTypes {
		if !nt.IsValid() {
			t.Errorf("expected node type %s to be valid", nt)
		}
	}

	invalidTypes := []NodeType{
		"",
		"UNKNOWN",
		"PYTHON_SCRIPT",
		"RANDOM",
	}

	for _, nt := range invalidTypes {
		if nt.IsValid() {
			t.Errorf("expected node type %s to be invalid", nt)
		}
	}
}

func TestAgentIR_Validate(t *testing.T) {
	validIR := AgentIR{
		IRVersion: SupportedIRVersion,
		AgentID:   "agent_payables",
		TenantID:  "tenant_corp",
		Metadata: IRMetadata{
			Name:        "Accounts Payable Reconciler",
			Category:    "finance",
			Description: "Reconciles incoming vendor invoices",
			CreatedAt:   time.Now(),
		},
		ExecutionLimits: ExecutionLimits{
			MaxSteps:              10,
			TimeoutSeconds:        60,
			MaxLoopIterations:     2,
			MaxConsecutiveErrors: 3,
		},
		Policies: PolicyConfig{
			MaxBudgetUSD: 500.0,
			ReadOnly:     false,
		},
		Capabilities: []CapabilityRef{
			{CapabilityID: "paypal.orders.create"},
		},
		Nodes: []NodeDefinition{
			{
				ID:   "node_math",
				Type: NodeTypeDeterministicMath,
			},
			{
				ID:   "node_payout",
				Type: NodeTypeToolExecution,
				Payload: NodePayload{
					CapabilityID: "paypal.orders.create",
				},
			},
		},
		Transitions: []TransitionEdge{
			{
				FromNode: "node_math",
				ToNode:   "node_payout",
			},
		},
	}

	if err := validIR.Validate(); err != nil {
		t.Fatalf("expected valid IR to pass validation, got: %v", err)
	}

	// Test missing agent metadata
	invalidIR := validIR
	invalidIR.Metadata.Name = ""
	if err := invalidIR.Validate(); err == nil {
		t.Errorf("expected error for missing metadata name, got nil")
	}

	// Test unsupported IR version
	invalidIR = validIR
	invalidIR.IRVersion = "99.0.0"
	if err := invalidIR.Validate(); err == nil {
		t.Errorf("expected error for unsupported IR version, got nil")
	}

	// Test duplicate node IDs
	invalidIR = validIR
	invalidIR.Nodes = append(invalidIR.Nodes, NodeDefinition{
		ID:   "node_math",
		Type: NodeTypeDeterministicMath,
	})
	if err := invalidIR.Validate(); err == nil {
		t.Errorf("expected error for duplicate node ID, got nil")
	}

	// Test undeclared capability reference
	invalidIR = validIR
	invalidIR.Nodes = []NodeDefinition{
		{
			ID:   "node_payout",
			Type: NodeTypeToolExecution,
			Payload: NodePayload{
				CapabilityID: "undeclared.capability",
			},
		},
	}
	if err := invalidIR.Validate(); err == nil {
		t.Errorf("expected error for undeclared capability reference, got nil")
	}

	// Test conflicting policy (read-only with max budget > 0)
	invalidIR = validIR
	invalidIR.Policies.ReadOnly = true
	invalidIR.Policies.MaxBudgetUSD = 500.0
	if err := invalidIR.Validate(); err == nil {
		t.Errorf("expected error for conflicting read-only policy with budget, got nil")
	}
}
