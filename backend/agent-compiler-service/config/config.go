package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	sharedconfig "github.com/deltix/shared/config"
)

var (
	ErrMissingReadinessSecret = errors.New("missing READINESS_HMAC_SECRET")
	ErrMissingGeminiAPIKey    = errors.New("missing GEMINI_API_KEY")
)

var DefaultGeminiModels = []string{
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-flash-latest",
	"gemini-flash-lite-latest",
	"gemini-pro-latest",
}

type CompilerConfig struct {
	HTTPPort                   string
	ReadTimeout                time.Duration
	WriteTimeout               time.Duration
	ReadinessHMACSecret        string
	GeminiAPIKey               string
	GeminiModels               []string
	GeminiRPMPerModel          int
	GeminiSlidingWindow        time.Duration
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

	geminiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if geminiKey == "" {
		geminiKey = strings.TrimSpace(os.Getenv("LLM_API_KEY"))
	}
	if geminiKey == "" {
		return CompilerConfig{}, ErrMissingGeminiAPIKey
	}

	rpmPerModel, err := parseEnvInt("GEMINI_RPM_PER_MODEL", 15)
	if err != nil {
		return CompilerConfig{}, fmt.Errorf("parse GEMINI_RPM_PER_MODEL: %w", err)
	}

	return CompilerConfig{
		HTTPPort:            getEnvOrDefault("COMPILER_HTTP_PORT", "8081"),
		ReadTimeout:         60 * time.Second,
		WriteTimeout:        120 * time.Second,
		ReadinessHMACSecret: hmacSecret,
		GeminiAPIKey:        geminiKey,
		GeminiModels:        parseGeminiModels(os.Getenv("GEMINI_MODELS")),
		GeminiRPMPerModel:   rpmPerModel,
		GeminiSlidingWindow: time.Minute,
		Postgres:            pgCfg,

		// TODO(workstream-4): Query Mem0 Memory Service for long-term tenant compilation preferences once integrated.
		MemoryServiceURL: getEnvOrDefault("MEMORY_SERVICE_URL", "http://localhost:8083"),
		// TODO(workstream-5): Connect to Capability & Policy Service HTTP API when Workstream 5 is running.
		CapabilityPolicyServiceURL: getEnvOrDefault("CAPABILITY_POLICY_SERVICE_URL", "http://localhost:8084"),
	}, nil
}

func parseGeminiModels(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return DefaultGeminiModels
	}
	parts := strings.Split(raw, ",")
	var models []string
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			models = append(models, trimmed)
		}
	}
	if len(models) == 0 {
		return DefaultGeminiModels
	}
	return models
}

func getEnvOrDefault(key string, fallback string) string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	return val
}

func parseEnvInt(key string, fallback int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	return strconv.Atoi(raw)
}
