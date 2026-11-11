package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	compilermodels "github.com/deltix/agent-compiler-service/models"
	"github.com/deltix/agent-compiler-service/services"
)

const (
	HeaderTenantID = "X-Tenant-ID"
	HeaderUserID   = "X-User-ID"
	HeaderTraceID  = "X-Trace-ID"
)

type ProblemDetail struct {
	Type      string `json:"type"`
	Title     string `json:"title"`
	Status    int    `json:"status"`
	ErrorCode string `json:"error_code"`
	Detail    string `json:"detail"`
	TraceID   string `json:"trace_id"`
}

type CompilerHandler struct {
	compiler *services.CompilerService
}

func NewCompilerHandler(compiler *services.CompilerService) *CompilerHandler {
	return &CompilerHandler{compiler: compiler}
}

func (h *CompilerHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "ok",
		"service":  "agent-compiler-service",
		"trace_id": traceID,
	})
}

// HandleCompile handles POST /v1/agents/compile.
func (h *CompilerHandler) HandleCompile(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get(HeaderTenantID))
	userID := strings.TrimSpace(r.Header.Get(HeaderUserID))

	if tenantID == "" {
		writeProblemJSON(w, http.StatusUnauthorized, "MISSING_TENANT_HEADER", "X-Tenant-ID header is required.", traceID)
		return
	}

	var req compilermodels.CompileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeProblemJSON(w, http.StatusBadRequest, "INVALID_JSON_BODY", "Request body must be valid JSON.", traceID)
		return
	}

	resp, err := h.compiler.Compile(r.Context(), tenantID, userID, traceID, req)
	if err != nil {
		if errors.Is(err, compilermodels.ErrEmptyPrompt) {
			writeProblemJSON(w, http.StatusBadRequest, "EMPTY_PROMPT", err.Error(), traceID)
			return
		}
		writeProblemJSON(w, http.StatusInternalServerError, "COMPILATION_ERROR", err.Error(), traceID)
		return
	}

	status := http.StatusOK
	if resp.Status == compilermodels.OutcomeFailedValidation {
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, resp)
}

// HandleListSpecs handles GET /v1/agents/specs?cursor=0&limit=20.
func (h *CompilerHandler) HandleListSpecs(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get(HeaderTenantID))
	if tenantID == "" {
		writeProblemJSON(w, http.StatusUnauthorized, "MISSING_TENANT_HEADER", "X-Tenant-ID header is required.", traceID)
		return
	}

	cursor, _ := strconv.ParseInt(r.URL.Query().Get("cursor"), 10, 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	specs, nextCursor, err := h.compiler.ListSpecs(r.Context(), tenantID, cursor, limit)
	if err != nil {
		writeProblemJSON(w, http.StatusInternalServerError, "LIST_SPECS_FAILED", "Failed to list agent specifications.", traceID)
		return
	}

	writeJSON(w, http.StatusOK, compilermodels.SpecListResponse{
		Specs:      specs,
		NextCursor: nextCursor,
		TraceID:    traceID,
	})
}

// HandleGetSpec handles GET /v1/agents/specs/{spec_id}.
func (h *CompilerHandler) HandleGetSpec(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get(HeaderTenantID))
	if tenantID == "" {
		writeProblemJSON(w, http.StatusUnauthorized, "MISSING_TENANT_HEADER", "X-Tenant-ID header is required.", traceID)
		return
	}

	specID := strings.TrimSpace(r.PathValue("spec_id"))
	if specID == "" {
		writeProblemJSON(w, http.StatusBadRequest, "MISSING_SPEC_ID", "Path parameter 'spec_id' is required.", traceID)
		return
	}

	spec, err := h.compiler.GetSpec(r.Context(), tenantID, specID)
	if err != nil {
		if errors.Is(err, services.ErrSpecNotFound) {
			writeProblemJSON(w, http.StatusNotFound, "SPEC_NOT_FOUND", "Agent specification not found for tenant.", traceID)
			return
		}
		writeProblemJSON(w, http.StatusInternalServerError, "GET_SPEC_FAILED", "Failed to fetch agent specification.", traceID)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"spec":     spec,
		"trace_id": traceID,
	})
}

func extractTraceID(r *http.Request) string {
	t := strings.TrimSpace(r.Header.Get(HeaderTraceID))
	if t == "" {
		return "req_compiler"
	}
	return t
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeProblemJSON(w http.ResponseWriter, status int, code string, detail string, traceID string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ProblemDetail{
		Type:      "https://api.deltix.io/errors/" + strings.ToLower(strings.ReplaceAll(code, "_", "-")),
		Title:     http.StatusText(status),
		Status:    status,
		ErrorCode: code,
		Detail:    detail,
		TraceID:   traceID,
	})
}
