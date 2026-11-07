package services

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	compilermodels "github.com/deltix/agent-compiler-service/models"
	sharedmodels "github.com/deltix/shared/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSpecNotFound = errors.New("agent specification not found")
)

type CompilationLogEntry struct {
	LogID                string
	TenantID             string
	SpecID               string
	RawPrompt            string
	ClarificationPayload map[string]string
	CompilerStage        string
	Status               string
	Diagnostics          interface{}
}

type SpecRepository interface {
	SaveCompiledSpec(ctx context.Context, spec sharedmodels.AgentSpec) error
	RecordCompilationLog(ctx context.Context, entry CompilationLogEntry) error
	GetSpecByID(ctx context.Context, tenantID string, specID string) (sharedmodels.AgentSpec, error)
	ListSpecsByTenant(ctx context.Context, tenantID string, cursorSeqID int64, limit int) ([]sharedmodels.AgentSpec, int64, error)
}

type PostgresSpecRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresSpecRepository(pool *pgxpool.Pool) *PostgresSpecRepository {
	return &PostgresSpecRepository{pool: pool}
}

func (r *PostgresSpecRepository) SaveCompiledSpec(ctx context.Context, spec sharedmodels.AgentSpec) error {
	irBytes, err := json.Marshal(spec.IR)
	if err != nil {
		return fmt.Errorf("marshal agent ir: %w", err)
	}

	reportBytes, err := json.Marshal(spec.ValidationReport)
	if err != nil {
		return fmt.Errorf("marshal validation report: %w", err)
	}

	const insertSpecSQL = `
		INSERT INTO agent_specs (
			spec_id, agent_id, version, tenant_id, name, category,
			ir_payload, validation_report, readiness_token, status, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULLIF($11, ''))
	`
	_, err = r.pool.Exec(
		ctx,
		insertSpecSQL,
		spec.SpecID,
		spec.AgentID,
		spec.Version,
		spec.TenantID,
		spec.Name,
		spec.Category,
		irBytes,
		reportBytes,
		spec.ReadinessToken,
		string(spec.Status),
		spec.CreatedBy,
	)
	if err != nil {
		return fmt.Errorf("insert agent_specs row: %w", err)
	}
	return nil
}

func (r *PostgresSpecRepository) RecordCompilationLog(ctx context.Context, entry CompilationLogEntry) error {
	clarifBytes, err := json.Marshal(entry.ClarificationPayload)
	if err != nil {
		clarifBytes = []byte("{}")
	}

	diagBytes, err := json.Marshal(entry.Diagnostics)
	if err != nil {
		diagBytes = []byte("{}")
	}

	const insertLogSQL = `
		INSERT INTO agent_compilation_logs (
			log_id, tenant_id, spec_id, raw_prompt, clarification_payload,
			compiler_stage, status, diagnostics
		) VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8)
	`
	_, err = r.pool.Exec(
		ctx,
		insertLogSQL,
		entry.LogID,
		entry.TenantID,
		entry.SpecID,
		entry.RawPrompt,
		clarifBytes,
		entry.CompilerStage,
		entry.Status,
		diagBytes,
	)
	if err != nil {
		return fmt.Errorf("insert agent_compilation_logs row: %w", err)
	}
	return nil
}

func (r *PostgresSpecRepository) GetSpecByID(ctx context.Context, tenantID string, specID string) (sharedmodels.AgentSpec, error) {
	const selectSpecSQL = `
		SELECT spec_id, seq_id, agent_id, version, tenant_id, name, category,
		       ir_payload, validation_report, readiness_token, status,
		       COALESCE(created_by, ''), created_at, updated_at
		FROM agent_specs
		WHERE tenant_id = $1 AND spec_id = $2
	`
	row := r.pool.QueryRow(ctx, selectSpecSQL, tenantID, specID)
	return scanAgentSpec(row)
}

