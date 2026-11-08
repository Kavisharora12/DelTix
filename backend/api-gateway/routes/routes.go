package routes

import (
	"net/http"

	"github.com/deltix/api-gateway/handlers"
	"github.com/deltix/api-gateway/middleware"
)

func NewRouter(
	gatewayHandler *handlers.GatewayHandler,
	authMiddleware *middleware.AuthMiddleware,
	rateLimitMiddleware *middleware.RateLimitMiddleware,
	compilerProxy ...http.Handler,
) http.Handler {
	mux := http.NewServeMux()
	var activeCompilerProxy http.Handler
	if len(compilerProxy) > 0 {
		activeCompilerProxy = compilerProxy[0]
	}

	// 1. Public Health & Google OAuth Endpoints (Live)
	mux.HandleFunc("GET /healthz", gatewayHandler.HandleHealth)
	mux.HandleFunc("GET /v1/auth/google/login", gatewayHandler.HandleGoogleLogin)
	mux.HandleFunc("GET /v1/auth/google/callback", gatewayHandler.HandleGoogleCallback)

	protect := func(h http.HandlerFunc) http.Handler {
		return authMiddleware.RequireSession(
			rateLimitMiddleware.EnforceTenantRateLimit(h),
		)
	}

	protectHandler := func(h http.Handler) http.Handler {
		return authMiddleware.RequireSession(
			rateLimitMiddleware.EnforceTenantRateLimit(h),
		)
	}

	// 2. Protected Session Endpoints (Live — Google OAuth + Upstash Redis Session)
	mux.Handle("GET /v1/auth/me", protect(gatewayHandler.HandleGetCurrentSession))
	mux.Handle("POST /v1/auth/logout", protect(gatewayHandler.HandleLogout))

	// 3. Workstream 2: Agent Compiler Service Routes (Live Proxy to Port 8081 when configured)
	if activeCompilerProxy != nil {
		mux.Handle("POST /v1/agents/compile", protectHandler(activeCompilerProxy))
		mux.Handle("GET /v1/agents/specs", protectHandler(activeCompilerProxy))
		mux.Handle("GET /v1/agents/specs/{spec_id}", protectHandler(activeCompilerProxy))
	} else {
		mux.Handle("POST /v1/agents/compile", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-compiler-service")))
		mux.Handle("GET /v1/agents/specs", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-compiler-service")))
		mux.Handle("GET /v1/agents/specs/{spec_id}", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-compiler-service")))
	}

	// -------------------------------------------------------------------------
	// 4. Downstream Microservice Routes (TODO — Not Integrated Yet)
	// Currently returns 501 Not Implemented after verifying Auth & Rate Limits.
	// -------------------------------------------------------------------------

	// TODO(workstream-3): Connect to Agent Runtime Service (port 8082)
	mux.Handle("POST /v1/runs", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service")))
	mux.Handle("GET /v1/runs", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service")))
	mux.Handle("GET /v1/runs/{run_id}", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service")))
	mux.Handle("GET /v1/runs/{run_id}/stream", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service-sse")))

	// TODO(workstream-5): Connect to Capability & Policy Service (port 8084)
	mux.Handle("GET /v1/capabilities", protect(gatewayHandler.HandleDownstreamNotImplemented("capability-policy-service")))
	mux.Handle("POST /v1/approvals/{approval_id}/decide", protect(gatewayHandler.HandleDownstreamNotImplemented("capability-policy-service")))

	return mux
}
