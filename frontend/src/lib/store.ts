import { create } from "zustand";
import { RunItem, RunTimelineEvent, RunStatus, AgentItem } from "@/types";
import { MOCK_RUNS, MOCK_AGENTS } from "./mock-data";

interface DelTixStore {
  // Environment state (sandbox vs live)
  environment: "sandbox" | "live";
  setEnvironment: (env: "sandbox" | "live") => void;

  // Selected workspace / tenant
  tenantId: string;
  setTenantId: (id: string) => void;

  // Current active runs list
  runs: RunItem[];
  agents: AgentItem[];
  selectedRunId: string | null;
  setSelectedRunId: (id: string | null) => void;

  // Agent management
  createAgent: () => AgentItem;
  publishAgentVersion: (agentId: string) => void;
  createRunFromAgent: (agentId: string) => RunItem;
  retryRunFromCheckpoint: (runId: string) => void;

  // Approvals actions
  approveRun: (runId: string, rationale?: string) => Promise<{ success: boolean; signedToken: string }>;
  rejectRun: (runId: string, reason: string) => Promise<{ success: boolean }>;

  // Realtime simulation
  startRunSimulation: (runId: string) => void;
  isStreaming: boolean;
}

export const useDelTixStore = create<DelTixStore>((set, get) => ({
  environment: "sandbox",
  setEnvironment: (env) => set({ environment: env }),

  tenantId: "org_prod_442",
  setTenantId: (id) => set({ tenantId: id }),

  runs: MOCK_RUNS,
  agents: MOCK_AGENTS,
  selectedRunId: "run_01J9A8Z1M4E3Q8H6R2",
  setSelectedRunId: (id) => set({ selectedRunId: id }),

  isStreaming: false,

  createAgent: () => {
    const newId = `agent_${Date.now()}`;
    const newAgent: AgentItem = {
      id: newId,
      name: `custom-payout-agent-${newId.slice(-4)}`,
      version: "v1.0.0",
      description: "Custom user-authored financial workflow with deterministic AST verification.",
      lastRunAt: new Date().toISOString(),
      successRate: 100,
      totalRuns: 0,
      owner: "Finance Ops",
      environment: get().environment,
      definitionYaml: `name: custom-payout-agent
version: 1.0.0
entrypoint: ingest_invoice
nodes:
  - id: ingest_invoice
    type: INGEST_DATA
    source: raw_invoice_payload
    next: reconcile_math
  - id: reconcile_math
    type: DETERMINISTIC_MATH
    expression: "round(sum(line_items.amount), 2)"
    next: check_policy
  - id: check_policy
    type: POLICY_GATE
    rules:
      - "amount_usd <= max_budget_usd"
    on_exceed: require_human_approval
    next: disburse_payout
  - id: require_human_approval
    type: APPROVAL
    timeout_minutes: 1440
    next: disburse_payout
  - id: disburse_payout
    type: TOOL_CALL
    tool: paypal.batch_payout
`,
    };
    set((state) => ({
      agents: [newAgent, ...state.agents],
    }));
    return newAgent;
  },

  publishAgentVersion: (agentId: string) => {
    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.id !== agentId) return a;
        const parts = a.version.replace("v", "").split(".").map(Number);
        const nextVer = `v${parts[0] || 1}.${(parts[1] || 0) + 1}.0`;
        return { ...a, version: nextVer };
      }),
    }));
  },

  createRunFromAgent: (agentId: string) => {
    const agent = get().agents.find((a) => a.id === agentId) || get().agents[0];
    const newRunId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRun: RunItem = {
      id: newRunId,
      title: `Disbursement: Invoice from ${agent.name}`,
      agentId: agent.id,
      agentName: agent.name,
      counterparty: "Apex Logistics Corp",
      counterpartyId: "vnd_apex_4882",
      amountCents: 125000,
      currency: "USD",
      status: "PAUSED_FOR_APPROVAL",
      startedAt: new Date().toISOString(),
      durationMs: 1420,
      environment: get().environment,
      approvalDetails: {
        reason: "Amount exceeds per-payment limit of $500.00",
        amountCents: 125000,
        recipientName: "Apex Logistics Corp",
        recipientAccount: "pp:APEX-CORP-4882",
        sourceAccount: "Operating account ending 4417",
        triggeredRule: "amount_usd > max_budget_usd (1250.00 > 500.00)",
        checksPassed: [
          "3 of 3 invoice line items match document quotes",
          "Total computed via deterministic AST Decimals ($1,250.00)",
          "Counterparty is on approved vendor allowlist",
          "Idempotency key verified: no duplicate payment detected",
        ],
        waitingSince: "Just now",
        requestedBy: "Automated Agent Ingestion",
      },
      nodes: [
        { id: "ingest_invoice", title: "Ingest Invoice", type: "INGEST_DATA", status: "succeeded", durationMs: 210, tokensUsed: 142 },
        {
          id: "reconcile_math",
          title: "AST Math Check",
          type: "DETERMINISTIC_MATH",
          status: "succeeded",
          durationMs: 18,
          mathProof: {
            expression: "round(Decimal('450.00') + Decimal('600.00') + Decimal('200.00'), 2)",
            variables: { "item_1": "450.00", "item_2": "600.00", "item_3": "200.00" },
            exactDecimalResult: "1250.00",
            verified: true,
          },
        },
        {
          id: "verify_grounding",
          title: "Grounding Verifier",
          type: "GROUNDING_VERIFIER",
          status: "succeeded",
          durationMs: 340,
          groundingProof: {
            sourceQuote: "PO-99128 matched against vendor master catalog",
            targetMatch: "$1,250.00 to pp:APEX-CORP-4882",
            confidence: 0.999,
            matchPassed: true,
          },
        },
        { id: "check_policy", title: "Spend Policy Gate", type: "POLICY_GATE", status: "waiting", durationMs: 45, policyExpression: "amount_usd (1250.00) > max_budget_usd (500.00)" },
        { id: "approval_gate", title: "Human Approval", type: "APPROVAL", status: "waiting" },
        { id: "paypal_disburse", title: "Disburse Payment", type: "TOOL_CALL", status: "pending" },
      ],
      edges: [
        { id: "e1-2", source: "ingest_invoice", target: "reconcile_math" },
        { id: "e2-3", source: "reconcile_math", target: "verify_grounding" },
        { id: "e3-4", source: "verify_grounding", target: "check_policy" },
        { id: "e4-5", source: "check_policy", target: "approval_gate" },
        { id: "e5-6", source: "approval_gate", target: "paypal_disburse" },
      ],
      timeline: [
        { id: "e1", offsetSeconds: 0.1, eventType: "Run initiated", nodeId: "ingest_invoice", nodeTitle: "Ingest Invoice", summary: "Loaded invoice payload #INV-20418", timestamp: new Date().toISOString() },
        { id: "e2", offsetSeconds: 0.35, eventType: "Math verified", nodeId: "reconcile_math", nodeTitle: "AST Math Check", summary: "Sum verified exactly ($1,250.00)", timestamp: new Date().toISOString() },
        { id: "e3", offsetSeconds: 0.72, eventType: "Policy triggered", nodeId: "check_policy", nodeTitle: "Spend Policy Gate", summary: "Paused: amount exceeds $500 cap", timestamp: new Date().toISOString() },
      ],
      checkpoints: [
        { id: "cp_1", stepIndex: 1, nodeId: "ingest_invoice", timestamp: new Date().toISOString(), fullState: { amount: 1250, vendor: "Apex Logistics Corp" }, stateDelta: { amount: 1250 } },
        { id: "cp_2", stepIndex: 2, nodeId: "reconcile_math", timestamp: new Date().toISOString(), fullState: { amount: 1250, verified: true }, stateDelta: { verified: true } },
      ],
      policyEvaluations: [
        { id: "pol_ev_1", ruleName: "max_budget_per_payment", expression: "amount_usd <= 500.00", result: "needs_approval", evaluatedAt: "1s ago", inputValue: "$1,250.00" },
        { id: "pol_ev_2", ruleName: "approved_vendor_list", expression: "vendor_id in allowed_vendors", result: "passed", evaluatedAt: "1s ago", inputValue: "Apex Logistics Corp" },
      ],
    };

    set((state) => ({
      runs: [newRun, ...state.runs],
      selectedRunId: newRunId,
    }));
    return newRun;
  },

  retryRunFromCheckpoint: (runId: string) => {
    set((state) => ({
      runs: state.runs.map((r) => {
        if (r.id !== runId) return r;
        return {
          ...r,
          status: "RUNNING" as RunStatus,
          failureReason: undefined,
          nodes: r.nodes.map((n, i) => i >= r.nodes.length - 2 ? { ...n, status: "running" as const } : n),
        };
      }),
    }));
    setTimeout(() => {
      set((state) => ({
        runs: state.runs.map((r) => {
          if (r.id !== runId) return r;
          return {
            ...r,
            status: "COMPLETED" as RunStatus,
            nodes: r.nodes.map((n) => ({ ...n, status: "succeeded" as const })),
          };
        }),
      }));
    }, 1500);
  },

  approveRun: async (runId, rationale) => {
    // Generate deterministic HMAC signature token per architecture spec
    const signedToken = `atok_live_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

    set((state) => {
      const updatedRuns = state.runs.map((r) => {
        if (r.id !== runId) return r;

        // Add timeline event for HMAC approval
        const newTimelineEvent: RunTimelineEvent = {
          id: `evt_app_${Date.now()}`,
          offsetSeconds: Number((r.durationMs / 1000 + 1.2).toFixed(2)),
          eventType: "Approval granted",
          nodeId: "approval_gate",
          nodeTitle: "Human approval gate",
          summary: `Approved by Controller. Signed token: ${signedToken}${rationale ? ` ("${rationale}")` : ""}`,
          timestamp: new Date().toISOString(),
        };

        // Update nodes: approval gate succeeded, tool call disburse completed
        const updatedNodes = r.nodes.map((n) => {
          if (n.id === "approval_gate") return { ...n, status: "succeeded" as const };
          if (n.id === "paypal_disburse") return { ...n, status: "succeeded" as const, durationMs: 420 };
          return n;
        });

        return {
          ...r,
          status: "COMPLETED" as RunStatus,
          approvalDetails: r.approvalDetails
            ? { ...r.approvalDetails, signedToken }
            : undefined,
          timeline: [...r.timeline, newTimelineEvent],
          nodes: updatedNodes,
        };
      });

      return { runs: updatedRuns };
    });

    return { success: true, signedToken };
  },

  rejectRun: async (runId, reason) => {
    set((state) => {
      const updatedRuns = state.runs.map((r) => {
        if (r.id !== runId) return r;

        const newTimelineEvent: RunTimelineEvent = {
          id: `evt_rej_${Date.now()}`,
          offsetSeconds: Number((r.durationMs / 1000 + 0.8).toFixed(2)),
          eventType: "Run rejected",
          nodeId: "approval_gate",
          nodeTitle: "Human approval gate",
          summary: `Rejected by Controller: ${reason}`,
          timestamp: new Date().toISOString(),
        };

        const updatedNodes = r.nodes.map((n) => {
          if (n.id === "approval_gate") return { ...n, status: "failed" as const, error: reason };
          return n;
        });

        return {
          ...r,
          status: "REJECTED" as RunStatus,
          failureReason: `Manual rejection: ${reason}`,
          timeline: [...r.timeline, newTimelineEvent],
          nodes: updatedNodes,
        };
      });

      return { runs: updatedRuns };
    });

    return { success: true };
  },

  startRunSimulation: (runId) => {
    // Simulate real-time streaming updates
    set({ isStreaming: true });

    let step = 0;
    const interval = setInterval(() => {
      step++;
      set((state) => {
        const run = state.runs.find((r) => r.id === runId);
        if (!run) {
          clearInterval(interval);
          return { isStreaming: false };
        }

        if (step > 4) {
          clearInterval(interval);
          return { isStreaming: false };
        }

        // Advance a running node to completed
        const updatedNodes = run.nodes.map((n, idx) => {
          if (idx === step && n.status === "running") {
            return { ...n, status: "succeeded" as const };
          }
          if (idx === step + 1 && n.status === "pending") {
            return { ...n, status: "running" as const };
          }
          return n;
        });

        const updatedRuns = state.runs.map((r) =>
          r.id === runId ? { ...r, nodes: updatedNodes } : r
        );

        return { runs: updatedRuns };
      });
    }, 1500);
  },
}));

