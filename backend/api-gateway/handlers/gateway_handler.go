package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/deltix/api-gateway/middleware"
	"github.com/deltix/shared/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OAuthSessionProvider interface {
	GenerateLoginURL(ctx context.Context, tenantID string) (string, error)
	ExchangeAndCreateSession(ctx context.Context, stateToken string, authCode string) (auth.UserSession, error)
	RevokeSession(ctx context.Context, sessionID string) error
}

type AuthenticatedUserStore interface {
	UpsertTenantAndUser(ctx context.Context, session auth.UserSession) error
}

// PostgresUserStore persists authenticated Google OAuth users and their tenant into Supabase PostgreSQL.
type PostgresUserStore struct {
	pool *pgxpool.Pool
}

func NewPostgresUserStore(pool *pgxpool.Pool) *PostgresUserStore {
	return &PostgresUserStore{pool: pool}
}

func (s *PostgresUserStore) UpsertTenantAndUser(ctx context.Context, session auth.UserSession) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin user upsert tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	const upsertTenantSQL = `
		INSERT INTO tenants (id, name, status)
		VALUES ($1, $2, 'ACTIVE')
		ON CONFLICT (id) DO NOTHING
	`
	if _, err := tx.Exec(ctx, upsertTenantSQL, session.TenantID, "Workspace "+session.TenantID); err != nil {
		return fmt.Errorf("upsert tenant: %w", err)
	}

	const upsertUserSQL = `
		INSERT INTO users (id, tenant_id, email, name, picture_url, last_login_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email,
		    name = EXCLUDED.name,
		    picture_url = EXCLUDED.picture_url,
		    last_login_at = NOW()
	`
	if _, err := tx.Exec(
		ctx,
		upsertUserSQL,
		session.UserID,
		session.TenantID,
		session.Email,
		session.Name,
		session.Picture,
	); err != nil {
		return fmt.Errorf("upsert user: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit user upsert tx: %w", err)
	}

	return nil
}

type GatewayHandler struct {
	sessions     OAuthSessionProvider
	userStore    AuthenticatedUserStore
	cookieSecure bool
}

func NewGatewayHandler(
	sessions OAuthSessionProvider,
	userStore AuthenticatedUserStore,
	cookieSecure bool,
) *GatewayHandler {
	return &GatewayHandler{
		sessions:     sessions,
		userStore:    userStore,
		cookieSecure: cookieSecure,
	}
}

// HandleHealth responds to GET /healthz.
func (h *GatewayHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	traceID := middleware.EnsureTraceID(w, r)
	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "ok",
		"service":  "api-gateway",
		"trace_id": traceID,
	})
}

// HandleGoogleLogin responds to GET /v1/auth/google/login?tenant_id=...
func (h *GatewayHandler) HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	traceID := middleware.EnsureTraceID(w, r)

	tenantID := strings.TrimSpace(r.URL.Query().Get("tenant_id"))
	if tenantID == "" {
		middleware.WriteProblemJSON(w, http.StatusBadRequest, "MISSING_TENANT_ID", "Query parameter 'tenant_id' is required.", traceID)
		return
	}

	authURL, err := h.sessions.GenerateLoginURL(r.Context(), tenantID)
	if err != nil {
		middleware.WriteProblemJSON(w, http.StatusInternalServerError, "OAUTH_INIT_FAILED", "Failed to generate Google OAuth login URL.", traceID)
		return
	}

	if r.URL.Query().Get("redirect") == "true" {
		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"auth_url":  authURL,
		"tenant_id": tenantID,
		"trace_id":  traceID,
	})
}

// HandleGoogleCallback responds to GET /v1/auth/google/callback?state=...&code=...
func (h *GatewayHandler) HandleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	traceID := middleware.EnsureTraceID(w, r)

	stateToken := strings.TrimSpace(r.URL.Query().Get("state"))
	authCode := strings.TrimSpace(r.URL.Query().Get("code"))
	if stateToken == "" || authCode == "" {
		middleware.WriteProblemJSON(w, http.StatusBadRequest, "INVALID_OAUTH_CALLBACK", "Both 'state' and 'code' query parameters are required.", traceID)
		return
	}

	session, err := h.sessions.ExchangeAndCreateSession(r.Context(), stateToken, authCode)
	if err != nil {
		status := http.StatusUnauthorized
		code := "OAUTH_EXCHANGE_FAILED"
		if errors.Is(err, auth.ErrInvalidOAuthState) {
			code = "INVALID_OAUTH_STATE"
		}
		middleware.WriteProblemJSON(w, status, code, "Failed to verify Google OAuth callback.", traceID)
		return
	}

	if h.userStore != nil {
		if err := h.userStore.UpsertTenantAndUser(r.Context(), session); err != nil {
			middleware.WriteProblemJSON(w, http.StatusInternalServerError, "USER_PERSISTENCE_FAILED", "Failed to persist authenticated user record.", traceID)
			return
		}
	}

	http.SetCookie(w, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    session.SessionID,
		Path:     "/",
		Expires:  session.ExpiresAt,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"session":  session,
		"trace_id": traceID,
	})
}

// HandleGetCurrentSession responds to GET /v1/auth/me.
func (h *GatewayHandler) HandleGetCurrentSession(w http.ResponseWriter, r *http.Request) {
	traceID := middleware.EnsureTraceID(w, r)

	session, err := auth.SessionFromContext(r.Context())
	if err != nil {
		middleware.WriteProblemJSON(w, http.StatusUnauthorized, "UNAUTHORIZED", "No active user session found in context.", traceID)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"session":  session,
		"trace_id": traceID,
	})
}

// HandleLogout responds to POST /v1/auth/logout.
func (h *GatewayHandler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	traceID := middleware.EnsureTraceID(w, r)

	sessionID := middleware.ExtractSessionID(r)
	if sessionID != "" {
		_ = h.sessions.RevokeSession(r.Context(), sessionID)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "logged_out",
		"trace_id": traceID,
	})
}

// HandleDownstreamNotImplemented is a placeholder for downstream microservice APIs that are not yet integrated.
func (h *GatewayHandler) HandleDownstreamNotImplemented(serviceName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		traceID := middleware.EnsureTraceID(w, r)
		// TODO: Replace this handler with ReverseProxy routing once the target downstream service is implemented.
		middleware.WriteProblemJSON(
			w,
			http.StatusNotImplemented,
			"DOWNSTREAM_API_TODO",
			fmt.Sprintf("TODO: Downstream route %s %s (%s) is not integrated yet. Currently only Auth is active.", r.Method, r.URL.Path, serviceName),
			traceID,
		)
	}
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}