# DelTix Frontend — Component Architecture & Master Client Documentation

**Status:** Complete Frontend Specification Suite  
**Scope:** Covers all user-facing screens and live backend microservices.

---

## 📖 Master Client User Guide (`docs.md`)

👉 **[`docs.md`](./docs.md)** — **The Complete End-User Product Manual & UI Component Guide.**  
Contains the full screen-by-screen client walkthrough:
1. **Public Landing Page (`/`):** Live guardrail demo widget, value props, Google OAuth workspace login.
2. **Main Dashboard (`/dashboard`):** Financial KPI cards, recent runs table, pending approval badges.
3. **Agent Compiler Studio (`/studio/new`):** Natural language prompt box, spend cap sliders, pre-flight test scorecards, and the **Interactive Clarification Drawer**.
4. **Live Agent Sandbox & Chatbot (`/sandbox`):** Conversational chat terminal, live Server-Sent Events (SSE) execution stepper, Python Decimal AST math badges (`DETERMINISTIC_MATH`), and grounding citation badges.
5. **Human Approval Gate Modal (`/approvals`):** Non-blocking financial mutation gate, spend meters, and 1-click Approve / Reject decision actions.
6. **Financial Audit & Compliance Ledger (`/audit`):** Searchable cursor-paginated transaction table, SHA-256 cryptographic verifier, and tenant Mem0 memory explorer with automated PII masking.
7. **4-Step Client Quick-Start Guide:** Zero-to-production onboarding flow for new users.

---

## Existing Component Implementation Specifications

- **[`01-landing-and-auth.md`](./01-landing-and-auth.md)** — Public Landing Page, 7-Guardrail Interactive Showcase, and Google OAuth Workspace Authentication with Redis CSRF verification.
- **[`02-agent-compiler-studio.md`](./02-agent-compiler-studio.md)** — Prompt-to-`AgentIR` Compiler Studio, Missing Guardrail Clarification Drawer, Validation Scorecard, 3 Pre-Flight Mock Test Results, and Visual Graph Inspector.
- **[`03-agent-specs-library.md`](./03-agent-specs-library.md)** — Compiled Agent Specifications Catalog (`seq_id` Cursor Paginated), HMAC Readiness Token Verification Modal, and Agent Lifecycle Controls.
