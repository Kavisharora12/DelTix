package services

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/deltix/api-gateway/middleware"
)

// ProxyService manages reverse-proxy forwarding and SSE streaming to internal microservices.
// TODO(workstream-2,3,4,5): Activate downstream proxy routing in routes.go as each backend service is completed.
type ProxyService struct {
	compilerURL         *url.URL
	runtimeURL          *url.URL
	memoryURL           *url.URL
	capabilityPolicyURL *url.URL
}

func NewProxyService(
	compilerRawURL string,
	runtimeRawURL string,
	memoryRawURL string,
	capabilityPolicyRawURL string,
) (*ProxyService, error) {
	compilerURL, err := url.Parse(compilerRawURL)
	if err != nil {
		return nil, fmt.Errorf("parse compiler service url: %w", err)
	}

	runtimeURL, err := url.Parse(runtimeRawURL)
	if err != nil {
		return nil, fmt.Errorf("parse runtime service url: %w", err)
	}

	memoryURL, err := url.Parse(memoryRawURL)
	if err != nil {
		return nil, fmt.Errorf("parse memory service url: %w", err)
	}

	capabilityPolicyURL, err := url.Parse(capabilityPolicyRawURL)
	if err != nil {
		return nil, fmt.Errorf("parse capability policy service url: %w", err)
	}

	return &ProxyService{
		compilerURL:         compilerURL,
		runtimeURL:          runtimeURL,
		memoryURL:           memoryURL,
		capabilityPolicyURL: capabilityPolicyURL,
	}, nil
}

// NewJSONReverseProxy builds a standard HTTP reverse proxy that forwards verified tenant/user headers.
// TODO: Wire this to Compiler (8081), Runtime (8082), and Capability/Policy (8084) routes when ready.
func (p *ProxyService) NewJSONReverseProxy(target *url.URL, serviceName string) http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = 100 * time.Millisecond
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		traceID := middleware.EnsureTraceID(w, r)
		middleware.WriteProblemJSON(
			w,
			http.StatusBadGateway,
			"DOWNSTREAM_UNAVAILABLE",
			fmt.Sprintf("Downstream service %s is unreachable.", serviceName),
			traceID,
		)
	}
	return proxy
}

// NewSSEReverseProxy builds an unbuffered reverse proxy for Server-Sent Events (/v1/runs/{run_id}/stream).
// TODO(workstream-3): Wire this to Runtime Service (8082) once SSE run streaming is implemented.
func (p *ProxyService) NewSSEReverseProxy() http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(p.runtimeURL)
	// FlushInterval -1 flushes immediately to support real-time SSE chunks without buffering.
	proxy.FlushInterval = -1
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		traceID := middleware.EnsureTraceID(w, r)
		middleware.WriteProblemJSON(
			w,
			http.StatusBadGateway,
			"SSE_STREAM_UNAVAILABLE",
			"Agent Runtime SSE stream is unreachable.",
			traceID,
		)
	}
	return proxy
}