package routes

import (
	"net/http"

	"github.com/deltix/agent-compiler-service/handlers"
)

func NewRouter(compilerHandler *handlers.CompilerHandler) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", compilerHandler.HandleHealth)
	mux.HandleFunc("POST /v1/agents/compile", compilerHandler.HandleCompile)
	mux.HandleFunc("GET /v1/agents/specs", compilerHandler.HandleListSpecs)
	mux.HandleFunc("GET /v1/agents/specs/{spec_id}", compilerHandler.HandleGetSpec)

	return mux
}