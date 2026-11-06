# 05 — Agent Intermediate Representation (Agent IR) Structure Diagram

This class diagram defines the data contracts and relationships within the **DelTix** Agent Intermediate Representation (`Agent IR v1.0`), oriented Left to Right.

```mermaid
classDiagram
    direction LR

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
        +string created_at
    }

    class CapabilityRef {
        +string capability_id
        +string version
        +bool is_sensitive
    }

    class PolicyConfig {
        +float max_budget_usd
        +bool read_only
        +bool require_human_approval
    }

    class MemoryConfig {
        +bool enable_semantic_memory
        +string memory_namespace
        +int max_retrieval_k
    }

    class ExecutionLimits {
        +int max_steps
        +int timeout_seconds
        +int max_loop_iterations
    }

    class NodeDefinition {
        +string id
        +string type
        +map input_mapping
        +map output_mapping
        +RetryConfig retry_policy
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
