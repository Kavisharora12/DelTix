package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/deltix/agent-compiler-service/config"
	compilermodels "github.com/deltix/agent-compiler-service/models"
	sharedmodels "github.com/deltix/shared/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSpecNotFound            = errors.New("agent specification not found")
	ErrAllGeminiModelsExhausted = errors.New("all gemini models exhausted or rate-limited in sliding window")
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

// LLMSynthesisOutput represents the structured JSON response from the Gemini compiler model.
type LLMSynthesisOutput struct {
	NeedsClarification     bool                                   `json:"needs_clarification"`
	ClarificationQuestions []compilermodels.ClarificationQuestion `json:"clarification_questions,omitempty"`
	AgentIR                *sharedmodels.AgentIR                  `json:"agent_ir,omitempty"`
}

// IRSynthesizer abstracts the structured LLM call that analyzes a prompt against registered capabilities.
type IRSynthesizer interface {
	Synthesize(
		ctx context.Context,
		tenantID string,
		userID string,
		agentID string,
		req compilermodels.CompileRequest,
		activeCapabilities []CapabilityMetadata,
	) (LLMSynthesisOutput, error)
}

// SlidingWindowLimiter enforces a per-model sliding-window rate limit so when one Gemini model
// hits its per-window quota, the synthesizer immediately falls back to the next Gemini model.
type SlidingWindowLimiter struct {
	mu          sync.Mutex
	window      time.Duration
	maxRequests int
	timestamps  map[string][]time.Time
}

func NewSlidingWindowLimiter(maxRequests int, window time.Duration) *SlidingWindowLimiter {
	if maxRequests <= 0 {
		maxRequests = 15
	}
	if window <= 0 {
		window = time.Minute
	}
	return &SlidingWindowLimiter{
		window:      window,
		maxRequests: maxRequests,
		timestamps:  make(map[string][]time.Time),
	}
}

func (l *SlidingWindowLimiter) Allow(model string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := now.Add(-l.window)
	history := l.timestamps[model]

	// Slide the window: keep only timestamps strictly within [now - window, now]
	validIdx := 0
	for _, ts := range history {
		if ts.After(cutoff) {
			history[validIdx] = ts
			validIdx++
		}
	}
	history = history[:validIdx]

	if len(history) >= l.maxRequests {
		l.timestamps[model] = history
		return false
	}

	l.timestamps[model] = append(history, now)
	return true
}

const geminiAPIBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// GeminiIRSynthesizer calls Google Gemini's generateContent REST API using a multi-model
// fallback cascade guarded by a per-model SlidingWindowLimiter.
type GeminiIRSynthesizer struct {
	apiKey     string
	models     []string
	limiter    *SlidingWindowLimiter
	httpClient *http.Client
	nowUTC     func() time.Time
}

