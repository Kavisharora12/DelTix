package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/deltix/shared/auth"
)

const (
	SessionCookieName = "deltix_session"
	HeaderTenantID    = "X-Tenant-ID"
	HeaderUserID      = "X-User-ID"
	HeaderTraceID     = "X-Trace-ID"
)

type SessionVerifier interface {
	GetSession(ctx context.Context, sessionID string) (auth.UserSession, error)
}

type ProblemDetail struct {
	Type      string `json:"type"`
	Title     string `json:"title"`
	Status    int    `json:"status"`
	ErrorCode string `json:"error_code"`
	Detail    string `json:"detail"`
	TraceID   string `json:"trace_id"`
}

type AuthMiddleware struct {
	verifier SessionVerifier
}

func NewAuthMiddleware(verifier SessionVerifier) *AuthMiddleware {
	return &AuthMiddleware{verifier: verifier}
}

// RequireSession validates the Redis-backed session and injects trusted X-Tenant-ID and X-User-ID headers.
func (m *AuthMiddleware) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := EnsureTraceID(w, r)

		// Strip any client-supplied identity headers to prevent header spoofing.
		r.Header.Del(HeaderTenantID)
		r.Header.Del(HeaderUserID)

		sessionID := ExtractSessionID(r)
		if sessionID == "" {
			WriteProblemJSON(w, http.StatusUnauthorized, "UNAUTHORIZED", "Missing session token or cookie.", traceID)
			return
		}

		session, err := m.verifier.GetSession(r.Context(), sessionID)
		if err != nil {
			WriteProblemJSON(w, http.StatusUnauthorized, "SESSION_EXPIRED", "Session is invalid or expired.", traceID)
			return
		}

		r.Header.Set(HeaderTenantID, session.TenantID)
		r.Header.Set(HeaderUserID, session.UserID)

		ctx := auth.WithUserSession(r.Context(), session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ExtractSessionID(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if token != "" {
			return token
		}
	}

	cookie, err := r.Cookie(SessionCookieName)
	if err == nil && strings.TrimSpace(cookie.Value) != "" {
		return strings.TrimSpace(cookie.Value)
	}

	return ""
}

func EnsureTraceID(w http.ResponseWriter, r *http.Request) string {
	traceID := strings.TrimSpace(r.Header.Get(HeaderTraceID))
	if traceID == "" {
		traceID = generateTraceID()
		r.Header.Set(HeaderTraceID, traceID)
	}
	w.Header().Set(HeaderTraceID, traceID)
	return traceID
}

func WriteProblemJSON(w http.ResponseWriter, status int, code string, detail string, traceID string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)

	problem := ProblemDetail{
		Type:      "https://api.deltix.io/errors/" + strings.ToLower(strings.ReplaceAll(code, "_", "-")),
		Title:     http.StatusText(status),
		Status:    status,
		ErrorCode: code,
		Detail:    detail,
		TraceID:   traceID,
	}
	_ = json.NewEncoder(w).Encode(problem)
}

func generateTraceID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "req_fallback"
	}
	return "req_" + hex.EncodeToString(b)
}