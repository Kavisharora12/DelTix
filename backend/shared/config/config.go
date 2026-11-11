package config

import (
	"bufio"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

func LoadDotEnvFiles() {
	candidates := []string{".env", "../.env", "../../.env", "../../../.env"}
	for _, path := range candidates {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			idx := strings.IndexByte(line, '=')
			if idx <= 0 {
				continue
			}
			key := strings.TrimSpace(line[:idx])
			val := strings.TrimSpace(line[idx+1:])
			val = strings.Trim(val, `"'`)
			if key != "" && os.Getenv(key) == "" && val != "" {
				_ = os.Setenv(key, val)
			}
		}
		_ = f.Close()
	}
}

var (
	ErrMissingDatabaseURL     = errors.New("missing SUPABASE_DB_URL")
	ErrMissingRedisURL        = errors.New("missing UPSTASH_REDIS_URL")
	ErrMissingGoogleClientID  = errors.New("missing GOOGLE_CLIENT_ID")
	ErrMissingGoogleSecret    = errors.New("missing GOOGLE_CLIENT_SECRET")
	ErrMissingGoogleRedirect  = errors.New("missing GOOGLE_REDIRECT_URL")
)

type PostgresConfig struct {
	DatabaseURL       string
	MaxConns          int32
	MinConns          int32
	MaxConnLifetime   time.Duration
	MaxConnIdleTime   time.Duration
	HealthCheckPeriod time.Duration
	// UseSimpleProtocol must be true when connecting via Supabase Transaction Pooler (port 6543).
	UseSimpleProtocol bool
}

type RedisConfig struct {
	RedisURL     string
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type GoogleAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	SessionTTL   time.Duration
	StateTTL     time.Duration
}

func LoadPostgresConfigFromEnv() (PostgresConfig, error) {
	LoadDotEnvFiles()
	rawURL := strings.TrimSpace(os.Getenv("SUPABASE_DB_URL"))
	if rawURL == "" {
		return PostgresConfig{}, ErrMissingDatabaseURL
	}

	dbURL, err := normalizeDatabaseURL(rawURL)
	if err != nil {
		return PostgresConfig{}, err
	}

	maxConns, err := parseEnvInt32("SUPABASE_DB_MAX_CONNS", 15)
	if err != nil {
		return PostgresConfig{}, fmt.Errorf("parse SUPABASE_DB_MAX_CONNS: %w", err)
	}

	minConns, err := parseEnvInt32("SUPABASE_DB_MIN_CONNS", 2)
	if err != nil {
		return PostgresConfig{}, fmt.Errorf("parse SUPABASE_DB_MIN_CONNS: %w", err)
	}

	useSimpleProtocol := os.Getenv("SUPABASE_USE_SIMPLE_PROTOCOL") != "false"

	return PostgresConfig{
		DatabaseURL:       dbURL,
		MaxConns:          maxConns,
		MinConns:          minConns,
		MaxConnLifetime:   30 * time.Minute,
		MaxConnIdleTime:   5 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute,
		UseSimpleProtocol: useSimpleProtocol,
	}, nil
}

func LoadRedisConfigFromEnv() (RedisConfig, error) {
	redisURL := os.Getenv("UPSTASH_REDIS_URL")
	if redisURL == "" {
		return RedisConfig{}, ErrMissingRedisURL
	}

	return RedisConfig{
		RedisURL:     redisURL,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	}, nil
}

func LoadGoogleAuthConfigFromEnv() (GoogleAuthConfig, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		return GoogleAuthConfig{}, ErrMissingGoogleClientID
	}

	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if clientSecret == "" {
		return GoogleAuthConfig{}, ErrMissingGoogleSecret
	}

	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if redirectURL == "" {
		return GoogleAuthConfig{}, ErrMissingGoogleRedirect
	}

	return GoogleAuthConfig{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		SessionTTL:   24 * time.Hour,
		StateTTL:     10 * time.Minute,
	}, nil
}

func parseEnvInt32(key string, fallback int32) (int32, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return 0, err
	}
	return int32(parsed), nil
}

// normalizeDatabaseURL cleans and URL-encodes the userinfo portion of a PostgreSQL connection URI.
// It handles accidental square brackets around the password (e.g. [my_pass] copied from Supabase UI)
// as well as special characters (@, #, ?, :, [, ]) in raw passwords.
func normalizeDatabaseURL(raw string) (string, error) {
	if strings.Contains(raw, "[YOUR-PASSWORD]") {
		return "", errors.New("SUPABASE_DB_URL still contains the placeholder [YOUR-PASSWORD] — replace [YOUR-PASSWORD] (and remove the square brackets) with your real Supabase database password in .env")
	}

	schemeIdx := strings.Index(raw, "://")
	if schemeIdx <= 0 {
		return raw, nil
	}
	scheme := raw[:schemeIdx]
	rest := raw[schemeIdx+3:]

	// Find where the host/path boundary starts (first '/' or '?' after @)
	atIdx := strings.LastIndex(rest, "@")
	if atIdx <= 0 {
		return raw, nil
	}

	userInfo := rest[:atIdx]
	hostAndPath := rest[atIdx+1:]

	colonIdx := strings.IndexByte(userInfo, ':')
	if colonIdx < 0 {
		return raw, nil
	}

	username := userInfo[:colonIdx]
	password := userInfo[colonIdx+1:]

	// If the user kept Supabase's square brackets around their password (e.g. [secret123]), strip them.
	if len(password) >= 2 && strings.HasPrefix(password, "[") && strings.HasSuffix(password, "]") {
		password = password[1 : len(password)-1]
	}

	// If password was already percent-encoded, unescape first so we don't double-encode.
	if unescaped, err := url.PathUnescape(password); err == nil {
		password = unescaped
	}
	if unescapedUser, err := url.PathUnescape(username); err == nil {
		username = unescapedUser
	}

	encodedUserInfo := url.UserPassword(username, password).String()
	return fmt.Sprintf("%s://%s@%s", scheme, encodedUserInfo, hostAndPath), nil
}