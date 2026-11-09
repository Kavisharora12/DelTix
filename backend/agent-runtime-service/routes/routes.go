package routes

import (
	"net/http"

	"github.com/deltix/agent-runtime-service/handlers"
)

func NewRouter(runtimeHandler *handlers.RuntimeHandler) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", runtimeHandler.HandleHealth)
	mux.HandleFunc("POST /v1/runs", runtimeHandler.HandleStartRun)
	mux.HandleFunc("GET /v1/runs", runtimeHandler.HandleListRuns)
	mux.HandleFunc("GET /v1/runs/{run_id}", runtimeHandler.HandleGetRun)
	mux.HandleFunc("GET /v1/runs/{run_id}/stream", runtimeHandler.HandleStreamRun)

	// Internal endpoint invoked by Capability & Policy Service (:8084) when operator resolves an approval request
	mux.HandleFunc("POST /internal/v1/runs/{run_id}/resume", runtimeHandler.HandleInternalResumeRun)

	return mux
}
