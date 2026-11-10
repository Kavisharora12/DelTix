package middleware

import (
	"net/http"
	"strings"
)

type CORSMiddleware struct {
	allowedOrigins map[string]struct{}
	allowAll       bool
}

func NewCORSMiddleware(allowedOrigins []string) *CORSMiddleware {
	originMap := make(map[string]struct{})
	allowAll := false

	if len(allowedOrigins) == 0 {
		// Default dev origins
		allowedOrigins = []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:5173",
		}
	}

	for _, orig := range allowedOrigins {
		orig = strings.TrimSpace(orig)
		if orig == "*" {
			allowAll = true
		} else if orig != "" {
			originMap[orig] = struct{}{}
		}
	}

	return &CORSMiddleware{
		allowedOrigins: originMap,
		allowAll:       allowAll,
	}
}

func (c *CORSMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin != "" {
			allowed := false
			if c.allowAll {
				allowed = true
				w.Header().Set("Access-Control-Allow-Origin", origin)
			} else if _, ok := c.allowedOrigins[origin]; ok {
				allowed = true
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Trace-ID, X-Tenant-ID, X-User-ID, Retry-After")
				w.Header().Set("Access-Control-Expose-Headers", "Content-Type, X-Trace-ID, Retry-After")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
