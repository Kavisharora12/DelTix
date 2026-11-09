package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	capmodels "github.com/deltix/capability-policy-service/models"
	"github.com/deltix/capability-policy-service/services"
)

type PolicyHandler struct {
	policyService *services.PolicyService
}

func NewPolicyHandler(policyService *services.PolicyService) *PolicyHandler {
	return &PolicyHandler{policyService: policyService}
}

func (h *PolicyHandler) HandleDecideApproval(w http.ResponseWriter, r *http.Request) {
	traceID := extractTraceID(r)
	tenantID := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	userID := strings.TrimSpace(r.Header.Get("X-User-ID"))
	if tenantID == "" {
		writeError(w, http.StatusUnauthorized, "MISSING_TENANT_CONTEXT", "X-Tenant-ID header is required", traceID)
		return
	}
	if userID == "" {
		userID = "operator_user"
	}

	approvalID := r.PathValue("approval_id")
	var req capmodels.ApprovalDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must be valid JSON", traceID)
		return
	}

	resp, err := h.policyService.DecideApproval(r.Context(), tenantID, userID, approvalID, req, traceID)
	if err != nil {
		if errors.Is(err, services.ErrApprovalNotFound) {
			writeError(w, http.StatusNotFound, "APPROVAL_NOT_FOUND", err.Error(), traceID)
			return
		}
		writeError(w, http.StatusBadRequest, "APPROVAL_DECISION_FAILED", err.Error(), traceID)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
