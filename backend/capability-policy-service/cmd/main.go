package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/deltix/capability-policy-service/adapters"
	"github.com/deltix/capability-policy-service/config"
	"github.com/deltix/capability-policy-service/handlers"
	"github.com/deltix/capability-policy-service/routes"
	"github.com/deltix/capability-policy-service/services"
	"github.com/deltix/shared/database"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("capability-policy-service terminated with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.LoadCapabilityPolicyConfigFromEnv()
	if err != nil {
		return err
	}

	pgPool, err := database.NewSupabasePool(ctx, cfg.Postgres)
	if err != nil {
		return err
	}
	defer pgPool.Close()

	capRepo := services.NewPostgresCapabilityRepository(pgPool)
	approvalRepo := services.NewPostgresApprovalRepository(pgPool)

	paypalAdapter := adapters.NewPayPalSandboxAdapter(
		cfg.PayPalBaseURL,
		cfg.PayPalClientID,
		cfg.PayPalClientSecret,
		nil,
		nil,
	)

	capService := services.NewCapabilityService(capRepo, paypalAdapter, cfg.ApprovalHMACSecret)
	resumeNotifier := services.NewHTTPRuntimeResumeNotifier(cfg.RuntimeServiceURL, nil)
	policyService := services.NewPolicyService(approvalRepo, resumeNotifier, cfg.ApprovalHMACSecret)

	capHandler := handlers.NewCapabilityHandler(capService)
	policyHandler := handlers.NewPolicyHandler(policyService)
	router := routes.NewRouter(capHandler, policyHandler)

	server := &http.Server{
		Addr:         ":" + cfg.HTTPPort,
		Handler:      router,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info(
			"starting DelTix Capability & Policy Service",
			"port", cfg.HTTPPort,
			"paypal_base_url", cfg.PayPalBaseURL,
		)
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
		}
		close(errCh)
	}()

	select {
	case serveErr := <-errCh:
		return serveErr
	case <-ctx.Done():
		logger.Info("shutting down DelTix Capability & Policy Service gracefully")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}
