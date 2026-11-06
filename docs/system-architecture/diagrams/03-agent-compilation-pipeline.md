# 03 — Agent Compilation Pipeline Diagram

This diagram outlines the 9-stage compilation pipeline in **DelTix**, from natural language input to a validated, executable Agent IR.

```mermaid
flowchart TD
    Prompt["Natural Language Requirement\n(e.g., 'Reconcile yesterday transactions with orders and report discrepancies')"] --> Ingestion["Stage 1: Intent & Entity Extraction\n(Go + LLM Structured Output)"]
    
    Ingestion --> CheckClarify{"Missing Required\nInformation?"}
    CheckClarify -->|Yes| Clarify["Clarification Engine\nGenerate targeted questions for user"]
    Clarify --> Prompt
    
    CheckClarify -->|No| IRGen["Stage 2: Agent IR Draft Synthesis\n(LLM Structured JSON Mode)"]
    
    IRGen --> SchemaVal["Stage 3: Deterministic Schema Validation\n(Go JSON Schema Validator)"]
    SchemaVal -->|Invalid| IRRepair["Compile Error: Schema Violation\n(Auto-repair prompt or reject)"]
    IRRepair --> IRGen
    
    SchemaVal -->|Valid| GraphVal["Stage 4: Graph Topology Validation (Go)\n- Detect unreachable nodes\n- Detect circular loops without exit\n- Verify terminal nodes"]
    GraphVal -->|Invalid Topology| IRRepair
    
    GraphVal -->|Valid Topology| CapRes["Stage 5: Capability Resolution (Deterministic Go)\nQuery Capability Registry for requested tools"]
    CapRes --> CheckTools{"All Capabilities\nRegistered?"}
    CheckTools -->|Unknown Tool| RejectTool["Compile Error: Unsupported Tool\n(No fictitious APIs allowed)"]
    
    CheckTools -->|Resolved| PolVal["Stage 6: Policy Engine Validation (Deterministic Go)\n- Check spend limits against max allowed\n- Enforce human approval on write operations\n- Check read-only invariants"]
    PolVal --> CheckPolicy{"Policy Compliant?"}
    CheckPolicy -->|Violation| RejectPolicy["Compile Error: Policy Conflict"]
    
    CheckPolicy -->|Passed| TestGen["Stage 7: Synthetic Test Generation (LLM + Archetypes)\nGenerate positive, negative, and failure scenarios"]
    TestGen --> TestRunner["Stage 8: Pre-flight Sandbox Test Execution (Go)\nExecute mock runs through synthetic harness"]
    TestRunner --> CheckTests{"All Tests Pass?"}
    CheckTests -->|Failed| TestFix["Compile Error: Test Case Failure"]
    
    CheckTests -->|Passed| FinalIR["Stage 9: Validated Executable Agent IR\n- Cryptographically signed\n- Persisted to Supabase (agent_specs)\n- Ready for User Review & Execution"]
```
