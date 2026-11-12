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

	"github.com/deltix/api-gateway/config"
	"github.com/deltix/api-gateway/handlers"
	"github.com/deltix/api-gateway/middleware"
	"github.com/deltix/api-gateway/routes"
	"github.com/deltix/api-gateway/services"
	"github.com/deltix/shared/auth"
	"github.com/deltix/shared/database"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("api-gateway terminated with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.LoadGatewayConfigFromEnv()
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
	defer func() {
		_ = redisClient.Close()
	}()

	proxyService, err := services.NewProxyService(
		cfg.CompilerServiceURL,
		cfg.RuntimeServiceURL,
		cfg.MemoryServiceURL,
		cfg.CapabilityPolicyServiceURL,
	)
	if err != nil {
		return err
	}

	sessionManager := auth.NewRedisSessionManager(redisClient, cfg.GoogleAuth, nil)
	userStore := handlers.NewPostgresUserStore(pgPool)

	authMiddleware := middleware.NewAuthMiddlewareWithDevAuth(sessionManager, cfg.AllowDevAuth)
	rateLimitMiddleware := middleware.NewRateLimitMiddleware(redisClient, cfg.RateLimitPerMinute)
	corsMiddleware := middleware.NewCORSMiddleware(cfg.CORSOrigins)
	gatewayHandler := handlers.NewGatewayHandler(sessionManager, userStore, cfg.CookieSecure).
		WithFrontendRedirectURL(cfg.FrontendURL)

	router := routes.NewRouter(
		gatewayHandler,
		authMiddleware,
		rateLimitMiddleware,
		proxyService.CompilerProxy(),
		proxyService.RuntimeProxy(),
		proxyService.NewSSEReverseProxy(),
		proxyService.CapabilityPolicyProxy(),
	)

	server := &http.Server{
		Addr:         ":" + cfg.HTTPPort,
		Handler:      corsMiddleware.Handler(router),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("starting DelTix API Gateway", "port", cfg.HTTPPort)
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
		}
		close(errCh)
	}()

	select {
	case serveErr := <-errCh:
		return serveErr
	case <-ctx.Done():
		logger.Info("shutting down DelTix API Gateway gracefully")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	}
}
