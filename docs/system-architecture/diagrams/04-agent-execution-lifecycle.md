# 04 — Agent Execution Lifecycle Diagram

This state diagram details the runtime execution lifecycle in **DelTix** oriented Left to Right, covering node execution, state checkpointing in Supabase, Redis locking, and human-in-the-loop pauses.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> INITIALIZING: Trigger Run
    INITIALIZING --> RUNNING: Acquire Redis Lock & Load IR
    
    state RUNNING {
        direction LR
        NodeExecution --> StateCheckpoint: Node Complete
        StateCheckpoint --> EvaluateTransitions: Save to Supabase
        EvaluateTransitions --> NodeExecution: Next Node Found
    }
    
    RUNNING --> PAUSED_APPROVAL: Sensitive Tool Reached
    
    state PAUSED_APPROVAL {
        direction LR
        PersistState --> ReleaseRedisLock
        ReleaseRedisLock --> WaitForHumanDecision
    }
    
    PAUSED_APPROVAL --> RESUMING: Decision Received
    
    state RESUMING {
        direction LR
        VerifyToken --> ReacquireRedisLock
    }
    
    RESUMING --> RUNNING: Decision == APPROVED
    RESUMING --> REJECTED: Decision == DENIED
    
    RUNNING --> FAILED: Errors Exceeded
    RUNNING --> COMPLETED: End Node Reached
    
    REJECTED --> [*]
    FAILED --> [*]
    COMPLETED --> [*]
```
