package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/deltix/shared/auth"
	"github.com/redis/go-redis/v9"
)

const rateLimitKeyPrefix = "ratelimit:"

type RateLimitCounter interface {
	Incr(ctx context.Context, key string) *redis.IntCmd
	Expire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd
}

type RateLimitMiddleware struct {
	counter        RateLimitCounter
	limitPerMinute int64
	window         time.Duration
}

func NewRateLimitMiddleware(counter RateLimitCounter, limitPerMinute int64) *RateLimitMiddleware {
	return &RateLimitMiddleware{
		counter:        counter,
		limitPerMinute: limitPerMinute,
		window:         time.Minute,
	}
}

// EnforceTenantRateLimit applies a per-tenant Redis rate limit window.
func (m *RateLimitMiddleware) EnforceTenantRateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := EnsureTraceID(w, r)

		tenantID, err := auth.TenantIDFromContext(r.Context())
		if err != nil {
			WriteProblemJSON(w, http.StatusUnauthorized, "MISSING_TENANT_CONTEXT", "Authenticated tenant context is required.", traceID)
			return
		}

		allowed, err := m.allowRequest(r.Context(), tenantID)
		if err != nil {
			// Fail open only if Redis telemetry is transiently unreachable, or reject if strict.
			WriteProblemJSON(w, http.StatusServiceUnavailable, "RATE_LIMITER_UNAVAILABLE", "Rate limiter store is temporarily unreachable.", traceID)
			return
		}

		if !allowed {
			w.Header().Set("Retry-After", "60")
			WriteProblemJSON(
				w,
				http.StatusTooManyRequests,
				"RATE_LIMIT_EXCEEDED",
				fmt.Sprintf("Tenant %s exceeded limit of %d requests per minute.", tenantID, m.limitPerMinute),
				traceID,
			)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (m *RateLimitMiddleware) allowRequest(ctx context.Context, tenantID string) (bool, error) {
	bucket := time.Now().UTC().Format("200601021504")
	key := fmt.Sprintf("%s%s:%s", rateLimitKeyPrefix, tenantID, bucket)

	count, err := m.counter.Incr(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("increment rate limit counter: %w", err)
	}

	if count == 1 {
		_ = m.counter.Expire(ctx, key, m.window)
	}

	return count <= m.limitPerMinute, nil
}