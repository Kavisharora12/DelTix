# System Overview

## 1. High-Level Architecture (Microservices in Docker Swarm with PayPal Agent Toolkit & Mem0)

DELTIX is organized as a streamlined microservices system orchestrated via **Docker Swarm**, integrating directly with live PayPal Sandbox APIs using the official **PayPal Agent Toolkit** and managing episodic memory with the open-source **Mem0** engine.

```mermaid
flowchart LR
    subgraph SOURCES["Event Sources"]
      PP_HOOK["PayPal Sandbox Webhooks"]
      APP["Internal Merchant Order Events"]
    end

    subgraph INGRESS["Ingress & Routing (Port 80/443)"]
      PROXY["Traefik / Nginx Reverse Proxy"]
    end

    subgraph SWARM["Docker Swarm Cluster (Overlay Network: deltix-net)"]
      SVC_INGEST["1. deltix-ingestion (Go)\n- Webhook & HMAC Verification\n- Redis Dedup Cache\n- Persist Raw source_events"]
      
      SVC_CORE["2. deltix-core (Go)\n- Event Normalization & Correlation\n- Deterministic Incident Detection\n- Policy Engine & Action Executor\n- Verifier & Append-Only Audit"]
      
      SVC_AI["3. deltix-ai-agent (Python / FastAPI)\n- Official paypal-agent-toolkit\n- Mem0 Engine (mem0ai)\n- Pydantic v2 & Instructor\n- Working & Episodic Memory"]

      REDIS[("Redis Cache / Dedup / Locks\n& Mem0 Query Cache")]
      PG[("PostgreSQL + pgvector\n(incidents, source_events, incident_memories)")]
    end

    subgraph PAYPAL["PayPal Sandbox (Live External APIs)"]
      PP_API["PayPal Sandbox APIs\n(Captures, Orders, Disputes)"]
    end

    HUMAN["Operator Approval Interface / API"]

    PP_HOOK --> PROXY
    APP --> PROXY

    PROXY -->|/v1/webhooks, /v1/events| SVC_INGEST
    PROXY -->|/v1/incidents, /v1/actions| SVC_CORE

    SVC_INGEST --> REDIS
    SVC_INGEST --> PG
    
    PG --> SVC_CORE
    REDIS --> SVC_CORE
    
    SVC_CORE <-->|HTTP /ai/investigate| SVC_AI
    PG <-->|Mem0 pgvector Search| SVC_AI
    REDIS <-->|Mem0 Query Cache| SVC_AI

    SVC_AI <-->|Live Inspection via paypal-agent-toolkit| PP_API

    SVC_CORE -->|Low-Risk Action Execution| PG
    SVC_CORE -->|High-Risk Action| HUMAN
    HUMAN -->|Approved Action Token| SVC_CORE
```

## 2. Microservice Boundaries

1. **`deltix-ingestion` (Go):** Publicly accessible webhook receiver. Dedicated to signature verification, Redis deduplication (`SETNX`), and atomic writes to `source_events`. Isolated so inbound traffic spikes cannot starve core recovery processing.
2. **`deltix-core` (Go):** The primary engine and state machine. Normalizes raw events, correlates by exact business keys, evaluates deterministic detection rules, and manages incident lifecycles. Enforces policy allowlists, executes safe internal actions, verifies postconditions, and maintains the append-only audit log.
3. **`deltix-ai-agent` (Python / FastAPI):** Handles AI investigation. Mounts the official `paypal-agent-toolkit` to perform live read-only inspection against PayPal Sandbox, invokes **Mem0** (`mem0ai`) over PostgreSQL `pgvector` to retrieve verified past incident resolutions, runs LLM reasoning with strict Pydantic schemas, and returns verified facts citing evidence IDs.

## 3. Storage & Infrastructure Layer

- **PostgreSQL + pgvector:** Durable system-of-record. Houses `source_events`, `normalized_events`, `incidents`, `evidence_items`, `audit_entries`, and `incident_memories` (managed by Mem0 with HNSW cosine distance index). Enforces indexed offset pagination for high-speed cursor queries.
- **Redis (7-Alpine):** In-memory sub-millisecond deduplication, distributed worker locking (`Redlock`), and Mem0 query caching (`mem0:query:*`).
- **Docker Swarm:** Overlay network (`deltix-net`), internal DNS resolution, secret distribution (`/run/secrets/*`), resource quotas, and zero-downtime rolling updates.
