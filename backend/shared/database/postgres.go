package database

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/deltix/shared/config"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	DefaultPageLimit = 25
	MaxPageLimit     = 100
)

var (
	ErrInvalidPagination = errors.New("pagination limit and offset must be non-negative")
)

// PageQuery defines parameters for fast indexed pagination using either a monotonic
// cursor (AfterSeqID) or bounded offset over indexed seq_id columns.
type PageQuery struct {
	Limit      int32
	Offset     int32
	AfterSeqID int64
}

func (p PageQuery) Normalize() (PageQuery, error) {
	if p.Limit < 0 || p.Offset < 0 || p.AfterSeqID < 0 {
		return PageQuery{}, ErrInvalidPagination
	}
	if p.Limit == 0 {
		p.Limit = DefaultPageLimit
	}
	if p.Limit > MaxPageLimit {
		p.Limit = MaxPageLimit
	}
	return p, nil
}

// NewSupabasePool initializes a pgx connection pool configured for Supabase (direct or Supavisor pooler)
// and verifies connectivity before returning.
func NewSupabasePool(ctx context.Context, cfg config.PostgresConfig) (*pgxpool.Pool, error) {
	poolConfig, err := buildPoolConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("build supabase pool config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create supabase connection pool: %w", err)
	}

	if err := verifyPostgresConnection(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("verify supabase connection: %w", err)
	}

	return pool, nil
}

// RunMigrationFile executes a SQL migration file inside a single ACID transaction
// and records the applied version in schema_migrations.
func RunMigrationFile(ctx context.Context, pool *pgxpool.Pool, version string, filePath string) error {
	if err := ensureMigrationTable(ctx, pool); err != nil {
		return err
	}

	alreadyApplied, err := isMigrationApplied(ctx, pool, version)
	if err != nil {
		return err
	}
	if alreadyApplied {
		return nil
	}

	sqlBytes, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read migration file %s: %w", filePath, err)
	}

	return applyMigrationTransaction(ctx, pool, version, string(sqlBytes))
}

func ensureMigrationTable(ctx context.Context, pool *pgxpool.Pool) error {
	const query = `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version     TEXT PRIMARY KEY,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
		);`
	if _, err := pool.Exec(ctx, query); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}
	return nil
}

func isMigrationApplied(ctx context.Context, pool *pgxpool.Pool, version string) (bool, error) {
	const query = `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1);`
	var exists bool
	if err := pool.QueryRow(ctx, query, version).Scan(&exists); err != nil {
		return false, fmt.Errorf("check migration version %s: %w", version, err)
	}
	return exists, nil
}

func applyMigrationTransaction(ctx context.Context, pool *pgxpool.Pool, version string, sqlContent string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin migration transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if _, err := tx.Exec(ctx, sqlContent); err != nil {
		return fmt.Errorf("execute migration %s: %w", version, err)
	}

	const recordQuery = `INSERT INTO schema_migrations (version) VALUES ($1);`
	if _, err := tx.Exec(ctx, recordQuery, version); err != nil {
		return fmt.Errorf("record migration %s: %w", version, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migration %s: %w", version, err)
	}

	return nil
}

func buildPoolConfig(cfg config.PostgresConfig) (*pgxpool.Config, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	poolConfig.MaxConns = cfg.MaxConns
	poolConfig.MinConns = cfg.MinConns
	poolConfig.MaxConnLifetime = cfg.MaxConnLifetime
	poolConfig.MaxConnIdleTime = cfg.MaxConnIdleTime
	poolConfig.HealthCheckPeriod = cfg.HealthCheckPeriod

	// Supabase transaction pooler (PgBouncer/Supavisor) does not support prepared statements
	// across pooled connections unless simple protocol mode is enabled.
	if cfg.UseSimpleProtocol {
		poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	}

	return poolConfig, nil
}

func verifyPostgresConnection(ctx context.Context, pool *pgxpool.Pool) error {
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping postgres: %w", err)
	}
	return nil
}