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

	"github.com/deltix/agent-runtime-service/config"
	"github.com/deltix/agent-runtime-service/handlers"
	"github.com/deltix/agent-runtime-service/routes"
	"github.com/deltix/agent-runtime-service/services"
	"github.com/deltix/shared/database"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("agent-runtime-service terminated with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.LoadRuntimeConfigFromEnv()
	if err != nil {
		return err
	}

	pgPool, err := database.NewSupabasePool(ctx, cfg.Postgres)
	if err != nil {
		return err
	}
	defer pgPool.Close()

	redisClient, err := database.NewUpstashRedisClient(ctx, cfg.Redis)
	if err != nil {
		return err
	}
	defer func() { _ = redisClient.Close() }()

	runRepo := services.NewPostgresRunStateRepository(pgPool)
	lockMgr := services.NewRedisRunLockManager(redisClient)
	workerClient := services.NewHTTPWorkerBridgeClient(cfg.WorkerBridgeURL, nil)

	runtimeService := services.NewRuntimeService(
		runRepo,
		lockMgr,
		workerClient,
		cfg.ReadinessHMACSecret,
		cfg.LockTTL,
	)
	runtimeHandler := handlers.NewRuntimeHandler(runtimeService)
	router := routes.NewRouter(runtimeHandler)

	server := &http.Server{
		Addr:         ":" + cfg.HTTPPort,
		Handler:      router,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info(
			"starting DelTix Agent Runtime Control Plane",
			"port", cfg.HTTPPort,
			"worker_bridge_url", cfg.WorkerBridgeURL,
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
		logger.Info("shutting down DelTix Agent Runtime Control Plane gracefully")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}
