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

	"github.com/deltix/agent-compiler-service/config"
	"github.com/deltix/agent-compiler-service/handlers"
	"github.com/deltix/agent-compiler-service/routes"
	"github.com/deltix/agent-compiler-service/services"
	"github.com/deltix/shared/database"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("agent-compiler-service terminated with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.LoadCompilerConfigFromEnv()
	if err != nil {
		return err
	}

	pgPool, err := database.NewSupabasePool(ctx, cfg.Postgres)
	if err != nil {
		return err
	}
	defer pgPool.Close()

	specRepo := services.NewPostgresSpecRepository(pgPool)
	capabilityCatalog := services.NewPostgresCapabilityCatalog(pgPool)
	llmSynthesizer := services.NewOpenAIIRSynthesizer(cfg.LLMBaseURL, cfg.LLMAPIKey, cfg.LLMModel, nil)
	validator := services.NewValidatorService(capabilityCatalog)

	compilerService := services.NewCompilerService(
		specRepo,
		capabilityCatalog,
		llmSynthesizer,
		validator,
		cfg.ReadinessHMACSecret,
	)
	compilerHandler := handlers.NewCompilerHandler(compilerService)

	router := routes.NewRouter(compilerHandler)

	server := &http.Server{
		Addr:         ":" + cfg.HTTPPort,
		Handler:      router,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("starting DelTix Agent Compiler Service", "port", cfg.HTTPPort)
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
		}
		close(errCh)
	}()

	select {
	case serveErr := <-errCh:
		return serveErr
	case <-ctx.Done():
		logger.Info("shutting down DelTix Agent Compiler Service gracefully")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}