func (r *PostgresSpecRepository) ListSpecsByTenant(
	ctx context.Context,
	tenantID string,
	cursorSeqID int64,
	limit int,
) ([]sharedmodels.AgentSpec, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	const listSpecsSQL = `
		SELECT spec_id, seq_id, agent_id, version, tenant_id, name, category,
		       ir_payload, validation_report, readiness_token, status,
		       COALESCE(created_by, ''), created_at, updated_at
		FROM agent_specs
		WHERE tenant_id = $1 AND ($2 = 0 OR seq_id < $2)
		ORDER BY seq_id DESC
		LIMIT $3
	`
	rows, err := r.pool.Query(ctx, listSpecsSQL, tenantID, cursorSeqID, limit)
	if err != nil {
		return nil, 0, fmt.Errorf("query agent_specs: %w", err)
	}
	defer rows.Close()

	var specs []sharedmodels.AgentSpec
	var nextCursor int64
	for rows.Next() {
		spec, err := scanAgentSpec(rows)
		if err != nil {
			return nil, 0, err
		}
		specs = append(specs, spec)
		nextCursor = spec.SeqID
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate agent_specs rows: %w", err)
	}

	return specs, nextCursor, nil
}

func scanAgentSpec(row pgx.Row) (sharedmodels.AgentSpec, error) {
	var spec sharedmodels.AgentSpec
	var irRaw []byte
	var reportRaw []byte
	var statusStr string

	err := row.Scan(
		&spec.SpecID,
		&spec.SeqID,
		&spec.AgentID,
		&spec.Version,
		&spec.TenantID,
		&spec.Name,
		&spec.Category,
		&irRaw,
		&reportRaw,
		&spec.ReadinessToken,
		&statusStr,
		&spec.CreatedBy,
		&spec.CreatedAt,
		&spec.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return sharedmodels.AgentSpec{}, ErrSpecNotFound
	}
	if err != nil {
		return sharedmodels.AgentSpec{}, fmt.Errorf("scan agent_specs row: %w", err)
	}

	spec.Status = sharedmodels.SpecStatus(statusStr)
	if err := json.Unmarshal(irRaw, &spec.IR); err != nil {
		return sharedmodels.AgentSpec{}, fmt.Errorf("unmarshal ir_payload: %w", err)
	}
	if err := json.Unmarshal(reportRaw, &spec.ValidationReport); err != nil {
		return sharedmodels.AgentSpec{}, fmt.Errorf("unmarshal validation_report: %w", err)
	}

	return spec, nil
}

type CompilerService struct {
	repo         SpecRepository
	validator    *ValidatorService
	hmacSecret   []byte
	nowUTC       func() time.Time
	idGenerator  func(prefix string) string
}

func NewCompilerService(
	repo SpecRepository,
	validator *ValidatorService,
	hmacSecret string,
) *CompilerService {
	if validator == nil {
		validator = NewValidatorService(nil)
	}
	return &CompilerService{
		repo:        repo,
		validator:   validator,
		hmacSecret:  []byte(hmacSecret),
		nowUTC:      func() time.Time { return time.Now().UTC() },
		idGenerator: generatePrefixedID,
	}
}

