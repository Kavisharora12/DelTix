# 04 — Agent Execution Lifecycle Diagram

This state diagram details the runtime execution lifecycle in **DelTix**, covering node execution, state checkpointing in Supabase, Redis locking, and human-in-the-loop pauses.

```mermaid
stateDiagram-v2
    [*] --> INITIALIZING: Trigger Run (Inputs + Spec ID)
    
    INITIALIZING --> RUNNING: Load Agent IR & Acquire Redis Lock
    
    state RUNNING {
        [*] --> NodeExecution: Select Next Node
        
        state NodeExecution {
            direction TB
            CheckType --> LLMReasoning: Type == LLM_REASONING (Python / LangGraph)
            CheckType --> ToolExecution: Type == TOOL_EXECUTION (Go / PayPal Adapter)
            CheckType --> MemoryNode: Type == MEMORY_ACCESS (Python / Mem0)
            CheckType --> DeterministicCalc: Type == DETERMINISTIC_PROCESS (Go)
        }
        
        NodeExecution --> StateCheckpoint: Node Complete
        StateCheckpoint --> EvaluateTransitions: Persist Checkpoint to Supabase
        
        EvaluateTransitions --> NodeExecution: Next Node Found
        EvaluateTransitions --> LoopBack: Condition Met (Counter < Max)
        LoopBack --> NodeExecution
    }
    
    RUNNING --> PAUSED_APPROVAL: Sensitive Tool / Approval Node Reached
    
    state PAUSED_APPROVAL {
        PersistCheckpoint: Save State to Supabase (Status = PAUSED)
        ReleaseLock: Release Redis Execution Lock
        EmitNotification: Generate Approval Token & Alert User
        WaitForInput: Suspended (Zero Worker Threads Held)
    }
    
    PAUSED_APPROVAL --> RESUMING: User Decision Received
    
    state RESUMING {
        VerifyToken: Validate Approval Token & Signature
        CheckDecision: Decision == APPROVED ?
        ReacquireLock: Acquire Redis Lock for RunID
    }
    
    RESUMING --> RUNNING: Approved -> Execute Paused Action
    RESUMING --> REJECTED: Denied -> Execute Fallback / Terminate
    
    RUNNING --> FAILED: Retry Limit Exceeded / Unrecoverable Error
    RUNNING --> COMPLETED: Reached Terminal End Node
    
    REJECTED --> [*]: Release Redis Lock
    FAILED --> [*]: Release Redis Lock
    COMPLETED --> [*]: Release Redis Lock
```
