package database

import (
	"context"
	"fmt"

	"github.com/deltix/shared/config"
	"github.com/redis/go-redis/v9"
)

// NewUpstashRedisClient parses an Upstash rediss:// TLS URL, configures timeouts,
// and verifies connectivity with a PING command.
func NewUpstashRedisClient(ctx context.Context, cfg config.RedisConfig) (*redis.Client, error) {
	opts, err := buildRedisOptions(cfg)
	if err != nil {
		return nil, fmt.Errorf("build upstash redis options: %w", err)
	}

	client := redis.NewClient(opts)
	if err := verifyRedisConnection(ctx, client); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("verify upstash redis connection: %w", err)
	}

	return client, nil
}

func buildRedisOptions(cfg config.RedisConfig) (*redis.Options, error) {
	// ParseURL automatically configures TLS when given a "rediss://" URL from Upstash.
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}

	opts.DialTimeout = cfg.DialTimeout
	opts.ReadTimeout = cfg.ReadTimeout
	opts.WriteTimeout = cfg.WriteTimeout

	return opts, nil
}

func verifyRedisConnection(ctx context.Context, client *redis.Client) error {
	if err := client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("ping redis: %w", err)
	}
	return nil
}