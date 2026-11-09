package config

import (
	"os"
	"strings"
	"time"

	sharedconfig "github.com/deltix/shared/config"
)

const (
	DefaultCapabilityPort     = "8084"
	DefaultRuntimeServiceURL  = "http://localhost:8082"
	DefaultPayPalBaseURL      = "https://api-m.sandbox.paypal.com"
	DefaultApprovalHMACSecret = "deltix-dev-approval-hmac-secret-key-2026"
)

type CapabilityPolicyConfig struct {
	HTTPPort           string
	RuntimeServiceURL  string
	PayPalBaseURL      string
	PayPalClientID     string
	PayPalClientSecret string
	ApprovalHMACSecret string
	Postgres           sharedconfig.PostgresConfig
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
}

func LoadCapabilityPolicyConfigFromEnv() (CapabilityPolicyConfig, error) {
	pgCfg, err := sharedconfig.LoadPostgresConfigFromEnv()
	if err != nil {
		return CapabilityPolicyConfig{}, err
	}

	port := strings.TrimSpace(os.Getenv("CAPABILITY_HTTP_PORT"))
	if port == "" {
		port = DefaultCapabilityPort
	}

	runtimeURL := strings.TrimSpace(os.Getenv("RUNTIME_SERVICE_URL"))
	if runtimeURL == "" {
		runtimeURL = DefaultRuntimeServiceURL
	}

	paypalBase := strings.TrimSpace(os.Getenv("PAYPAL_BASE_URL"))
	if paypalBase == "" {
		paypalBase = DefaultPayPalBaseURL
	}

	approvalSecret := strings.TrimSpace(os.Getenv("APPROVAL_HMAC_SECRET"))
	if approvalSecret == "" {
		approvalSecret = DefaultApprovalHMACSecret
	}

	return CapabilityPolicyConfig{
		HTTPPort:           port,
		RuntimeServiceURL:  runtimeURL,
		PayPalBaseURL:      paypalBase,
		PayPalClientID:     strings.TrimSpace(os.Getenv("PAYPAL_CLIENT_ID")),
		PayPalClientSecret: strings.TrimSpace(os.Getenv("PAYPAL_CLIENT_SECRET")),
		ApprovalHMACSecret: approvalSecret,
		Postgres:           pgCfg,
		ReadTimeout:        15 * time.Second,
		WriteTimeout:       30 * time.Second,
	}, nil
}
