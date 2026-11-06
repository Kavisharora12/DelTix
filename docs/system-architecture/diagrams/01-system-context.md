# 01 — System Context Diagram

This diagram visualizes the high-level system context for **DelTix**, showing interactions between users, the DelTix platform, PayPal Sandbox, foundation LLM providers, and LangSmith.

```mermaid
flowchart LR
    User["Merchant / Developer / Business User"]
    Admin["Compliance & Security Auditor"]

    subgraph DelTix["DelTix Platform"]
        CoreControl["DelTix Control Plane & Runtime\n- Natural Language Agent Compiler (Go)\n- Agent IR Validation & Graph Synthesis (Go)\n- Capability Resolution & Policy Guard (Go)\n- Stateful Execution Engine (Python / LangGraph)\n- Long-Term Semantic Memory (Python / Mem0)\n- Distributed Cache & Locks (Redis)\n- Authoritative State & Vector Store (Supabase / PostgreSQL)"]
    end

    subgraph ExternalSystems["External Systems & Providers"]
        PayPal["PayPal Developer Sandbox\n- Orders API (v2)\n- Payments API (Captures)\n- Disputes API (v1)\n- Transactions API (v1)"]
        LLM["Foundation LLM Provider\n- Structured JSON Schema / Tool Calling\n- Extraction & Reasoning Engine"]
        LangSmith["LangSmith Platform\n- Distributed Tracing & Observability\n- LLM Call Latency & Token Analytics\n- Evaluation Datasets & Run Feedback"]
    end

    User -->|"1. Describes agent in NL\n2. Inspects Agent IR & Test Report\n3. Grants Human Approvals"| CoreControl
    Admin -->|"Reviews audit trails & policy configurations"| CoreControl

    CoreControl <-->|"Prompts, Schemas, Reasoning Calls"| LLM
    CoreControl <-->|"OAuth2, Idempotent Operations (Orders/Captures/Refunds)"| PayPal
    CoreControl -->|"Emits traces, run metadata, step spans"| LangSmith
```
