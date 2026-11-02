# Service: Detection and Incident Management

## Responsibility

Evaluate deterministic rules against normalized event streams and authoritative state. Create, deduplicate, and transition incidents across their lifecycle.

```mermaid
flowchart TD
    EVT["Normalized Event"] --> EVAL["Deterministic Rule Evaluator"]
    EVAL --> RULE1{"Operational Rule:\nPayment Captured &\nOrder Pending > Grace Period?"}
    EVAL --> RULE2{"Security Rule:\nPayout Requested &\nMissing Business Auth?"}
    
    RULE1 -->|Yes| INC1["Create/Update Incident:\nPAYMENT_CAPTURED_ORDER_PENDING"]
    RULE2 -->|Yes| INC2["Create/Update Incident:\nPAYOUT_WITHOUT_BUSINESS_AUTHORIZATION"]
    RULE1 -->|No| OK["No Anomaly Detected"]
    RULE2 -->|No| OK

    INC1 --> DEDUP{"Active Incident Exists\nfor Correlation Key?"}
    INC2 --> DEDUP
    DEDUP -->|Yes| APPEND["Append Event & Update Timeline"]
    DEDUP -->|No| CREATE["Persist New Incident & Trigger Investigation"]
```

## Initial Deterministic Rules

### 1. Operational: `PAYMENT_CAPTURED_ORDER_PENDING`
- **Trigger:** PayPal capture confirmed `COMPLETED`, but internal order state remains `PENDING` past configured grace period (e.g., 60 seconds).
- **Severity:** `MEDIUM` / `HIGH` depending on transaction age.

### 2. Security: `PAYOUT_WITHOUT_BUSINESS_AUTHORIZATION`
- **Trigger:** Simulated payout event received without corresponding approved business instruction or verified beneficiary.
- **Severity:** `CRITICAL`.
