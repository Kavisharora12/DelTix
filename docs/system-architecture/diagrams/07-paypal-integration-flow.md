# 07 — PayPal Integration Flow Diagram

This sequence diagram details the controlled invocation flow from the LangGraph node through the Go Capability & Policy Service, Redis idempotency check, and the PayPal Developer Sandbox.

```mermaid
sequenceDiagram
    autonumber
    participant Runtime as Agent Runtime (Python / LangGraph)
    participant CapSvc as Capability & Policy Service (Go)
    participant Redis as Redis 7 (Idempotency Cache)
    participant Policy as Policy Enforcement Engine (Go)
    participant Adapter as PayPal Adapter (Go)
    participant PayPal as PayPal Developer Sandbox
    participant DB as Supabase (Audit Log)

    Runtime->>CapSvc: POST /v1/capabilities/execute (capability_id, parameters, run_id, tenant_id)
    
    CapSvc->>Policy: EvaluatePolicy(capability_id, parameters, run_context)
    alt Policy Evaluation Rejection
        Policy-->>CapSvc: REJECT (Forbidden action / Spend limit exceeded)
        CapSvc->>DB: AppendAuditLog(run_id, BLOCKED_BY_POLICY)
        CapSvc-->>Runtime: Error 403 Forbidden (Policy Violation)
    else Requires Approval
        Policy-->>CapSvc: SUSPEND (Requires Human Sign-off)
        CapSvc->>DB: AppendAuditLog(run_id, APPROVAL_REQUIRED)
        CapSvc-->>Runtime: Status 202 Accepted (Run Suspended)
    else Policy Allowed
        Policy-->>CapSvc: ALLOW
        
        CapSvc->>Redis: SETNX idempotency:run_id:step_idx (TTL: 24h)
        alt Duplicate Request Detected
            Redis-->>CapSvc: Key Exists (Duplicate Mutation)
            CapSvc-->>Runtime: Error 409 Conflict (Duplicate Request Suppressed)
        else Lock Acquired
            CapSvc->>Adapter: ExecuteAdapter(capability_id, parameters)
            Adapter->>Adapter: Ensure OAuth2 Bearer Token (Auto-refresh)
            
            Adapter->>PayPal: HTTPS REST Call with PayPal-Request-Id header
            alt PayPal Network / 5xx Error
                PayPal-->>Adapter: 500 / 503 Gateway Error
                Adapter->>Adapter: Verify State: Read before retrying mutation
                Adapter-->>CapSvc: Error (Transient / Safe Retry)
            else PayPal Success
                PayPal-->>Adapter: 200 / 201 Response JSON
                Adapter-->>CapSvc: Structured Result
                CapSvc->>DB: AppendAuditLog(run_id, TOOL_SUCCESS, raw_response_digest)
                CapSvc-->>Runtime: Typed Node Output
            end
        end
    end
```
