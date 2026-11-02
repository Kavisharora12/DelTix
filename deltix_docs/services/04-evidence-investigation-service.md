# Service: Evidence and AI Investigation (with PayPal Agent Toolkit & Memory)

## Responsibility

Collect authoritative evidence directly from live PayPal Sandbox APIs using the official **`paypal-agent-toolkit`**, retrieve similar historical incidents via a vector memory layer (`pgvector`), and generate structured, evidence-grounded incident investigations using an AI agent.

```mermaid
flowchart TB
    subgraph GO["Go Core Backend"]
      INC["Active Incident\n(e.g., PAYMENT_CAPTURED_ORDER_PENDING)"] --> DISPATCH["Dispatch Investigation Request\n(POST /ai/investigate)"]
    end

    subgraph PYTHON["Python AI & Memory Service (FastAPI)"]
      DISPATCH --> AGENT["AI Investigation Agent\n(Instructor / Pydantic v2)"]
      
      subgraph PAYPAL_TOOLKIT["Official paypal-agent-toolkit (PyPI)"]
        TOOL_CAP["get_capture_details(capture_id)"]
        TOOL_ORD["get_order_details(order_id)"]
        TOOL_TX["get_transaction_details(tx_id)"]
      end

      AGENT --> PAYPAL_TOOLKIT
      
      subgraph MEMORY["pgvector Memory Layer"]
        EMB["Embedder"]
        VEC_SEARCH["Cosine Similarity Search"]
      end

      AGENT --> EMB --> VEC_SEARCH
      VEC_SEARCH <-->|Top-k Past Resolutions| DB_VEC[("incident_embeddings\nin PostgreSQL")]

      AGENT --> VALIDATE["Strict Schema & Citation Validation"]
      VALIDATE --> RESULT["Validated Structured Output"]
    end

    subgraph LIVE_SANDBOX["Live PayPal Sandbox"]
      PP_API["PayPal API Endpoints"]
    end

    PAYPAL_TOOLKIT <-->|Live Query with Sandbox Credentials| PP_API

    RESULT --> GO_POLICY["Go Deterministic Policy Engine"]
```

---

## 1. Live Authoritative Inspection (PayPal Agent Toolkit)

Rather than writing custom raw HTTP clients or relying on synthetic mocks, the Python AI service imports the official package:

```bash
pip install paypal-agent-toolkit instructor pydantic
```

The agent initializes the toolkit using the environment's PayPal Sandbox credentials:

```python
from paypal_agent_toolkit import PayPalAgentToolkit

toolkit = PayPalAgentToolkit(
    client_id=os.environ["PAYPAL_CLIENT_ID"],
    client_secret=os.environ["PAYPAL_CLIENT_SECRET"],
    environment="sandbox"
)

# Read-only inspection tools made available to the agent:
read_tools = [
    toolkit.get_capture_details,
    toolkit.get_order_details,
    toolkit.get_transaction_details,
    toolkit.get_dispute_details
]
```

### Safety Boundary on Mutations
The toolkit also includes write operations (`refund_capture`, `create_payout`). 
* **Read-only tools** are executed by the agent to collect live evidence.
* **Mutation tools** are NOT executed autonomously by the AI. The AI may only **propose** a typed action, which the Go policy engine must approve and execute.

---

## 2. Memory Layer: Historical Retrieval (Python & pgvector)

The Python service utilizes `pgvector` in PostgreSQL to store embeddings of resolved incidents and their verified remediations. Detailed architecture is in [`memory/01-memory-architecture.md`](file:///d:/PayPal/DelTix/deltix_docs/memory/01-memory-architecture.md).
- **Embedding Generation:** Incident features (type, severity, error pattern, failed services) are vectorized.
- **Retrieval:** Cosine distance query finds the top-3 historically similar resolved incidents.
- **Prompt Injection:** Past successful resolution playbooks are supplied as few-shot memory to guide the model.

---

## 3. Strict AI Output Schema (Pydantic v2)

The AI agent is constrained to return structured data validated with `instructor`:

```python
from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any

class VerifiedFact(BaseModel):
    claim: str = Field(description="Factual statement directly supported by live PayPal or DB evidence")
    evidence_ids: List[str] = Field(description="List of cited evidence IDs supporting the claim")

class Hypothesis(BaseModel):
    claim: str = Field(description="Plausible explanation based on evidence")
    supporting_evidence_ids: List[str]
    limitations: str = Field(description="What remains unproven")

class ActionProposal(BaseModel):
    action_type: Literal[
        "REPROCESS_INTERNAL_ORDER_EVENT",
        "REBUILD_ORDER_PROJECTION",
        "PAUSE_PAYOUT_ROUTE",
        "RESTRICT_CREDENTIAL",
        "NO_ACTION"
    ]
    parameters: Dict[str, Any]
    reason: str
    preconditions: List[str]
    postconditions: List[str]

class InvestigationResult(BaseModel):
    summary: str
    verified_facts: List[VerifiedFact]
    hypotheses: List[Hypothesis]
    unknowns: List[str]
    proposed_action: ActionProposal
```

---

## 4. Guardrails

- Every factual claim must cite valid `evidence_ids`.
- The AI has read-only access via the PayPal Agent Toolkit during investigation.
- If the AI service or PayPal Sandbox API is unavailable, deterministic detection remains unaffected and marks provider status as `UNKNOWN`.