// Compile executes the 7-guardrail compilation pipeline:
// 1. Ambiguity & Financial Constraint Clarification Check
// 2. Canonical AgentIR v1.0 Synthesis
// 3. Static Schema, Topology, Capability & Policy Validation + 3 Pre-Flight Mock Tests
// 4. HMAC-SHA256 Readiness Token Signing & Supabase Persistence
func (s *CompilerService) Compile(
	ctx context.Context,
	tenantID string,
	userID string,
	traceID string,
	req compilermodels.CompileRequest,
) (compilermodels.CompileResponse, error) {
	if err := req.Validate(); err != nil {
		return compilermodels.CompileResponse{}, err
	}

	// Stage 1: Guardrail 1 — Detect missing financial constraints on money-moving prompts
	questions := detectMissingGuardrailClarifications(req.NaturalLanguagePrompt, req.Clarifications)
	if len(questions) > 0 {
		_ = s.recordLog(ctx, CompilationLogEntry{
			LogID:                s.idGenerator("log"),
			TenantID:             tenantID,
			RawPrompt:            req.NaturalLanguagePrompt,
			ClarificationPayload: req.Clarifications,
			CompilerStage:        "STAGE_1_AMBIGUITY_DETECTION",
			Status:               "NEEDS_CLARIFICATION",
			Diagnostics:          questions,
		})
		return compilermodels.CompileResponse{
			Status:                 compilermodels.OutcomeClarificationRequired,
			ClarificationQuestions: questions,
			TraceID:                traceID,
		}, nil
	}

	// Stage 2: Synthesize Canonical AgentIR v1.0
	agentID := s.idGenerator("agt")
	specID := s.idGenerator("spc")
	ir := s.synthesizeAgentIR(tenantID, userID, agentID, req)

	// Stage 3: Execute Static Guardrails & Pre-Flight Synthetic Dry-Run Tests
	report, tests := s.validator.ValidateAndTestIR(ctx, ir)
	if len(report.Errors) > 0 || report.TestsPassed < report.TestsRun {
		_ = s.recordLog(ctx, CompilationLogEntry{
			LogID:                s.idGenerator("log"),
			TenantID:             tenantID,
			RawPrompt:            req.NaturalLanguagePrompt,
			ClarificationPayload: req.Clarifications,
			CompilerStage:        "STAGE_3_VALIDATION_AND_PREFLIGHT",
			Status:               "FAILED",
			Diagnostics:          report,
		})
		return compilermodels.CompileResponse{
			Status:           compilermodels.OutcomeFailedValidation,
			AgentIR:          &ir,
			ValidationReport: report,
			SyntheticTests:   tests,
			TraceID:          traceID,
		}, nil
	}

	// Stage 4: Sign Cryptographic Readiness Token & Persist Compiled Spec
	readinessToken, err := s.SignReadinessToken(specID, ir)
	if err != nil {
		return compilermodels.CompileResponse{}, fmt.Errorf("sign readiness token: %w", err)
	}

	spec := sharedmodels.AgentSpec{
		SpecID:           specID,
		AgentID:          agentID,
		Version:          sharedmodels.SupportedIRVersion,
		TenantID:         tenantID,
		Name:             ir.Metadata.Name,
		Category:         ir.Metadata.Category,
		IR:               ir,
		ValidationReport: report,
		ReadinessToken:   readinessToken,
		Status:           sharedmodels.SpecStatusCompiled,
		CreatedBy:        userID,
		CreatedAt:        s.nowUTC(),
		UpdatedAt:        s.nowUTC(),
	}

	if s.repo != nil {
		if err := s.repo.SaveCompiledSpec(ctx, spec); err != nil {
			return compilermodels.CompileResponse{}, fmt.Errorf("save compiled spec: %w", err)
		}
		_ = s.recordLog(ctx, CompilationLogEntry{
			LogID:                s.idGenerator("log"),
			TenantID:             tenantID,
			SpecID:               specID,
			RawPrompt:            req.NaturalLanguagePrompt,
			ClarificationPayload: req.Clarifications,
			CompilerStage:        "STAGE_4_READY",
			Status:               "PASSED",
			Diagnostics:          report,
		})
	}

	return compilermodels.CompileResponse{
		Status:           compilermodels.OutcomeReady,
		SpecID:           specID,
		AgentID:          agentID,
		Version:          spec.Version,
		AgentIR:          &ir,
		ValidationReport: report,
		SyntheticTests:   tests,
		ReadinessToken:   readinessToken,
		TraceID:          traceID,
	}, nil
}

func (s *CompilerService) GetSpec(ctx context.Context, tenantID string, specID string) (sharedmodels.AgentSpec, error) {
	return s.repo.GetSpecByID(ctx, tenantID, specID)
}

func (s *CompilerService) ListSpecs(
	ctx context.Context,
	tenantID string,
	cursor int64,
	limit int,
) ([]sharedmodels.AgentSpec, int64, error) {
	return s.repo.ListSpecsByTenant(ctx, tenantID, cursor, limit)
}

