package tests

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/deltix/api-gateway/handlers"
	"github.com/deltix/api-gateway/middleware"
	"github.com/deltix/api-gateway/routes"
	"github.com/deltix/shared/auth"
	"github.com/redis/go-redis/v9"
)

type fakeSessionStore struct {
	sessions map[string]auth.UserSession
	loginURL string
}

func newFakeSessionStore() *fakeSessionStore {
	return &fakeSessionStore{
		sessions: make(map[string]auth.UserSession),
		loginURL: "https://accounts.google.com/o/oauth2/auth?state=test_state",
	}
}

func (f *fakeSessionStore) GetSession(_ context.Context, sessionID string) (auth.UserSession, error) {
	s, ok := f.sessions[sessionID]
	if !ok {
		return auth.UserSession{}, auth.ErrSessionNotFound
	}
	return s, nil
}

func (f *fakeSessionStore) GenerateLoginURL(_ context.Context, tenantID string) (string, error) {
	if tenantID == "" {
		return "", errors.New("missing tenant")
	}
	return f.loginURL, nil
}

func (f *fakeSessionStore) ExchangeAndCreateSession(_ context.Context, stateToken string, authCode string) (auth.UserSession, error) {
	if stateToken != "valid_state" || authCode != "valid_code" {
		return auth.UserSession{}, auth.ErrInvalidOAuthState
	}
	session := auth.UserSession{
		SessionID: "sess_123",
		UserID:    "usr_google_1",
		TenantID:  "ten_paypal_1",
		Email:     "dev@deltix.io",
		Name:      "DelTix Engineer",
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(time.Hour),
	}
	f.sessions[session.SessionID] = session
	return session, nil
}

func (f *fakeSessionStore) RevokeSession(_ context.Context, sessionID string) error {
	delete(f.sessions, sessionID)
	return nil
}

type fakeRateLimiter struct {
	counts map[string]int64
}

func newFakeRateLimiter() *fakeRateLimiter {
	return &fakeRateLimiter{counts: make(map[string]int64)}
}

func (f *fakeRateLimiter) Incr(_ context.Context, key string) *redis.IntCmd {
	f.counts[key]++
	cmd := redis.NewIntCmd(context.Background())
	cmd.SetVal(f.counts[key])
	return cmd
}

func (f *fakeRateLimiter) Expire(_ context.Context, _ string, _ time.Duration) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(context.Background())
	cmd.SetVal(true)
	return cmd
}

type noopUserStore struct {
	upserted int
}

func (n *noopUserStore) UpsertTenantAndUser(_ context.Context, _ auth.UserSession) error {
	n.upserted++
	return nil
}

func TestGatewayAuthAndHeaderSpoofingPrevention(t *testing.T) {
	sessionStore := newFakeSessionStore()
	sessionStore.sessions["valid_session"] = auth.UserSession{
		SessionID: "valid_session",
		UserID:    "usr_real",
		TenantID:  "ten_real",
		Email:     "real@deltix.io",
		ExpiresAt: time.Now().UTC().Add(time.Hour),
	}

	rateLimiter := newFakeRateLimiter()
	userStore := &noopUserStore{}

	authMW := middleware.NewAuthMiddleware(sessionStore)
	rateMW := middleware.NewRateLimitMiddleware(rateLimiter, 5)
	handler := handlers.NewGatewayHandler(sessionStore, userStore, false)
	router := routes.NewRouter(handler, authMW, rateMW)

	t.Run("rejects unauthenticated request with RFC 7807 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected status 401, got %d", rec.Code)
		}
	})

	t.Run("strips spoofed headers and returns verified session", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
		req.Header.Set("Authorization", "Bearer valid_session")
		req.Header.Set("X-Tenant-ID", "ten_spoofed_attacker")
		req.Header.Set("X-User-ID", "usr_spoofed_attacker")
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d", rec.Code)
		}

		var body struct {
			Session auth.UserSession `json:"session"`
		}
		if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if body.Session.TenantID != "ten_real" || body.Session.UserID != "usr_real" {
			t.Fatalf("expected verified tenant ten_real and user usr_real, got %+v", body.Session)
		}
	})

	t.Run("returns 501 TODO on unintegrated downstream route after auth passes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/agents/compile", nil)
		req.Header.Set("Authorization", "Bearer valid_session")
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotImplemented {
			t.Fatalf("expected status 501 for TODO downstream route, got %d", rec.Code)
		}
	})
}

func TestGatewayRateLimitEnforcement(t *testing.T) {
	sessionStore := newFakeSessionStore()
	sessionStore.sessions["valid_session"] = auth.UserSession{
		SessionID: "valid_session",
		UserID:    "usr_real",
		TenantID:  "ten_limited",
		Email:     "real@deltix.io",
		ExpiresAt: time.Now().UTC().Add(time.Hour),
	}

	rateLimiter := newFakeRateLimiter()
	authMW := middleware.NewAuthMiddleware(sessionStore)
	rateMW := middleware.NewRateLimitMiddleware(rateLimiter, 2)
	handler := handlers.NewGatewayHandler(sessionStore, &noopUserStore{}, false)
	router := routes.NewRouter(handler, authMW, rateMW)

	for i := 1; i <= 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
		req.Header.Set("Authorization", "Bearer valid_session")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, rec.Code)
		}
	}

	// 3rd request within the same minute must be rate-limited (429)
	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer valid_session")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests, got %d", rec.Code)
	}
}

func TestGatewayCORSMiddleware(t *testing.T) {
	corsMW := middleware.NewCORSMiddleware([]string{"http://localhost:3000", "https://app.deltix.io"})
	handler := corsMW.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))

	t.Run("handles OPTIONS preflight for allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/v1/runs", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Access-Control-Request-Method", "POST")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("expected status 204 No Content for OPTIONS, got %d", rec.Code)
		}
		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
			t.Fatalf("expected Allow-Origin header to match, got %q", rec.Header().Get("Access-Control-Allow-Origin"))
		}
		if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
			t.Fatalf("expected Allow-Credentials true, got %q", rec.Header().Get("Access-Control-Allow-Credentials"))
		}
	})

	t.Run("sets CORS headers on normal requests", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		req.Header.Set("Origin", "https://app.deltix.io")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		if rec.Header().Get("Access-Control-Allow-Origin") != "https://app.deltix.io" {
			t.Fatalf("expected Allow-Origin, got %q", rec.Header().Get("Access-Control-Allow-Origin"))
		}
	})
}

func TestGatewayDevAuthBypass(t *testing.T) {
	sessionStore := newFakeSessionStore()
	authMW := middleware.NewAuthMiddlewareWithDevAuth(sessionStore, true)
	rateLimiter := newFakeRateLimiter()
	rateMW := middleware.NewRateLimitMiddleware(rateLimiter, 100)
	handler := handlers.NewGatewayHandler(sessionStore, &noopUserStore{}, false)
	router := routes.NewRouter(handler, authMW, rateMW)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer dev_token_deltix")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 with dev auth token, got %d", rec.Code)
	}

	var body struct {
		Session auth.UserSession `json:"session"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Session.TenantID != "ten_dev_workspace" || body.Session.UserID != "usr_dev_tester" {
		t.Fatalf("expected dev session values, got %+v", body.Session)
	}
}