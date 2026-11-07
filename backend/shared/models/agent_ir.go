package models

import (
	"errors"
	"fmt"
	"time"
)

const SupportedIRVersion = "1.0.0"

var (
	ErrUnsupportedIRVersion    = errors.New("unsupported agent ir version")
	ErrMissingAgentMetadata    = errors.New("agent ir metadata name and category are required")
	ErrEmptyNodes              = errors.New("agent ir must define at least one execution node")
	ErrDuplicateNodeID         = errors.New("agent ir contains duplicate node id")
	ErrInvalidNodeType         = errors.New("unsupported node type in agent ir")
	ErrMissingCapabilityRef    = errors.New("tool execution node references undeclared capability")
	ErrUnknownEdgeTarget       = errors.New("transition edge references non-existent node id")
	ErrInvalidExecutionLimits  = errors.New("execution limits must have positive bounds")
	ErrConflictingPolicyConfig = errors.New("read_only policy conflicts with non-zero max_budget_usd")
)

type NodeType string

const (
	NodeTypeLLMReasoning         NodeType = "LLM_REASONING"
	NodeTypeToolExecution        NodeType = "TOOL_EXECUTION"
	NodeTypeDeterministicProcess NodeType = "DETERMINISTIC_PROCESS"
	NodeTypeConditionalRouter    NodeType = "CONDITIONAL_ROUTER"
	NodeTypeHumanApproval        NodeType = "HUMAN_APPROVAL"
	NodeTypeMemoryRetrieval      NodeType = "MEMORY_RETRIEVAL"
	NodeTypeMemoryUpdate         NodeType = "MEMORY_UPDATE"
)

func (nt NodeType) IsValid() bool {
	switch nt {
	case NodeTypeLLMReasoning,
		NodeTypeToolExecution,
		NodeTypeDeterministicProcess,
		NodeTypeConditionalRouter,
		NodeTypeHumanApproval,
		NodeTypeMemoryRetrieval,
		NodeTypeMemoryUpdate:
		return true
	default:
		return false
	}
}

type AgentIR struct {
	Schema          string                     `json:"$schema,omitempty"`
	IRVersion       string                     `json:"ir_version"`
	AgentID         string                     `json:"agent_id"`
	TenantID        string                     `json:"tenant_id"`
	Metadata        IRMetadata                 `json:"metadata"`
	Inputs          map[string]ParameterSchema `json:"inputs"`
	Outputs         map[string]ParameterSchema `json:"outputs"`
	Capabilities    []CapabilityRef            `json:"capabilities"`
	Policies        PolicyConfig               `json:"policies"`
	Memory          MemoryConfig               `json:"memory"`
	ExecutionLimits ExecutionLimits            `json:"execution_limits"`
	Nodes           []NodeDefinition           `json:"nodes"`
	Transitions     []TransitionEdge           `json:"transitions"`
}

type IRMetadata struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	Author      string    `json:"author"`
	CreatedAt   time.Time `json:"created_at"`
}

type ParameterSchema struct {
	Type        string   `json:"type"`
	Format      string   `json:"format,omitempty"`
	Description string   `json:"description,omitempty"`
	Required    bool     `json:"required,omitempty"`
	Enum        []string `json:"enum,omitempty"`
}

type CapabilityRef struct {
	CapabilityID   string   `json:"capability_id"`
	Version        string   `json:"version"`
	IsSensitive    bool     `json:"is_sensitive"`
	AllowedActions []string `json:"allowed_actions"`
}

type PolicyConfig struct {
	ReadOnly             bool     `json:"read_only"`
	MaxBudgetUSD         float64  `json:"max_budget_usd"`
	RequireHumanApproval bool     `json:"require_human_approval"`
	ApprovalTriggers     []string `json:"approval_triggers,omitempty"`
	ForbiddenActions     []string `json:"forbidden_actions,omitempty"`
}

type MemoryConfig struct {
	EnableSemanticMemory bool     `json:"enable_semantic_memory"`
	MemoryNamespace      string   `json:"memory_namespace"`
	MaxRetrievalK        int      `json:"max_retrieval_k"`
	StateKeysToPersist   []string `json:"state_keys_to_persist"`
}

type ExecutionLimits struct {
	MaxSteps             int `json:"max_steps"`
	TimeoutSeconds       int `json:"timeout_seconds"`
	MaxLoopIterations    int `json:"max_loop_iterations"`
	MaxConsecutiveErrors int `json:"max_consecutive_errors"`
}

type RetryConfig struct {
	MaxRetries     int `json:"max_retries"`
	BackoffSeconds int `json:"backoff_seconds"`
}

type NodePayload struct {
	CapabilityID   string                 `json:"capability_id,omitempty"`
	Operation      string                 `json:"operation,omitempty"`
	PromptTemplate string                 `json:"prompt_template,omitempty"`
	Temperature    float64                `json:"temperature,omitempty"`
	ConditionType  string                 `json:"condition_type,omitempty"`
	Expression     string                 `json:"expression,omitempty"`
	ToleranceCents int                    `json:"tolerance_cents,omitempty"`
	StaticOutput   map[string]interface{} `json:"static_output,omitempty"`
}