func (s *CompilerService) SignReadinessToken(specID string, ir sharedmodels.AgentIR) (string, error) {
	irBytes, err := json.Marshal(ir)
	if err != nil {
		return "", err
	}
	irDigest := sha256.Sum256(irBytes)

	mac := hmac.New(sha256.New, s.hmacSecret)
	payload := fmt.Sprintf("%s:%s:READY", specID, hex.EncodeToString(irDigest[:]))
	_, _ = mac.Write([]byte(payload))
	return "rtok_" + hex.EncodeToString(mac.Sum(nil)), nil
}

func (s *CompilerService) recordLog(ctx context.Context, entry CompilationLogEntry) error {
	if s.repo == nil {
		return nil
	}
	return s.repo.RecordCompilationLog(ctx, entry)
}

func detectMissingGuardrailClarifications(
	prompt string,
	clarifications map[string]string,
) []compilermodels.ClarificationQuestion {
	lower := strings.ToLower(prompt)
	isMutation := strings.Contains(lower, "refund") ||
		strings.Contains(lower, "capture") ||
		strings.Contains(lower, "create order") ||
		strings.Contains(lower, "charge") ||
		strings.Contains(lower, "pay")

	if !isMutation {
		return nil
	}

	var questions []compilermodels.ClarificationQuestion

	budgetVal := strings.TrimSpace(clarifications["max_budget_usd"])
	if budgetVal == "" {
		questions = append(questions, compilermodels.ClarificationQuestion{
			Field:       "max_budget_usd",
			Question:    "What is the maximum USD budget cap allowed for this money-moving agent per run?",
			WhyRequired: "DelTix requires an explicit USD ceiling (e.g., 50.00 or 250.00) on all mutating PayPal agents.",
			Suggestions: []string{"50.00", "100.00", "500.00"},
		})
	}

	approvalVal := strings.TrimSpace(clarifications["require_human_approval"])
	isSensitive := strings.Contains(lower, "refund") || strings.Contains(lower, "capture")
	if isSensitive && approvalVal == "" {
		questions = append(questions, compilermodels.ClarificationQuestion{
			Field:       "require_human_approval",
			Question:    "Should this agent pause for human operator approval before executing PayPal refunds or captures?",
			WhyRequired: "Sensitive money-moving operations (refunds and captures) require an explicit human-in-the-loop policy.",
			Suggestions: []string{"true"},
		})
	}

	return questions
}

