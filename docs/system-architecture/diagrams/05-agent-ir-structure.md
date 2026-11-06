# 05 — Agent Intermediate Representation (Agent IR) Structure Diagram

This class diagram defines the data contracts and relationships within the **DelTix** Agent Intermediate Representation (`Agent IR v1.0`).

```mermaid
classDiagram
    class AgentIR {
        +string ir_version
        +string agent_id
        +string tenant_id
        +Metadata metadata
        +IOContract inputs
        +IOContract outputs
        +List~CapabilityRef~ capabilities
        +PolicyConfig policies
        +MemoryConfig memory
        +ExecutionLimits limits
        +List~NodeDefinition~ nodes
        +List~TransitionEdge~ transitions
    }

    class Metadata {
        +string name
        +string description
        +string category
        +string author
        +string created_at
    }

    class CapabilityRef {
        +string capability_id
        +string version
        +bool is_sensitive
        +List~string~ allowed_actions
    }

    class PolicyConfig {
        +float max_budget_usd
        +bool read_only
        +bool require_human_approval
        +List~string~ approval_triggers
        +List~string~ forbidden_actions
    }

    class MemoryConfig {
        +bool enable_semantic_memory
        +string memory_namespace
        +int max_retrieval_k
        +List~string~ state_keys_to_persist
    }

    class ExecutionLimits {
        +int max_steps
        +int timeout_seconds
        +int max_loop_iterations
        +int max_consecutive_errors
    }

    class NodeDefinition {
        +string id
        +string type
        +string description
        +map input_mapping
        +map output_mapping
        +RetryConfig retry_policy
        +NodePayload payload
    }

    class TransitionEdge {
        +string from_node
        +string to_node
        +string condition_expression
        +bool is_default
    }

    AgentIR *-- Metadata
    AgentIR *-- CapabilityRef
    AgentIR *-- PolicyConfig
    AgentIR *-- MemoryConfig
    AgentIR *-- ExecutionLimits
    AgentIR *-- NodeDefinition
    AgentIR *-- TransitionEdge
```
