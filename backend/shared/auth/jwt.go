package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/deltix/shared/config"
	"github.com/redis/go-redis/v9"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var (
	ErrSessionNotFound    = errors.New("session not found or expired")
	ErrInvalidOAuthState  = errors.New("invalid or expired oauth state")
	ErrUnverifiedEmail    = errors.New("google account email is not verified")
	ErrInvalidSessionData = errors.New("invalid session payload")
)

const (
	sessionKeyPrefix = "session:"
	stateKeyPrefix   = "oauth_state:"
	googleUserInfoEP = "https://www.googleapis.com/oauth2/v3/userinfo"
)

type UserSession struct {
	SessionID string    `json:"session_id"`
	UserID    string    `json:"user_id"`
	TenantID  string    `json:"tenant_id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Picture   string    `json:"picture"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (s UserSession) Validate() error {
	if s.SessionID == "" || s.UserID == "" || s.TenantID == "" || s.Email == "" {
		return ErrInvalidSessionData
	}
	return nil
}

type GoogleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

type SessionCache interface {
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd
	Get(ctx context.Context, key string) *redis.StringCmd
	GetDel(ctx context.Context, key string) *redis.StringCmd
	Del(ctx context.Context, keys ...string) *redis.IntCmd
}

type RedisSessionManager struct {
	cache          SessionCache
	oauthConfig    *oauth2.Config
	httpClient     *http.Client
	sessionTTL     time.Duration
	stateTTL       time.Duration
	nowUTC         func() time.Time
	generateToken  func() (string, error)
	userInfoURL    string
}

func NewRedisSessionManager(
	cache SessionCache,
	cfg config.GoogleAuthConfig,
	httpClient *http.Client,
) *RedisSessionManager {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}

	oauthCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}

	return &RedisSessionManager{
		cache:         cache,
		oauthConfig:   oauthCfg,
		httpClient:    httpClient,
		sessionTTL:    cfg.SessionTTL,
		stateTTL:      cfg.StateTTL,
		nowUTC:        func() time.Time { return time.Now().UTC() },
		generateToken: generateSecureRandomToken,
		userInfoURL:   googleUserInfoEP,
	}
}

// GenerateLoginURL creates a one-time CSRF state token stored in Redis and returns the Google OAuth consent URL.
func (m *RedisSessionManager) GenerateLoginURL(ctx context.Context, tenantID string) (string, error) {
	if tenantID == "" {
		return "", ErrMissingTenantID
	}

	stateToken, err := m.generateToken()
	if err != nil {
		return "", fmt.Errorf("generate oauth state token: %w", err)
	}

	key := stateKeyPrefix + stateToken
	if err := m.cache.Set(ctx, key, tenantID, m.stateTTL).Err(); err != nil {
		return "", fmt.Errorf("store oauth state in redis: %w", err)
	}

	return m.oauthConfig.AuthCodeURL(stateToken, oauth2.AccessTypeOnline), nil
}

// ExchangeAndCreateSession verifies the OAuth state, exchanges the code for a Google profile,
// and persists a new UserSession in Redis.
func (m *RedisSessionManager) ExchangeAndCreateSession(
	ctx context.Context,
	stateToken string,
	authCode string,
) (UserSession, error) {
	tenantID, err := m.consumeOAuthState(ctx, stateToken)
	if err != nil {
		return UserSession{}, err
	}

	googleUser, err := m.fetchGoogleProfile(ctx, authCode)
	if err != nil {
		return UserSession{}, err
	}

	session, err := m.buildUserSession(tenantID, googleUser)
	if err != nil {
		return UserSession{}, err
	}

	if err := m.SaveSession(ctx, session); err != nil {
		return UserSession{}, err
	}

	return session, nil
}

func (m *RedisSessionManager) consumeOAuthState(ctx context.Context, stateToken string) (string, error) {
	if stateToken == "" {
		return "", ErrInvalidOAuthState
	}

	// GetDel ensures the CSRF state token can only be used once.
	tenantID, err := m.cache.GetDel(ctx, stateKeyPrefix+stateToken).Result()
	if errors.Is(err, redis.Nil) {
		return "", ErrInvalidOAuthState
	}
	if err != nil {
		return "", fmt.Errorf("consume oauth state from redis: %w", err)
	}

	return tenantID, nil
}

func (m *RedisSessionManager) fetchGoogleProfile(ctx context.Context, authCode string) (GoogleUserInfo, error) {
	oauthCtx := context.WithValue(ctx, oauth2.HTTPClient, m.httpClient)
	token, err := m.oauthConfig.Exchange(oauthCtx, authCode)
	if err != nil {
		return GoogleUserInfo{}, fmt.Errorf("exchange google auth code: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.userInfoURL, nil)
	if err != nil {
		return GoogleUserInfo{}, fmt.Errorf("create google userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return GoogleUserInfo{}, fmt.Errorf("fetch google userinfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return GoogleUserInfo{}, fmt.Errorf("unexpected google userinfo status: %d", resp.StatusCode)
	}

	var profile GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return GoogleUserInfo{}, fmt.Errorf("decode google userinfo: %w", err)
	}

	if !profile.EmailVerified || profile.Sub == "" || profile.Email == "" {
		return GoogleUserInfo{}, ErrUnverifiedEmail
	}

	return profile, nil
}

func (m *RedisSessionManager) buildUserSession(tenantID string, profile GoogleUserInfo) (UserSession, error) {
	sessionID, err := m.generateToken()
	if err != nil {
		return UserSession{}, fmt.Errorf("generate session id: %w", err)
	}

	now := m.nowUTC()
	return UserSession{
		SessionID: sessionID,
		UserID:    profile.Sub,
		TenantID:  tenantID,
		Email:     profile.Email,
		Name:      profile.Name,
		Picture:   profile.Picture,
		CreatedAt: now,
		ExpiresAt: now.Add(m.sessionTTL),
	}, nil
}

func (m *RedisSessionManager) SaveSession(ctx context.Context, session UserSession) error {
	if err := session.Validate(); err != nil {
		return err
	}

	payload, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}

	key := sessionKeyPrefix + session.SessionID
	if err := m.cache.Set(ctx, key, payload, m.sessionTTL).Err(); err != nil {
		return fmt.Errorf("save session in redis: %w", err)
	}

	return nil
}

func (m *RedisSessionManager) GetSession(ctx context.Context, sessionID string) (UserSession, error) {
	if sessionID == "" {
		return UserSession{}, ErrSessionNotFound
	}

	raw, err := m.cache.Get(ctx, sessionKeyPrefix+sessionID).Result()
	if errors.Is(err, redis.Nil) {
		return UserSession{}, ErrSessionNotFound
	}
	if err != nil {
		return UserSession{}, fmt.Errorf("get session from redis: %w", err)
	}

	var session UserSession
	if err := json.Unmarshal([]byte(raw), &session); err != nil {
		return UserSession{}, fmt.Errorf("unmarshal session: %w", err)
	}

	if m.nowUTC().After(session.ExpiresAt) {
		_ = m.RevokeSession(ctx, sessionID)
		return UserSession{}, ErrSessionNotFound
	}

	return session, nil
}

func (m *RedisSessionManager) RevokeSession(ctx context.Context, sessionID string) error {
	if sessionID == "" {
		return nil
	}
	if err := m.cache.Del(ctx, sessionKeyPrefix+sessionID).Err(); err != nil {
		return fmt.Errorf("delete session from redis: %w", err)
	}
	return nil
}

func generateSecureRandomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}