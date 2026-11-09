package config

import (
	"os"
	"strings"
	"time"

	sharedconfig "github.com/deltix/shared/config"
)

const (
	DefaultRuntimePort         = "8082"
	DefaultWorkerBridgeURL     = "http://localhost:8085"
	DefaultReadinessHMACSecret = "deltix-dev-readiness-hmac-secret-key-2026"
)

type RuntimeConfig struct {
	HTTPPort            string
	WorkerBridgeURL     string
	ReadinessHMACSecret string
	Postgres            sharedconfig.PostgresConfig
	Redis               sharedconfig.RedisConfig
	ReadTimeout         time.Duration
	WriteTimeout        time.Duration
	LockTTL             time.Duration
}

func LoadRuntimeConfigFromEnv() (RuntimeConfig, error) {
	pgCfg, err := sharedconfig.LoadPostgresConfigFromEnv()
	if err != nil {
		return RuntimeConfig{}, err
	}

	redisCfg, err := sharedconfig.LoadRedisConfigFromEnv()
	if err != nil {
		return RuntimeConfig{}, err
	}

	port := strings.TrimSpace(os.Getenv("RUNTIME_HTTP_PORT"))
	if port == "" {
		port = DefaultRuntimePort
	}

	workerURL := strings.TrimSpace(os.Getenv("WORKER_BRIDGE_URL"))
	if workerURL == "" {
		workerURL = DefaultWorkerBridgeURL
	}

	hmacSecret := strings.TrimSpace(os.Getenv("READINESS_HMAC_SECRET"))
	if hmacSecret == "" {
		hmacSecret = DefaultReadinessHMACSecret
	}

	return RuntimeConfig{
		HTTPPort:            port,
		WorkerBridgeURL:     workerURL,
		ReadinessHMACSecret: hmacSecret,
		Postgres:            pgCfg,
		Redis:               redisCfg,
		ReadTimeout:         15 * time.Second,
		WriteTimeout:        120 * time.Second,
		LockTTL:             60 * time.Second,
	}, nil
}
