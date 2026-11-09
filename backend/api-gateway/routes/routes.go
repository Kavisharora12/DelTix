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
	downstreamProxies ...http.Handler,
) http.Handler {
	mux := http.NewServeMux()
	var activeCompilerProxy http.Handler
	var activeRuntimeProxy http.Handler
	var activeRuntimeSSEProxy http.Handler
	var activeCapabilityProxy http.Handler

	if len(downstreamProxies) > 0 {
		activeCompilerProxy = downstreamProxies[0]
	}
	if len(downstreamProxies) > 1 {
		activeRuntimeProxy = downstreamProxies[1]
	}
	if len(downstreamProxies) > 2 {
		activeRuntimeSSEProxy = downstreamProxies[2]
	}
	if len(downstreamProxies) > 3 {
		activeCapabilityProxy = downstreamProxies[3]
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

	// 4. Workstream 3: Agent Runtime Service Routes (Live Proxy to Port 8082 when configured)
	if activeRuntimeProxy != nil {
		mux.Handle("POST /v1/runs", protectHandler(activeRuntimeProxy))
		mux.Handle("GET /v1/runs", protectHandler(activeRuntimeProxy))
		mux.Handle("GET /v1/runs/{run_id}", protectHandler(activeRuntimeProxy))
	} else {
		mux.Handle("POST /v1/runs", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service")))
		mux.Handle("GET /v1/runs", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service")))
		mux.Handle("GET /v1/runs/{run_id}", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service")))
	}

	if activeRuntimeSSEProxy != nil {
		mux.Handle("GET /v1/runs/{run_id}/stream", protectHandler(activeRuntimeSSEProxy))
	} else if activeRuntimeProxy != nil {
		mux.Handle("GET /v1/runs/{run_id}/stream", protectHandler(activeRuntimeProxy))
	} else {
		mux.Handle("GET /v1/runs/{run_id}/stream", protect(gatewayHandler.HandleDownstreamNotImplemented("agent-runtime-service-sse")))
	}

	// 5. Workstream 5: Capability & Policy Service Routes (Live Proxy to Port 8084 when configured)
	if activeCapabilityProxy != nil {
		mux.Handle("GET /v1/capabilities", protectHandler(activeCapabilityProxy))
		mux.Handle("POST /v1/approvals/{approval_id}/decide", protectHandler(activeCapabilityProxy))
	} else {
		mux.Handle("GET /v1/capabilities", protect(gatewayHandler.HandleDownstreamNotImplemented("capability-policy-service")))
		mux.Handle("POST /v1/approvals/{approval_id}/decide", protect(gatewayHandler.HandleDownstreamNotImplemented("capability-policy-service")))
	}

	return mux
}
