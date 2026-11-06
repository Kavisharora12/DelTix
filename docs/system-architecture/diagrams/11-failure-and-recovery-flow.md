# 11 — Failure and Recovery Flow Diagram

This diagram visualizes failure detection, safe retry evaluations, checkpoint rollbacks, and process crash recovery in **DelTix**.

```mermaid
flowchart TD
    StartNode["Execute Graph Node"] --> CheckpointBefore["Write Pre-execution Checkpoint\n(Supabase status: RUNNING, step_index: i)"]
    
    CheckpointBefore --> RunNode["Invoke Node Handler\n(Tool / LLM / Calculation)"]
    
    RunNode --> ResultCheck{"Execution Result?"}
    
    ResultCheck -->|Success| SaveSuccess["Persist Node State Output to Supabase\nAdvance to Next Edge"]
    SaveSuccess --> NextStep["Next Graph Node"]
    
    ResultCheck -->|Transient Failure\n503 / Timeout| EvalRetry{"Retry Policy Check\nAttempts < MaxRetries?"}
    
    EvalRetry -->|Yes| IdempotencyCheck{"Is Mutation Operation?"}
    IdempotencyCheck -->|Yes - Payment Action| ReconcileFirst["Safety Check: Read Provider First\n(Verify if PayPal order/capture actually executed)"]
    ReconcileFirst -->|Already Processed| SaveSuccess
    ReconcileFirst -->|Not Processed| Backoff["Exponential Jittered Backoff\n(Wait 1s, 2s, 4s...)"]
    Backoff --> RunNode
    
    IdempotencyCheck -->|No - Safe Read| Backoff
    
    EvalRetry -->|No - Exceeded Max| FailStep["Trigger Node Error Handler"]
    ResultCheck -->|Fatal Error / 400 Bad Request| FailStep
    
    FailStep --> FallbackCheck{"Has Fallback Edge in IR?"}
    
    FallbackCheck -->|Yes| RouteFallback["Route to Fallback Compensation Node\n(e.g., Alert Operator / Mark Flagged)"]
    RouteFallback --> NextStep
    
    FallbackCheck -->|No| SuspendFail["Halt Execution\nUpdate Supabase Status: FAILED\nPersist Error Diagnostics to Audit Log\nRelease Redis Lock"]
    
    subgraph ProcessCrash["Process Crash / Sudden Power Loss"]
        CrashPoint["Worker Process Dies Mid-Execution"] -.-> RestartWorker["Worker Container Reboots"]
        RestartWorker --> ScanPending["Query Supabase for Incomplete Runs\nWHERE status = 'RUNNING'"]
        ScanPending --> RestoreLastCheckpoint["Load Last Committed Step Checkpoint"]
        RestoreLastCheckpoint --> CheckpointBefore
    end
```
