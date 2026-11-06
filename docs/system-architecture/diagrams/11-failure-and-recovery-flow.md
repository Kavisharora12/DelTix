# 11 — Failure and Recovery Flow Diagram

This diagram visualizes failure detection, circuit breaker fast-failing, safe retry evaluations, reconcile-before-retry, and process crash recovery in **DelTix** oriented Left to Right.

```mermaid
flowchart LR
    StartNode["Execute Node Step"] --> PreCheckpoint["1. Write Pre-Run\nCheckpoint to Supabase"]
    PreCheckpoint --> InvokeStep["2. Dispatch Node\nExecution via gRPC"]
    
    InvokeStep --> Outcome{"3. Execution\nOutcome?"}
    Outcome -->|Success| SaveStep["4. Commit Output State\nAdvance Graph Transition"]
    SaveStep --> NextStep["Next Graph Node"]

    Outcome -->|5xx / Timeout| BreakerCheck{"Circuit Breaker\nTripped?"}
    BreakerCheck -->|Yes - Open| RouteCompensation["Circuit Open:\nFast-fail to Fallback Node"]
    BreakerCheck -->|No - Closed| RetryCheck{"5. Retries < Max?"}
    
    RetryCheck -->|Yes| MutationCheck{"Mutation Action?"}
    MutationCheck -->|Yes - Payment| ReconcileProvider["Safety Check:\nQuery Provider First\n(Reconcile-Before-Retry)"]
    ReconcileProvider -->|Already Processed| SaveStep
    ReconcileProvider -->|Not Processed| BackoffWait["Exponential Backoff\n(1s, 2s, 4s...)"]
    BackoffWait --> InvokeStep
    MutationCheck -->|No - Safe Read| BackoffWait

    RetryCheck -->|No - Exceeded| ErrorRoute["6. Trigger Node Fallback"]
    Outcome -->|Fatal 4xx| ErrorRoute

    ErrorRoute --> HasFallback{"Has Fallback Edge?"}
    HasFallback -->|Yes| RouteCompensation["Route to Compensation\nNode Handler"]
    RouteCompensation --> NextStep
    HasFallback -->|No| TerminateFail["Halt Run (Status: FAILED)\nRelease Redis Mutex"]

    subgraph WorkerReboot["Process Crash / Reboot Sweep"]
        CrashPoint["Container Reboots Mid-Execution"] -.-> StartupSweep["Startup Background Sweep\n(Query runs with status='RUNNING')"]
        StartupSweep --> HydrateLastCheckpoint["Hydrate Last Committed\nCheckpoint from Supabase"]
        HydrateLastCheckpoint --> PreCheckpoint
    end
```
