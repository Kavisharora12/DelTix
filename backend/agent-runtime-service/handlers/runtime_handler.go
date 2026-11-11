package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	runtimemodels "github.com/deltix/agent-runtime-service/models"
	"github.com/deltix/agent-runtime-service/services"
)

type RuntimeHandler struct {
	runtimeService *services.RuntimeService
}

func NewRuntimeHandler(runtimeService *services.RuntimeService) *RuntimeHandler {
	return &RuntimeHandler{runtimeService: runtimeService}
}

func (h *RuntimeHandler) HandleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "agent-runtime-service",
	})
}

func (h *RuntimeHandler) HandleStartRun(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	userID := strings.TrimSpace(r.Header.Get("X-User-ID"))
	if tenantID == "" {
		writeError(w, http.StatusUnauthorized, "MISSING_TENANT_CONTEXT", "X-Tenant-ID header is required", traceID)
		return
	}

	var req runtimemodels.StartRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON", traceID)
		return
	}

	resp, err := h.runtimeService.StartRun(r.Context(), tenantID, userID, req, traceID)
	if err != nil {
		if errors.Is(err, services.ErrSpecNotFound) {
			writeError(w, http.StatusNotFound, "SPEC_NOT_FOUND", err.Error(), traceID)
			return
		}
		if errors.Is(err, runtimemodels.ErrInvalidReadiness) || errors.Is(err, runtimemodels.ErrUncompiledSpec) {
			writeError(w, http.StatusForbidden, "SPEC_NOT_READY", err.Error(), traceID)
			return
		}
		if errors.Is(err, runtimemodels.ErrRunLocked) {
			writeError(w, http.StatusConflict, "RUN_LOCKED", err.Error(), traceID)
			return
		}
		writeError(w, http.StatusBadRequest, "START_RUN_FAILED", err.Error(), traceID)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *RuntimeHandler) HandleListRuns(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	if tenantID == "" {
		writeError(w, http.StatusUnauthorized, "MISSING_TENANT_CONTEXT", "X-Tenant-ID header is required", traceID)
		return
	}

	cursor, _ := strconv.ParseInt(r.URL.Query().Get("cursor"), 10, 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	runs, nextCursor, err := h.runtimeService.ListRuns(r.Context(), tenantID, cursor, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_RUNS_FAILED", err.Error(), traceID)
		return
	}

	writeJSON(w, http.StatusOK, runtimemodels.RunListResponse{
		Runs:       runs,
		NextCursor: nextCursor,
		TraceID:    traceID,
	})
}

func (h *RuntimeHandler) HandleGetRun(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	if tenantID == "" {
		writeError(w, http.StatusUnauthorized, "MISSING_TENANT_CONTEXT", "X-Tenant-ID header is required", traceID)
		return
	}

	runID := r.PathValue("run_id")
	resp, err := h.runtimeService.GetRunDetail(r.Context(), tenantID, runID, traceID)
	if err != nil {
		if errors.Is(err, services.ErrRunNotFound) {
			writeError(w, http.StatusNotFound, "RUN_NOT_FOUND", err.Error(), traceID)
			return
		}
		writeError(w, http.StatusInternalServerError, "GET_RUN_FAILED", err.Error(), traceID)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// HandleStreamRun streams checkpoint and status updates via Server-Sent Events (SSE).
func (h *RuntimeHandler) HandleStreamRun(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	if tenantID == "" {
		writeError(w, http.StatusUnauthorized, "MISSING_TENANT_CONTEXT", "X-Tenant-ID header is required", traceID)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "STREAMING_UNSUPPORTED", "streaming not supported by client", traceID)
		return
	}

	runID := r.PathValue("run_id")

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	seenCheckpoints := make(map[string]bool)
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		detail, err := h.runtimeService.GetRunDetail(r.Context(), tenantID, runID, traceID)
		if err != nil {
			errPayload, _ := json.Marshal(map[string]string{
				"code":    "RUN_NOT_FOUND",
				"message": err.Error(),
			})
			_, _ = fmt.Fprintf(w, "event: error\ndata: %s\n\n", string(errPayload))
			flusher.Flush()
			return
		}

		// Stream new checkpoints
		for _, cp := range detail.Checkpoints {
			if !seenCheckpoints[cp.ID] {
				seenCheckpoints[cp.ID] = true
				payload, _ := json.Marshal(cp)
				_, _ = fmt.Fprintf(w, "event: checkpoint\ndata: %s\n\n", string(payload))
			}
		}

		// Stream current run status
		statusPayload, _ := json.Marshal(detail)
		_, _ = fmt.Fprintf(w, "event: run_status\ndata: %s\n\n", string(statusPayload))
		flusher.Flush()

		// If terminal or paused for human approval, terminate the stream cleanly
		status := detail.Run.Status
		if status == runtimemodels.RunStatusSucceeded ||
			status == runtimemodels.RunStatusFailed ||
			status == runtimemodels.RunStatusPausedForApproval ||
			status == runtimemodels.RunStatusRejected ||
			status == runtimemodels.RunStatusCancelled {
			return
		}

		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
		}
	}
}

func (h *RuntimeHandler) HandleInternalResumeRun(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	if tenantID == "" {
		writeError(w, http.StatusUnauthorized, "MISSING_TENANT_CONTEXT", "X-Tenant-ID header is required", traceID)
		return
	}

	runID := r.PathValue("run_id")
	var req runtimemodels.ResumeRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON", traceID)
		return
	}

	resp, err := h.runtimeService.ResumeRun(r.Context(), tenantID, runID, req, traceID)
	if err != nil {
		if errors.Is(err, runtimemodels.ErrRunNotPaused) {
			writeError(w, http.StatusConflict, "RUN_NOT_PAUSED", err.Error(), traceID)
			return
		}
		writeError(w, http.StatusBadRequest, "RESUME_RUN_FAILED", err.Error(), traceID)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func extractTraceID(r *http.Request) string {
	if tid := strings.TrimSpace(r.Header.Get("X-Trace-ID")); tid != "" {
		return tid
	}
	return fmt.Sprintf("trc_%d", time.Now().UnixNano())
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code string, message string, traceID string) {
	writeJSON(w, status, map[string]string{
		"code":     code,
		"message":  message,
		"trace_id": traceID,
	})
}
