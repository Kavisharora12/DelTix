package config

import (
	"errors"
	"fmt"
	"os"
	"time"

	sharedconfig "github.com/deltix/shared/config"
)

var (
	ErrMissingReadinessSecret = errors.New("missing READINESS_HMAC_SECRET")
	ErrMissingLLMAPIKey       = errors.New("missing LLM_API_KEY")
)

type CompilerConfig struct {
	HTTPPort                   string
	ReadTimeout                time.Duration
	WriteTimeout               time.Duration
	ReadinessHMACSecret        string
	LLMAPIKey                  string
	LLMModel                   string
	LLMBaseURL                 string
	Postgres                   sharedconfig.PostgresConfig
	MemoryServiceURL           string
	CapabilityPolicyServiceURL string
}

func LoadCompilerConfigFromEnv() (CompilerConfig, error) {
	pgCfg, err := sharedconfig.LoadPostgresConfigFromEnv()
	if err != nil {
		return CompilerConfig{}, fmt.Errorf("load postgres config: %w", err)
	}

	hmacSecret := os.Getenv("READINESS_HMAC_SECRET")
	if hmacSecret == "" {
		return CompilerConfig{}, ErrMissingReadinessSecret
	}

	llmKey := os.Getenv("LLM_API_KEY")
	if llmKey == "" {
		return CompilerConfig{}, ErrMissingLLMAPIKey
	}

	return CompilerConfig{
		HTTPPort:            getEnvOrDefault("COMPILER_HTTP_PORT", "8081"),
		ReadTimeout:         15 * time.Second,
		WriteTimeout:        45 * time.Second,
		ReadinessHMACSecret: hmacSecret,
		LLMAPIKey:           llmKey,
		LLMModel:            getEnvOrDefault("LLM_MODEL", "gpt-4o-mini"),
		LLMBaseURL:          getEnvOrDefault("LLM_BASE_URL", "https://api.openai.com/v1"),
		Postgres:            pgCfg,

		// TODO(workstream-4): Query Mem0 Memory Service for long-term tenant compilation preferences once integrated.
		MemoryServiceURL: getEnvOrDefault("MEMORY_SERVICE_URL", "http://localhost:8083"),
		// TODO(workstream-5): Connect to Capability & Policy Service HTTP API when Workstream 5 is running.
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
