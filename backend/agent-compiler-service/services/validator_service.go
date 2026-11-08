package services

import (
	"context"
	"errors"
	"fmt"

	compilermodels "github.com/deltix/agent-compiler-service/models"
	sharedmodels "github.com/deltix/shared/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	MaxAllowedSteps          = 50
	MinTimeoutSeconds        = 5
	MaxTimeoutSeconds        = 300
	MaxSandboxBudgetLimitUSD = 10000.00
)

type CapabilityMetadata struct {
	CapabilityID string `json:"capability_id"`
	Version      string `json:"version"`
	Description  string `json:"description"`
	IsMutation   bool   `json:"is_mutation"`
	IsSensitive  bool   `json:"is_sensitive"`
}

// CapabilityCatalogResolver resolves registered PayPal capability contracts from Supabase capability_registry.
type CapabilityCatalogResolver interface {
	ResolveCapability(ctx context.Context, capabilityID string) (CapabilityMetadata, bool, error)
	ListActiveCapabilities(ctx context.Context) ([]CapabilityMetadata, error)
}

// PostgresCapabilityCatalog queries the real Supabase PostgreSQL capability_registry table.
type PostgresCapabilityCatalog struct {
	pool *pgxpool.Pool
}

func NewPostgresCapabilityCatalog(pool *pgxpool.Pool) *PostgresCapabilityCatalog {
	return &PostgresCapabilityCatalog{pool: pool}
}

func (c *PostgresCapabilityCatalog) ResolveCapability(
	ctx context.Context,
	capabilityID string,
) (CapabilityMetadata, bool, error) {
	const querySQL = `
		SELECT capability_id, version, description, is_mutation, is_sensitive
		FROM capability_registry
		WHERE capability_id = $1 AND status = 'ACTIVE'
		ORDER BY seq_id DESC
		LIMIT 1
	`
	var meta CapabilityMetadata
	err := c.pool.QueryRow(ctx, querySQL, capabilityID).Scan(
		&meta.CapabilityID,
		&meta.Version,
		&meta.Description,
		&meta.IsMutation,
		&meta.IsSensitive,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return CapabilityMetadata{}, false, nil
	}
	if err != nil {
		return CapabilityMetadata{}, false, fmt.Errorf("query capability_registry for %s: %w", capabilityID, err)
	}
	return meta, true, nil
}

func (c *PostgresCapabilityCatalog) ListActiveCapabilities(ctx context.Context) ([]CapabilityMetadata, error) {
	const listSQL = `
		SELECT capability_id, version, description, is_mutation, is_sensitive
		FROM capability_registry
		WHERE status = 'ACTIVE'
		ORDER BY seq_id ASC
	`
	rows, err := c.pool.Query(ctx, listSQL)
	if err != nil {
		return nil, fmt.Errorf("list active capabilities from capability_registry: %w", err)
	}
	defer rows.Close()

	var capabilities []CapabilityMetadata
	for rows.Next() {
		var meta CapabilityMetadata
		if err := rows.Scan(
			&meta.CapabilityID,
			&meta.Version,
			&meta.Description,
			&meta.IsMutation,
			&meta.IsSensitive,
		); err != nil {
			return nil, fmt.Errorf("scan capability_registry row: %w", err)
		}
		capabilities = append(capabilities, meta)
	}
	return capabilities, rows.Err()
}

type ValidatorService struct {
	catalog CapabilityCatalogResolver
}

func NewValidatorService(catalog CapabilityCatalogResolver) *ValidatorService {
	return &ValidatorService{catalog: catalog}
}

// ValidateAndTestIR executes all static guardrails (schema, graph topology, capability & policy rules)
// followed by deterministic graph traversal verification.
func (v *ValidatorService) ValidateAndTestIR(
	ctx context.Context,
	ir sharedmodels.AgentIR,
) (sharedmodels.ValidationReport, []compilermodels.SyntheticTestResult) {
	report := sharedmodels.ValidationReport{
		CapabilitiesResolved: []string{},
		Errors:               []string{},
	}

	// Stage 1: Structural Schema & Bounds Check
	if err := ir.Validate(); err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("SCHEMA_INVALID: %v", err))
		return report, nil
	}
	if err := validateExecutionBounds(ir.ExecutionLimits); err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("BOUNDS_INVALID: %v", err))
		return report, nil
	}
	report.SchemaValid = true

	// Stage 2: Graph Topology Verification (Reachability, Terminal Sink, Cycle Guard)
	topologyErrors := validateGraphTopology(ir)
	if len(topologyErrors) > 0 {
		report.Errors = append(report.Errors, topologyErrors...)
	} else {
		report.TopologyValid = true
	}

	// Stage 3: Capability Allowlist & Policy Consistency Verification
	resolvedCaps, policyErrors := v.validateCapabilitiesAndPolicies(ctx, ir)
	report.CapabilitiesResolved = resolvedCaps
	if len(policyErrors) > 0 {
		report.Errors = append(report.Errors, policyErrors...)
	} else {
		report.PolicyCompliant = true
	}

	if !report.SchemaValid || !report.TopologyValid || !report.PolicyCompliant {
		return report, nil
	}

	// Stage 4: Deterministic Graph Walk Pre-Flight Verification
	tests := verifyGraphExecutionPaths(ir)
	report.TestsRun = len(tests)
	for _, t := range tests {
		if t.Passed {
			report.TestsPassed++
		} else {
			report.Errors = append(report.Errors, fmt.Sprintf("PREFLIGHT_TEST_FAILED (%s): %s", t.ScenarioName, t.Detail))
		}
	}

	return report, tests
}

