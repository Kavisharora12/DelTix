# Service: Event Ingestion

## Responsibility

Receive webhooks from PayPal Sandbox, events from internal services, and synthetic security events; verify authenticity (HMAC signature); perform sub-millisecond deduplication with Redis; durably persist raw payloads to PostgreSQL `source_events`; and trigger normalization.

```mermaid
flowchart LR
    HOOK["Incoming Webhook / Event"] --> SIG["Signature Verification\n(PayPal SDK / Go crypto)"]
    SIG -->|Valid| REDIS{"Redis Deduplication\n(SETNX)"}
    SIG -->|Invalid| REJECT["Reject 401 & Audit"]
    REDIS -->|Duplicate| ACK["Return 200 (Duplicate)"]
    REDIS -->|New Event| DB[("Persist to\nsource_events")]
    DB --> ACK2["Return 200 Accepted"]
    DB --> NEXT["Forward to Normalizer"]
```

## Go Ingestion Interface

```go
type IngestedEvent struct {
    Source        string          `json:"source"`
    SourceEventID string          `json:"source_event_id"`
    EventType     string          `json:"event_type"`
    OccurredAt    time.Time       `json:"occurred_at"`
    Payload       json.RawMessage `json:"payload"`
    Verified      bool            `json:"verified"`
}

type IngestionService interface {
    IngestWebhook(ctx context.Context, headers http.Header, body []byte) (eventID string, duplicate bool, err error)
    IngestInternalEvent(ctx context.Context, event IngestedEvent) (eventID string, duplicate bool, err error)
}
```

## Acceptance Rules
1. PayPal webhook signatures must be verified before payload fields are trusted.
2. In-memory deduplication with Redis prevents race conditions on rapid retries.
3. Durable persistence to PostgreSQL `source_events` must succeed prior to returning HTTP 200.
4. Secrets, auth tokens, and full card details are never written to logs or raw payloads.