func NewGeminiIRSynthesizer(
	apiKey string,
	models []string,
	rpmPerModel int,
	window time.Duration,
	httpClient *http.Client,
) *GeminiIRSynthesizer {
	if len(models) == 0 {
		models = config.DefaultGeminiModels
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &GeminiIRSynthesizer{
		apiKey:     apiKey,
		models:     models,
		limiter:    NewSlidingWindowLimiter(rpmPerModel, window),
		httpClient: httpClient,
		nowUTC:     func() time.Time { return time.Now().UTC() },
	}
}

func (g *GeminiIRSynthesizer) Synthesize(
	ctx context.Context,
	tenantID string,
	userID string,
	agentID string,
	req compilermodels.CompileRequest,
	activeCapabilities []CapabilityMetadata,
) (LLMSynthesisOutput, error) {
	systemPrompt, userPrompt := buildGeminiCompilerPrompts(tenantID, userID, agentID, req, activeCapabilities)

	var attemptErrors []string
	now := g.nowUTC()

	for _, model := range g.models {
		if !g.limiter.Allow(model, now) {
			attemptErrors = append(attemptErrors, fmt.Sprintf("%s: sliding window rate limit reached", model))
			continue
		}

		out, retryNextModel, err := g.callGeminiModel(ctx, model, systemPrompt, userPrompt)
		if err == nil {
			return out, nil
		}

		attemptErrors = append(attemptErrors, fmt.Sprintf("%s: %v", model, err))
		if !retryNextModel {
			return LLMSynthesisOutput{}, err
		}
	}

	return LLMSynthesisOutput{}, fmt.Errorf("%w: [%s]", ErrAllGeminiModelsExhausted, strings.Join(attemptErrors, "; "))
}

func (g *GeminiIRSynthesizer) callGeminiModel(
	ctx context.Context,
	model string,
	systemPrompt string,
	userPrompt string,
) (LLMSynthesisOutput, bool, error) {
	geminiBody, err := json.Marshal(map[string]interface{}{
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]string{
				{"text": systemPrompt},
			},
		},
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]string{
					{"text": userPrompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":      0.0,
			"responseMimeType": "application/json",
		},
	})
	if err != nil {
		return LLMSynthesisOutput{}, false, fmt.Errorf("marshal gemini request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/models/%s:generateContent?key=%s", geminiAPIBaseURL, model, g.apiKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(geminiBody))
	if err != nil {
		return LLMSynthesisOutput{}, false, fmt.Errorf("create gemini http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(httpReq)
	if err != nil {
		// Network timeout or transient error -> try next Gemini model in cascade
		return LLMSynthesisOutput{}, true, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// On 429 (Quota/Rate Limit), 404 (Model unavailable), or 5xx (Server Overload) -> try next Gemini model
	if resp.StatusCode == http.StatusTooManyRequests ||
		resp.StatusCode == http.StatusNotFound ||
		resp.StatusCode >= http.StatusInternalServerError {
		return LLMSynthesisOutput{}, true, fmt.Errorf("status %d", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		return LLMSynthesisOutput{}, false, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return LLMSynthesisOutput{}, true, fmt.Errorf("decode gemini response: %w", err)
	}
	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return LLMSynthesisOutput{}, true, errors.New("empty candidates from gemini")
	}

	rawJSON := geminiResp.Candidates[0].Content.Parts[0].Text
	var out LLMSynthesisOutput
	if err := json.Unmarshal([]byte(rawJSON), &out); err != nil {
		return LLMSynthesisOutput{}, true, fmt.Errorf("unmarshal structured json from %s: %w", model, err)
	}

	return out, false, nil
}

func buildGeminiCompilerPrompts(
	tenantID string,
	userID string,
	agentID string,
	req compilermodels.CompileRequest,
	activeCapabilities []CapabilityMetadata,
) (string, string) {
	capsJSON, _ := json.Marshal(activeCapabilities)
	clarifJSON, _ := json.Marshal(req.Clarifications)

	systemPrompt := fmt.Sprintf(`You are the DelTix Deterministic Financial AI Agent Compiler powered by Google Gemini.
Your job is to compile a user's natural language request into a JSON object matching LLMSynthesisOutput:
{
  "needs_clarification": boolean,
  "clarification_questions": [{"field": string, "question": string, "why_required": string, "suggestions": [string]}],
  "agent_ir": AgentIR (v1.0.0)
}
Rules:
1. Only use capabilities from the active Supabase capability_registry: %s
2. If the prompt requests a money-moving mutation (is_mutation=true) and "max_budget_usd" is missing from clarifications, set "needs_clarification": true and ask for "max_budget_usd".
3. If the prompt requests a sensitive capability (is_sensitive=true) and "require_human_approval" is missing from clarifications, set "needs_clarification": true and ask for "require_human_approval".
4. When compiling agent_ir:
   - Set ir_version="1.0.0", agent_id=%q, tenant_id=%q, metadata.author=%q.
   - Include a terminal sink node (0 outgoing transitions) reachable from the entry node.
   - Only include MEMORY_RETRIEVAL / MEMORY_UPDATE nodes when long-term semantic memory (Mem0) is relevant.`,
		string(capsJSON), agentID, tenantID, userID,
	)

	userPrompt := fmt.Sprintf(
		"Agent Name: %s\nCategory: %s\nPrompt: %s\nClarifications: %s",
		req.Name, req.Category, req.NaturalLanguagePrompt, string(clarifJSON),
	)
	return systemPrompt, userPrompt
}

// SpecRepository persists compiled AgentSpec records and compilation logs in Supabase PostgreSQL.
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
	repo        SpecRepository
	catalog     CapabilityCatalogResolver
	synthesizer IRSynthesizer
	validator   *ValidatorService
	hmacSecret  []byte
	nowUTC      func() time.Time
	idGenerator func(prefix string) string
}

func NewCompilerService(
	repo SpecRepository,
	catalog CapabilityCatalogResolver,
	synthesizer IRSynthesizer,
	validator *ValidatorService,
	hmacSecret string,
) *CompilerService {
	return &CompilerService{
		repo:        repo,
		catalog:     catalog,
		synthesizer: synthesizer,
		validator:   validator,
		hmacSecret:  []byte(hmacSecret),
		nowUTC:      func() time.Time { return time.Now().UTC() },
		idGenerator: generatePrefixedID,
	}
}

// Compile executes the full compilation pipeline backed by Supabase PostgreSQL & Google Gemini:
// 1. Queries active PayPal capabilities from Supabase capability_registry.
// 2. Invokes GeminiIRSynthesizer (sliding-window rate limiter + multi-model fallback across Gemini models).
// 3. Validates the synthesized AgentIR against all deterministic guardrails and graph traversal checks.
// 4. Signs the HMAC-SHA256 readiness_token and persists the final AgentSpec & log to Supabase PostgreSQL.
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

	// TODO(workstream-4): Query Mem0 (memory-service) for long-term tenant compilation preferences.

	activeCaps, err := s.catalog.ListActiveCapabilities(ctx)
	if err != nil {
		return compilermodels.CompileResponse{}, fmt.Errorf("load active capabilities from registry: %w", err)
	}

	agentID := s.idGenerator("agt")
	specID := s.idGenerator("spc")

	llmOut, err := s.synthesizer.Synthesize(ctx, tenantID, userID, agentID, req, activeCaps)
	if err != nil {
		return compilermodels.CompileResponse{}, fmt.Errorf("synthesize agent ir: %w", err)
	}

	// Guardrail 1: If clarification is required, log to Supabase agent_compilation_logs and return questions
	if llmOut.NeedsClarification || len(llmOut.ClarificationQuestions) > 0 {
		_ = s.recordLog(ctx, CompilationLogEntry{
			LogID:                s.idGenerator("log"),
			TenantID:             tenantID,
			RawPrompt:            req.NaturalLanguagePrompt,
			ClarificationPayload: req.Clarifications,
			CompilerStage:        "STAGE_1_AMBIGUITY_DETECTION",
			Status:               "NEEDS_CLARIFICATION",
			Diagnostics:          llmOut.ClarificationQuestions,
		})
		return compilermodels.CompileResponse{
			Status:                 compilermodels.OutcomeClarificationRequired,
			ClarificationQuestions: llmOut.ClarificationQuestions,
			TraceID:                traceID,
		}, nil
	}

	if llmOut.AgentIR == nil {
		return compilermodels.CompileResponse{}, errors.New("synthesizer returned neither clarification questions nor agent_ir")
	}

	ir := *llmOut.AgentIR
	ir.AgentID = agentID
	ir.TenantID = tenantID
	if ir.Metadata.CreatedAt.IsZero() {
		ir.Metadata.CreatedAt = s.nowUTC()
	}

	// Guardrails 2-7: Deterministic Schema, Topology, Capability Registry, Policy & Graph Walk Verification
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
			return compilermodels.CompileResponse{}, fmt.Errorf("save compiled spec in supabase: %w", err)
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

func (s *CompilerService) recordLog(ctx context.Context, entry CompilationLogEntry) error {
	if s.repo == nil {
		return nil
	}
	return s.repo.RecordCompilationLog(ctx, entry)
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

func generatePrefixedID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}