func validateExecutionBounds(limits sharedmodels.ExecutionLimits) error {
	if limits.MaxSteps < 1 || limits.MaxSteps > MaxAllowedSteps {
		return fmt.Errorf("max_steps must be between 1 and %d, got %d", MaxAllowedSteps, limits.MaxSteps)
	}
	if limits.TimeoutSeconds < MinTimeoutSeconds || limits.TimeoutSeconds > MaxTimeoutSeconds {
		return fmt.Errorf("timeout_seconds must be between %d and %d, got %d", MinTimeoutSeconds, MaxTimeoutSeconds, limits.TimeoutSeconds)
	}
	return nil
}

func validateGraphTopology(ir sharedmodels.AgentIR) []string {
	var errs []string
	if len(ir.Nodes) == 0 {
		return []string{"EMPTY_GRAPH: no nodes defined"}
	}

	entryNodeID := ir.Nodes[0].ID
	adj := make(map[string][]sharedmodels.TransitionEdge, len(ir.Nodes))
	revAdj := make(map[string][]string, len(ir.Nodes))

	for _, edge := range ir.Transitions {
		adj[edge.FromNode] = append(adj[edge.FromNode], edge)
		revAdj[edge.ToNode] = append(revAdj[edge.ToNode], edge.FromNode)
	}

	// 1. Forward BFS from entry node to detect orphan nodes
	reachable := bfsReachable(entryNodeID, adj)
	for _, node := range ir.Nodes {
		if !reachable[node.ID] {
			errs = append(errs, fmt.Sprintf("ORPHAN_NODE_DETECTED: node %q is unreachable from entry node %q", node.ID, entryNodeID))
		}
	}

	// 2. Identify terminal sink nodes (nodes with 0 outgoing edges) and verify backward reachability
	var terminalNodes []string
	for _, node := range ir.Nodes {
		if len(adj[node.ID]) == 0 {
			terminalNodes = append(terminalNodes, node.ID)
		}
	}
	if len(terminalNodes) == 0 {
		errs = append(errs, "UNBOUNDED_CYCLE_DETECTED: graph has no terminal sink node")
		return errs
	}

	canReachTerminal := bfsBackwardReachable(terminalNodes, revAdj)
	for _, node := range ir.Nodes {
		if !canReachTerminal[node.ID] {
			errs = append(errs, fmt.Sprintf("DEAD_END_NODE: node %q has no path to a terminal node", node.ID))
		}
	}

	// 3. DFS Cycle Detection — if a cycle exists, MaxLoopIterations must be > 0 and <= 10
	if hasDirectedCycle(ir.Nodes, adj) && (ir.ExecutionLimits.MaxLoopIterations <= 0 || ir.ExecutionLimits.MaxLoopIterations > 10) {
		errs = append(errs, "UNBOUNDED_CYCLE_DETECTED: cycle detected without bounded max_loop_iterations (1..10)")
	}

	return errs
}

func bfsReachable(start string, adj map[string][]sharedmodels.TransitionEdge) map[string]bool {
	visited := map[string]bool{start: true}
	queue := []string{start}

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		for _, edge := range adj[curr] {
			if !visited[edge.ToNode] {
				visited[edge.ToNode] = true
				queue = append(queue, edge.ToNode)
			}
		}
	}
	return visited
}

func bfsBackwardReachable(terminals []string, revAdj map[string][]string) map[string]bool {
	visited := make(map[string]bool, len(terminals))
	queue := make([]string, 0, len(terminals))
	for _, t := range terminals {
		visited[t] = true
		queue = append(queue, t)
	}

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		for _, prev := range revAdj[curr] {
			if !visited[prev] {
				visited[prev] = true
				queue = append(queue, prev)
			}
		}
	}
	return visited
}

func hasDirectedCycle(nodes []sharedmodels.NodeDefinition, adj map[string][]sharedmodels.TransitionEdge) bool {
	const (
		unvisited = 0
		visiting  = 1
		visited   = 2
	)
	state := make(map[string]int, len(nodes))

	var dfs func(nodeID string) bool
	dfs = func(nodeID string) bool {
		state[nodeID] = visiting
		for _, edge := range adj[nodeID] {
			nextState := state[edge.ToNode]
			if nextState == visiting {
				return true
			}
			if nextState == unvisited && dfs(edge.ToNode) {
				return true
			}
		}
		state[nodeID] = visited
		return false
	}

	for _, node := range nodes {
		if state[node.ID] == unvisited {
			if dfs(node.ID) {
				return true
			}
		}
	}
	return false
}