func (s *CompilerService) synthesizeAgentIR(
	tenantID string,
	userID string,
	agentID string,
	req compilermodels.CompileRequest,
) sharedmodels.AgentIR {
	lower := strings.ToLower(req.NaturalLanguagePrompt)
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "DelTix Financial Agent"
	}
	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "PAYPAL_OPERATIONS"
	}

	// Determine target PayPal capability based on prompt intent
	capabilityID := "paypal.transactions.list"
	isMutation := false
	isSensitive := false

	switch {
	case strings.Contains(lower, "refund"):
		capabilityID = "paypal.captures.refund"
		isMutation = true
		isSensitive = true
	case strings.Contains(lower, "capture"):
		capabilityID = "paypal.orders.capture"
		isMutation = true
		isSensitive = true
	case strings.Contains(lower, "create order") || strings.Contains(lower, "charge") || strings.Contains(lower, "pay"):
		capabilityID = "paypal.orders.create"
		isMutation = true
		isSensitive = false
	case strings.Contains(lower, "get order") || strings.Contains(lower, "order status"):
		capabilityID = "paypal.orders.get"
	}

	budgetUSD := 0.0
	if isMutation {
		if parsed, err := strconv.ParseFloat(strings.TrimSpace(req.Clarifications["max_budget_usd"]), 64); err == nil {
			budgetUSD = parsed
		}
	}

	requireApproval := isSensitive || strings.EqualFold(strings.TrimSpace(req.Clarifications["require_human_approval"]), "true")

	nodes := []sharedmodels.NodeDefinition{
		{
			ID:          "node_memory_retrieve",
			Type:        sharedmodels.NodeTypeMemoryRetrieval,
			Description: "Retrieve relevant tenant and customer history from semantic memory.",
		},
		{
			ID:          "node_llm_reason",
			Type:        sharedmodels.NodeTypeLLMReasoning,
			Description: "Analyze input parameters and plan PayPal operation.",
			Payload: sharedmodels.NodePayload{
				PromptTemplate: req.NaturalLanguagePrompt,
				Temperature:    0.0,
			},
		},
	}

	transitions := []sharedmodels.TransitionEdge{
		{FromNode: "node_memory_retrieve", ToNode: "node_llm_reason", IsDefault: true},
	}

	prevNode := "node_llm_reason"
	if requireApproval {
		nodes = append(nodes, sharedmodels.NodeDefinition{
			ID:          "node_human_approval",
			Type:        sharedmodels.NodeTypeHumanApproval,
			Description: "Pause execution and request human operator approval before mutating PayPal state.",
		})
		transitions = append(transitions, sharedmodels.TransitionEdge{
			FromNode:  prevNode,
			ToNode:    "node_human_approval",
			IsDefault: true,
		})
		prevNode = "node_human_approval"
	}

	nodes = append(nodes,
		sharedmodels.NodeDefinition{
			ID:          "node_paypal_tool",
			Type:        sharedmodels.NodeTypeToolExecution,
			Description: "Execute verified PayPal Sandbox capability.",
			Payload: sharedmodels.NodePayload{
				CapabilityID: capabilityID,
				Operation:    "EXECUTE",
			},
			RetryPolicy: sharedmodels.RetryConfig{MaxRetries: 2, BackoffSeconds: 2},
		},
		sharedmodels.NodeDefinition{
			ID:          "node_memory_update",
			Type:        sharedmodels.NodeTypeMemoryUpdate,
			Description: "Record sanitized interaction summary in semantic memory.",
		},
		sharedmodels.NodeDefinition{
			ID:          "node_terminal",
			Type:        sharedmodels.NodeTypeDeterministicProcess,
			Description: "Terminal sink node.",
		},
	)

	transitions = append(transitions,
		sharedmodels.TransitionEdge{FromNode: prevNode, ToNode: "node_paypal_tool", IsDefault: true},
		sharedmodels.TransitionEdge{FromNode: "node_paypal_tool", ToNode: "node_memory_update", IsDefault: true},
		sharedmodels.TransitionEdge{FromNode: "node_memory_update", ToNode: "node_terminal", IsDefault: true},
	)

	return sharedmodels.AgentIR{
		IRVersion: sharedmodels.SupportedIRVersion,
		AgentID:   agentID,
		TenantID:  tenantID,
		Metadata: sharedmodels.IRMetadata{
			Name:        name,
			Description: req.NaturalLanguagePrompt,
			Category:    category,
			Author:      userID,
			CreatedAt:   s.nowUTC(),
		},
		Inputs: map[string]sharedmodels.ParameterSchema{
			"resource_id": {Type: "string", Description: "Target PayPal Order or Capture ID", Required: true},
		},
		Outputs: map[string]sharedmodels.ParameterSchema{
			"status": {Type: "string", Description: "Execution outcome status", Required: true},
		},
		Capabilities: []sharedmodels.CapabilityRef{
			{
				CapabilityID:   capabilityID,
				Version:        "1.0.0",
				IsSensitive:    isSensitive,
				AllowedActions: []string{"EXECUTE"},
			},
		},
		Policies: sharedmodels.PolicyConfig{
			ReadOnly:             !isMutation,
			MaxBudgetUSD:         budgetUSD,
			RequireHumanApproval: requireApproval,
		},
		Memory: sharedmodels.MemoryConfig{
			EnableSemanticMemory: true,
			MemoryNamespace:      fmt.Sprintf("ns_%s_%s", tenantID, agentID),
			MaxRetrievalK:        5,
			StateKeysToPersist:   []string{"summary"},
		},
		ExecutionLimits: sharedmodels.ExecutionLimits{
			MaxSteps:             15,
			TimeoutSeconds:       60,
			MaxLoopIterations:    1,
			MaxConsecutiveErrors: 2,
		},
		Nodes:       nodes,
		Transitions: transitions,
	}
}

func generatePrefixedID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}