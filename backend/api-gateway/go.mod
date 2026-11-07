module github.com/deltix/api-gateway

go 1.27.0

replace github.com/deltix/shared => ../shared

require (
	github.com/deltix/shared v0.0.0-00010101000000-000000000000
	github.com/jackc/pgx/v5 v5.12.0
	github.com/redis/go-redis/v9 v9.23.0
)

require (
	cloud.google.com/go/compute/metadata v0.3.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.3 // indirect
	go.uber.org/atomic v1.12.0 // indirect
	golang.org/x/oauth2 v0.37.0 // indirect
	golang.org/x/sync v0.22.0 // indirect
	golang.org/x/sys v0.48.0 // indirect
	golang.org/x/text v0.41.0 // indirect
)