func (v *ValidatorService) validateCapabilitiesAndPolicies(
	ctx context.Context,
	ir sharedmodels.AgentIR,
) ([]string, []string) {
	if v.catalog == nil {
		return nil, []string{"CAPABILITY_CATALOG_UNCONFIGURED: capability resolver is nil"}
	}

	var resolved []string
	var errs []string
	seenCaps := make(map[string]bool)

	hasMutationTool := false
	hasSensitiveTool := false
	hasHumanApprovalNode := false

	for _, node := range ir.Nodes {
		if node.Type == sharedmodels.NodeTypeHumanApproval {
			hasHumanApprovalNode = true
		}
		if node.Type != sharedmodels.NodeTypeToolExecution {
			continue
		}

		capID := node.Payload.CapabilityID
		meta, exists, err := v.catalog.ResolveCapability(ctx, capID)
		if err != nil {
			errs = append(errs, fmt.Sprintf("CAPABILITY_LOOKUP_ERROR: %v", err))
			continue
		}
		if !exists {
			errs = append(errs, fmt.Sprintf("UNKNOWN_CAPABILITY: %q is not active in capability_registry", capID))
			continue
		}

		if !seenCaps[capID] {
			seenCaps[capID] = true
			resolved = append(resolved, capID)
		}

		if meta.IsMutation {
			hasMutationTool = true
		}
		if meta.IsSensitive {
			hasSensitiveTool = true
		}
	}

	// Guardrail: Read-Only Mode Isolation
	if ir.Policies.ReadOnly && hasMutationTool {
		errs = append(errs, "READ_ONLY_VIOLATION: read_only policy is true but graph contains mutating PayPal tool nodes")
	}

	// Guardrail: Budget Cap Ceiling for Mutating Agents
	if !ir.Policies.ReadOnly && hasMutationTool {
		if ir.Policies.MaxBudgetUSD <= 0 || ir.Policies.MaxBudgetUSD > MaxSandboxBudgetLimitUSD {
			errs = append(
				errs,
				fmt.Sprintf("INVALID_BUDGET_POLICY: mutating agent must set max_budget_usd between 0.01 and %.2f", MaxSandboxBudgetLimitUSD),
			)
		}
	}

	// Guardrail: Sensitive Money-Moving Tool Requires Human Approval Gate
	if hasSensitiveTool && !ir.Policies.RequireHumanApproval && !hasHumanApprovalNode {
		errs = append(
			errs,
			"MISSING_APPROVAL_GATE: sensitive money-moving capability requires require_human_approval=true or a HUMAN_APPROVAL node",
		)
	}

	return resolved, errs
}

// verifyGraphExecutionPaths walks the compiled AgentIR transitions from the entry node
// to verify terminal reachability within MaxSteps, budget policy enforcement, and error bounds.
func verifyGraphExecutionPaths(ir sharedmodels.AgentIR) []compilermodels.SyntheticTestResult {
	adj := make(map[string][]sharedmodels.TransitionEdge, len(ir.Nodes))
	for _, edge := range ir.Transitions {
		adj[edge.FromNode] = append(adj[edge.FromNode], edge)
	}

	steps := 0
	curr := ir.Nodes[0].ID
	reachedTerminal := false

	for steps < ir.ExecutionLimits.MaxSteps {
		steps++
		edges := adj[curr]
		if len(edges) == 0 {
			reachedTerminal = true
			break
		}
		nextNode := edges[0].ToNode
		for _, e := range edges {
			if e.IsDefault {
				nextNode = e.ToNode
				break
			}
		}
		curr = nextNode
	}

	budgetEnforced := ir.Policies.ReadOnly || (ir.Policies.MaxBudgetUSD > 0 && ir.Policies.MaxBudgetUSD <= MaxSandboxBudgetLimitUSD)
	errorBoundsEnforced := ir.ExecutionLimits.MaxConsecutiveErrors > 0 && ir.ExecutionLimits.MaxConsecutiveErrors <= 10

	return []compilermodels.SyntheticTestResult{
		{
			ScenarioName: "default_path_terminal_traversal",
			Passed:       reachedTerminal,
			StepsVisited: steps,
			Detail:       fmt.Sprintf("Traversed default transition path from %q to terminal %q in %d steps (max_steps=%d).", ir.Nodes[0].ID, curr, steps, ir.ExecutionLimits.MaxSteps),
		},
		{
			ScenarioName: "policy_budget_envelope_check",
			Passed:       budgetEnforced,
			StepsVisited: 1,
			Detail:       fmt.Sprintf("Verified policy envelope: read_only=%v, max_budget_usd=%.2f, require_human_approval=%v.", ir.Policies.ReadOnly, ir.Policies.MaxBudgetUSD, ir.Policies.RequireHumanApproval),
		},
		{
			ScenarioName: "error_circuit_bound_check",
			Passed:       errorBoundsEnforced,
			StepsVisited: 1,
			Detail:       fmt.Sprintf("Verified consecutive error circuit bound: max_consecutive_errors=%d, timeout_seconds=%d.", ir.ExecutionLimits.MaxConsecutiveErrors, ir.ExecutionLimits.TimeoutSeconds),
		},
	}
}
