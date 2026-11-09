package routes

import (
	"net/http"

	"github.com/deltix/capability-policy-service/handlers"
)

func NewRouter(
	capHandler *handlers.CapabilityHandler,
	policyHandler *handlers.PolicyHandler,
) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", capHandler.HandleHealth)
	mux.HandleFunc("GET /v1/capabilities", capHandler.HandleListCapabilities)
	mux.HandleFunc("POST /v1/approvals/{approval_id}/decide", policyHandler.HandleDecideApproval)

	// Internal tool execution endpoint called by Python LangGraph Worker (:8085)
	mux.HandleFunc("POST /internal/v1/tools/dispatch", capHandler.HandleInternalToolDispatch)

	return mux
}
