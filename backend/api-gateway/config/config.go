package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	sharedconfig "github.com/deltix/shared/config"
	"strings"
)

type GatewayConfig struct {
	HTTPPort           string
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	RateLimitPerMinute int64
	CookieSecure       bool
	AllowDevAuth       bool
	FrontendURL        string
	CORSOrigins        []string
	Postgres           sharedconfig.PostgresConfig
	Redis              sharedconfig.RedisConfig
	GoogleAuth         sharedconfig.GoogleAuthConfig

	// TODO(workstream-2,3,4,5): Downstream service URLs will be wired when each service is integrated.
	CompilerServiceURL         string
	RuntimeServiceURL          string
	MemoryServiceURL           string
	CapabilityPolicyServiceURL string
}

func LoadGatewayConfigFromEnv() (GatewayConfig, error) {
	pgCfg, err := sharedconfig.LoadPostgresConfigFromEnv()
	if err != nil {
		return GatewayConfig{}, fmt.Errorf("load postgres config: %w", err)
	}

	redisCfg, err := sharedconfig.LoadRedisConfigFromEnv()
	if err != nil {
		return GatewayConfig{}, fmt.Errorf("load redis config: %w", err)
	}

	googleCfg, err := sharedconfig.LoadGoogleAuthConfigFromEnv()
	if err != nil {
		return GatewayConfig{}, fmt.Errorf("load google auth config: %w", err)
	}

	rateLimit, err := parseEnvInt64("GATEWAY_RATE_LIMIT_PER_MIN", 100)
	if err != nil {
		return GatewayConfig{}, fmt.Errorf("parse GATEWAY_RATE_LIMIT_PER_MIN: %w", err)
	}

	corsRaw := os.Getenv("GATEWAY_CORS_ORIGINS")
	var corsOrigins []string
	if corsRaw != "" {
		for _, o := range strings.Split(corsRaw, ",") {
			if s := strings.TrimSpace(o); s != "" {
				corsOrigins = append(corsOrigins, s)
			}
		}
	}

	allowDevAuth := os.Getenv("GATEWAY_ALLOW_DEV_AUTH") == "true" || os.Getenv("ALLOW_DEV_AUTH") == "true"

	return GatewayConfig{
		HTTPPort:           getEnvOrDefault("GATEWAY_HTTP_PORT", "8080"),
		ReadTimeout:        60 * time.Second,
		WriteTimeout:       120 * time.Second,
		RateLimitPerMinute: rateLimit,
		CookieSecure:       os.Getenv("GATEWAY_COOKIE_SECURE") == "true",
		AllowDevAuth:       allowDevAuth,
		FrontendURL:        getEnvOrDefault("FRONTEND_URL", "http://localhost:3000"),
		CORSOrigins:        corsOrigins,
		Postgres:           pgCfg,
		Redis:              redisCfg,
		GoogleAuth:         googleCfg,

		CompilerServiceURL:         getEnvOrDefault("COMPILER_SERVICE_URL", "http://localhost:8081"),
		RuntimeServiceURL:          getEnvOrDefault("RUNTIME_SERVICE_URL", "http://localhost:8082"),
		MemoryServiceURL:           getEnvOrDefault("MEMORY_SERVICE_URL", "http://localhost:8083"),
		CapabilityPolicyServiceURL: getEnvOrDefault("CAPABILITY_POLICY_SERVICE_URL", "http://localhost:8084"),
	}, nil
}

func getEnvOrDefault(key string, fallback string) string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	return val
}

func parseEnvInt64(key string, fallback int64) (int64, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	return strconv.ParseInt(raw, 10, 64)
}