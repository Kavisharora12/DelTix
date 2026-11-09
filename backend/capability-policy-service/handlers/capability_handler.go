package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	capmodels "github.com/deltix/capability-policy-service/models"
	"github.com/deltix/capability-policy-service/services"
)

type CapabilityHandler struct {
	capabilityService *services.CapabilityService
}

func NewCapabilityHandler(capabilityService *services.CapabilityService) *CapabilityHandler {
	return &CapabilityHandler{capabilityService: capabilityService}
}

func (h *CapabilityHandler) HandleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "capability-policy-service",
	})
}

func (h *CapabilityHandler) HandleListCapabilities(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	caps, err := h.capabilityService.ListCapabilities(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LIST_CAPABILITIES_FAILED", err.Error(), traceID)
		return
	}
	writeJSON(w, http.StatusOK, capmodels.CapabilityListResponse{
		Capabilities: caps,
		TraceID:      traceID,
	})
}

func (h *CapabilityHandler) HandleInternalToolDispatch(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	var req capmodels.ToolDispatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON", traceID)
		return
	}

	if idemHeader := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemHeader != "" && req.IdempotencyKey == "" {
		req.IdempotencyKey = idemHeader
	}

	res, err := h.capabilityService.DispatchTool(r.Context(), req)
	if err != nil {
		if errors.Is(err, capmodels.ErrMissingApprovalToken) {
			writeError(w, http.StatusForbidden, "MISSING_APPROVAL_TOKEN", err.Error(), traceID)
			return
		}
		if errors.Is(err, capmodels.ErrUnknownCapability) {
			writeError(w, http.StatusNotFound, "UNKNOWN_CAPABILITY", err.Error(), traceID)
			return
		}
		writeError(w, http.StatusBadRequest, "TOOL_DISPATCH_FAILED", err.Error(), traceID)
		return
	}

	writeJSON(w, http.StatusOK, res)
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
