# API Contracts & Internal Interfaces

## 1. External & Client APIs (Go Backend)

### Ingestion
- `POST /v1/events` — Ingest internal service or simulated security event.
- `POST /v1/webhooks/paypal` — Dedicated endpoint for PayPal Sandbox webhooks. Performs signature verification, sets Redis dedup key, writes to `source_events`, and responds with HTTP 200.

Response:
```json
{
  "event_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "accepted",
  "duplicate": false
}
```

### Incidents
- `GET /v1/incidents` — List active/resolved incidents (supports indexed offset pagination via `cursor_time` and `cursor_id`).
- `GET /v1/incidents/{incident_id}` — Get incident detail, chronological timeline, and evidence.
- `POST /v1/incidents/{incident_id}/investigate` — Trigger AI investigation pipeline.

### Actions & Approvals
- `GET /v1/incidents/{incident_id}/actions` — View proposed actions and status.
- `POST /v1/actions/{action_id}/approve` — Operator approval with authentication.
- `POST /v1/actions/{action_id}/reject` — Operator rejection with reason.

---

## 2. Internal Interface: Go Backend to Python AI Service

The Go core calls the Python AI service (`POST /ai/investigate`) with a structured payload:

### Request to Python Service:
```json
{
  "incident_id": "7b2e8cf3-1574-4b53-a5f1-8302f321481b",
  "incident_type": "PAYMENT_CAPTURED_ORDER_PENDING",
  "timeline": [
    {
      "event_id": "evt-001",
      "event_type": "PAYMENT.CAPTURE.COMPLETED",
      "occurred_at": "2026-11-02T10:00:00Z",
      "source": "paypal_webhook"
    }
  ],
  "evidence": [
    {
      "evidence_id": "evi-001",
      "kind": "AUTHORITATIVE_PROVIDER_QUERY",
      "source_ref": "CAP-90123",
      "claim": "PayPal Sandbox API confirms capture is COMPLETED for amount $49.00 USD",
      "observed_at": "2026-11-02T10:01:00Z",
      "details": {
        "status": "COMPLETED",
        "amount": "49.00",
        "currency": "USD"
      }
    },
    {
      "evidence_id": "evi-002",
      "kind": "INTERNAL_DATABASE_RECORD",
      "source_ref": "ORD-2048",
      "claim": "Merchant order ORD-2048 remains PENDING in database",
      "observed_at": "2026-11-02T10:01:05Z",
      "details": {
        "status": "PENDING"
      }
    }
  ]
}
```

### Response from Python Service (Strict Pydantic / Instructor Schema):
```json
{
  "summary": "PayPal capture succeeded but internal order state was not updated due to a missed internal event.",
  "verified_facts": [
    {
      "claim": "PayPal has confirmed payment capture for order ORD-2048.",
      "evidence_ids": ["evi-001"]
    },
    {
      "claim": "Merchant order state is stale and still pending.",
      "evidence_ids": ["evi-002"]
    }
  ],
  "hypotheses": [
    {
      "claim": "Internal webhook consumer crashed prior to order record update.",
      "supporting_evidence_ids": ["evi-001", "evi-002"],
      "limitations": "Direct process crash logs are unavailable."
    }
  ],
  "unknowns": [
    "Duration of consumer downtime."
  ],
  "proposed_action": {
    "action_type": "REPROCESS_INTERNAL_ORDER_EVENT",
    "parameters": {
      "order_id": "ORD-2048",
      "source_event_id": "evt-001"
    },
    "reason": "Re-applying the verified capture event will reconcile merchant order state safely.",
    "preconditions": [
      "provider_capture_status_is_completed",
      "order_is_still_pending"
    ],
    "postconditions": [
      "order_status_is_paid"
    ]
  }
}
```

---

## 3. Error Conventions

Standardized machine-readable error codes:
- `INVALID_SIGNATURE`
- `DUPLICATE_EVENT`
- `INCIDENT_NOT_FOUND`
- `ACTION_NOT_ALLOWED`
- `APPROVAL_REQUIRED`
- `PRECONDITION_FAILED`
- `OUTCOME_UNKNOWN`
- `VERIFICATION_FAILED`
