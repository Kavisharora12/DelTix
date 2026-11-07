package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	sharedconfig "github.com/deltix/shared/config"
)

type GatewayConfig struct {
	HTTPPort           string
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	RateLimitPerMinute int64
	CookieSecure       bool
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

	return GatewayConfig{
		HTTPPort:           getEnvOrDefault("GATEWAY_HTTP_PORT", "8080"),
		ReadTimeout:        15 * time.Second,
		WriteTimeout:       30 * time.Second,
		RateLimitPerMinute: rateLimit,
		CookieSecure:       os.Getenv("GATEWAY_COOKIE_SECURE") == "true",
		Postgres:           pgCfg,
		Redis:              redisCfg,
		GoogleAuth:         googleCfg,

		// TODO: Connect downstream microservice endpoints once Compiler, Runtime, Memory, and Capability services are ready.
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