type NodeDefinition struct {
	ID            string            `json:"id"`
	Type          NodeType          `json:"type"`
	Description   string            `json:"description"`
	InputMapping  map[string]string `json:"input_mapping,omitempty"`
	OutputMapping map[string]string `json:"output_mapping,omitempty"`
	Payload       NodePayload       `json:"payload"`
	RetryPolicy   RetryConfig       `json:"retry_policy"`
	FallbackNode  string            `json:"fallback_node,omitempty"`
}

type TransitionEdge struct {
	FromNode            string `json:"from_node"`
	ToNode              string `json:"to_node"`
	ConditionExpression string `json:"condition_expression,omitempty"`
	IsDefault           bool   `json:"is_default"`
}

// Validate performs deterministic structural verification of the AgentIR contract.
func (ir AgentIR) Validate() error {
	if err := ir.validateHeaderAndMetadata(); err != nil {
		return err
	}
	if err := ir.validatePoliciesAndLimits(); err != nil {
		return err
	}

	declaredCapabilities := ir.indexDeclaredCapabilities()
	nodeIndex, err := ir.validateAndIndexNodes(declaredCapabilities)
	if err != nil {
		return err
	}

	if err := ir.validateTransitions(nodeIndex); err != nil {
		return err
	}

	return nil
}

func (ir AgentIR) validateHeaderAndMetadata() error {
	if ir.IRVersion != SupportedIRVersion {
		return fmt.Errorf("%w: got %q, want %q", ErrUnsupportedIRVersion, ir.IRVersion, SupportedIRVersion)
	}
	if ir.AgentID == "" || ir.TenantID == "" {
		return ErrEmptyIdentifier
	}
	if ir.Metadata.Name == "" || ir.Metadata.Category == "" {
		return ErrMissingAgentMetadata
	}
	return nil
}

func (ir AgentIR) validatePoliciesAndLimits() error {
	if ir.Policies.MaxBudgetUSD < 0 {
		return ErrNegativeAmount
	}
	if ir.Policies.ReadOnly && ir.Policies.MaxBudgetUSD > 0 {
		return ErrConflictingPolicyConfig
	}

	limits := ir.ExecutionLimits
	if limits.MaxSteps <= 0 || limits.TimeoutSeconds <= 0 || limits.MaxLoopIterations < 0 || limits.MaxConsecutiveErrors <= 0 {
		return ErrInvalidExecutionLimits
	}
	return nil
}

func (ir AgentIR) indexDeclaredCapabilities() map[string]CapabilityRef {
	index := make(map[string]CapabilityRef, len(ir.Capabilities))
	for _, capRef := range ir.Capabilities {
		index[capRef.CapabilityID] = capRef
	}
	return index
}

func (ir AgentIR) validateAndIndexNodes(declaredCaps map[string]CapabilityRef) (map[string]NodeDefinition, error) {
	if len(ir.Nodes) == 0 {
		return nil, ErrEmptyNodes
	}

	nodeIndex := make(map[string]NodeDefinition, len(ir.Nodes))
	for _, node := range ir.Nodes {
		if node.ID == "" {
			return nil, ErrEmptyIdentifier
		}
		if _, exists := nodeIndex[node.ID]; exists {
			return nil, fmt.Errorf("%w: %s", ErrDuplicateNodeID, node.ID)
		}
		if !node.Type.IsValid() {
			return nil, fmt.Errorf("%w: %s on node %s", ErrInvalidNodeType, node.Type, node.ID)
		}

		if node.Type == NodeTypeToolExecution {
			capID := node.Payload.CapabilityID
			if capID == "" {
				return nil, fmt.Errorf("%w: empty capability_id on node %s", ErrMissingCapabilityRef, node.ID)
			}
			if _, declared := declaredCaps[capID]; !declared {
				return nil, fmt.Errorf("%w: %s on node %s", ErrMissingCapabilityRef, capID, node.ID)
			}
		}

		nodeIndex[node.ID] = node
	}

	return nodeIndex, nil
}

func (ir AgentIR) validateTransitions(nodeIndex map[string]NodeDefinition) error {
	for _, node := range ir.Nodes {
		if node.FallbackNode != "" {
			if _, exists := nodeIndex[node.FallbackNode]; !exists {
				return fmt.Errorf("%w: fallback_node %s on node %s", ErrUnknownEdgeTarget, node.FallbackNode, node.ID)
			}
		}
	}

	for _, edge := range ir.Transitions {
		if _, fromExists := nodeIndex[edge.FromNode]; !fromExists {
			return fmt.Errorf("%w: from_node %s", ErrUnknownEdgeTarget, edge.FromNode)
		}
		if _, toExists := nodeIndex[edge.ToNode]; !toExists {
			return fmt.Errorf("%w: to_node %s", ErrUnknownEdgeTarget, edge.ToNode)
		}
	}
	return nil
}