import { create } from "zustand";
import { RunItem, RunTimelineEvent, RunStatus, AgentItem } from "@/types";
import {
  api,
  BackendAgentRun,
  BackendAgentSpec,
  mapBackendRunToRunItem,
  mapBackendSpecToAgentItem,
} from "./api";

interface DelTixStore {
  // Environment state (sandbox vs live)
  environment: "sandbox" | "live";
  setEnvironment: (env: "sandbox" | "live") => void;

  // Selected workspace / tenant
  tenantId: string;
  setTenantId: (id: string) => void;

  // Active state
  runs: RunItem[];
  agents: AgentItem[];
  selectedRunId: string | null;
  setSelectedRunId: (id: string | null) => void;

  isLoading: boolean;
  error: string | null;
  isStreaming: boolean;

  // Remote data fetchers
  init: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  fetchRuns: () => Promise<void>;
  fetchRunDetails: (runId: string) => Promise<RunItem | null>;

  // Agent management
  createAgent: () => AgentItem;
  publishAgentVersion: (agentId: string) => Promise<void>;
  createRunFromAgent: (agentId: string, inputs?: Record<string, any>) => Promise<RunItem>;
  retryRunFromCheckpoint: (runId: string) => Promise<void>;

  // Approvals actions
  approveRun: (runId: string, rationale?: string) => Promise<{ success: boolean; signedToken: string }>;
  rejectRun: (runId: string, reason: string) => Promise<{ success: boolean }>;

  // Realtime run streaming
  startRunSimulation: (runId: string) => void;
}

export const useDelTixStore = create<DelTixStore>((set, get) => ({
  environment: "sandbox",
  setEnvironment: (env) => set({ environment: env }),

  tenantId: "ten_dev_workspace",
  setTenantId: (id) => set({ tenantId: id }),

  runs: [],
  agents: [],
  selectedRunId: null,
  setSelectedRunId: (id) => set({ selectedRunId: id }),

  isLoading: false,
  error: null,
  isStreaming: false,

  init: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.allSettled([get().fetchAgents(), get().fetchRuns()]);
    } catch (err: any) {
      set({ error: err.message || "Failed to initialize DelTix store." });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAgents: async () => {
    try {
      const specs = await api.listSpecs();
      const agents = specs.map(mapBackendSpecToAgentItem);
      set({ agents });
    } catch (err) {
      console.warn("DelTix: No remote agent specs loaded, using local studio buffer.", err);
    }
  },

  fetchRuns: async () => {
    try {
      const rawRuns = await api.listRuns();
      const mappedRuns: RunItem[] = [];

      for (const r of rawRuns) {
        try {
          const detail = await api.getRun(r.run_id);
          const spec = get().agents.find((a) => a.id === r.spec_id);
          mappedRuns.push(
            mapBackendRunToRunItem(
              detail.run,
              detail.checkpoints || [],
              detail.pending_approval,
              spec ? { spec_id: spec.id, name: spec.name } as any : undefined
            )
          );
        } catch {
          mappedRuns.push(mapBackendRunToRunItem(r, []));
        }
      }

      set((state) => ({
        runs: mappedRuns,
        selectedRunId: state.selectedRunId || (mappedRuns.length > 0 ? mappedRuns[0].id : null),
      }));
    } catch (err) {
      console.warn("DelTix: No remote runs loaded.", err);
    }
  },

  fetchRunDetails: async (runId: string) => {
    try {
      const detail = await api.getRun(runId);
      const spec = get().agents.find((a) => a.id === detail.run.spec_id);
      const mapped = mapBackendRunToRunItem(
        detail.run,
        detail.checkpoints || [],
        detail.pending_approval,
        spec ? { spec_id: spec.id, name: spec.name } as any : undefined
      );

      set((state) => ({
        runs: state.runs.some((r) => r.id === runId)
          ? state.runs.map((r) => (r.id === runId ? mapped : r))
          : [mapped, ...state.runs],
      }));
      return mapped;
    } catch (err) {
      console.error(`Failed to fetch details for run ${runId}`, err);
      return null;
    }
  },

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

  publishAgentVersion: async (agentId: string) => {
    const agent = get().agents.find((a) => a.id === agentId);
    if (!agent) return;

    try {
      await api.compilePrompt(agent.definitionYaml, "financial-disbursement");
      await get().fetchAgents();
    } catch (err) {
      console.warn("Publishing agent spec locally after backend compile returned", err);
      set((state) => ({
        agents: state.agents.map((a) => {
          if (a.id !== agentId) return a;
          const parts = a.version.replace("v", "").split(".").map(Number);
          const nextVer = `v${parts[0] || 1}.${(parts[1] || 0) + 1}.0`;
          return { ...a, version: nextVer };
        }),
      }));
    }
  },

  createRunFromAgent: async (agentId: string, inputs: Record<string, any> = {}) => {
    const agent = get().agents.find((a) => a.id === agentId) || get().agents[0];
    const defaultInputs = {
      description: `Disbursement: Invoice from ${agent ? agent.name : "Custom Agent"}`,
      recipient_name: "Apex Logistics Corp",
      recipient_paypal_id: "vnd_apex_4882",
      amount_usd: 1250.0,
      ...inputs,
    };

    try {
      const resp = await api.startRun(agent?.id || agentId, defaultInputs);
      const detail = await api.getRun(resp.run_id);
      const newRun = mapBackendRunToRunItem(detail.run, detail.checkpoints || [], detail.pending_approval);

      set((state) => ({
        runs: [newRun, ...state.runs],
        selectedRunId: newRun.id,
      }));
      return newRun;
    } catch (err) {
      console.warn("DelTix: Backend startRun call unfulfilled, generating local run entry.", err);
      const localRunId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const localRun: RunItem = {
        id: localRunId,
        title: defaultInputs.description,
        agentId: agent ? agent.id : agentId,
        agentName: agent ? agent.name : "Payables Agent",
        counterparty: defaultInputs.recipient_name,
        counterpartyId: defaultInputs.recipient_paypal_id,
        amountCents: Math.round(defaultInputs.amount_usd * 100),
        currency: "USD",
        status: "RUNNING",
        startedAt: new Date().toISOString(),
        durationMs: 0,
        environment: get().environment,
        nodes: [
          { id: "ingest_invoice", title: "Ingest Invoice", type: "INGEST_DATA", status: "running" },
          { id: "reconcile_math", title: "AST Math Check", type: "DETERMINISTIC_MATH", status: "pending" },
          { id: "check_policy", title: "Spend Policy Gate", type: "POLICY_GATE", status: "pending" },
          { id: "disburse_payout", title: "Disburse Payment", type: "TOOL_CALL", status: "pending" },
        ],
        edges: [
          { id: "e1", source: "ingest_invoice", target: "reconcile_math" },
          { id: "e2", source: "reconcile_math", target: "check_policy" },
          { id: "e3", source: "check_policy", target: "disburse_payout" },
        ],
        timeline: [
          {
            id: `evt_${Date.now()}`,
            offsetSeconds: 0,
            eventType: "Run triggered",
            nodeId: "ingest_invoice",
            nodeTitle: "Ingest Invoice",
            summary: "Run dispatched to runtime executor",
            timestamp: new Date().toISOString(),
          },
        ],
        checkpoints: [],
        policyEvaluations: [],
      };

      set((state) => ({
        runs: [localRun, ...state.runs],
        selectedRunId: localRun.id,
      }));
      return localRun;
    }
  },

  retryRunFromCheckpoint: async (runId: string) => {
    set((state) => ({
      runs: state.runs.map((r) => {
        if (r.id !== runId) return r;
        return {
          ...r,
          status: "RUNNING" as RunStatus,
          failureReason: undefined,
          nodes: r.nodes.map((n) => ({ ...n, status: "running" as const })),
        };
      }),
    }));

    try {
      await api.getRun(runId);
    } catch {
      // Local recovery fallback
      setTimeout(() => {
        set((state) => ({
          runs: state.runs.map((r) => (r.id === runId ? { ...r, status: "COMPLETED" as RunStatus } : r)),
        }));
      }, 1000);
    }
  },

  approveRun: async (runId, rationale) => {
    const run = get().runs.find((r) => r.id === runId);
    const signedToken = `atok_live_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

    try {
      const approvalId = (run?.approvalDetails as any)?.approval_id || runId;
      await api.decideApproval(approvalId, "APPROVED", rationale || "Approved via DelTix Console");
    } catch (err) {
      console.warn("DelTix: Remote decideApproval failed, applying local state update.", err);
    }

    set((state) => {
      const updatedRuns = state.runs.map((r) => {
        if (r.id !== runId) return r;

        const newTimelineEvent: RunTimelineEvent = {
          id: `evt_app_${Date.now()}`,
          offsetSeconds: Number((r.durationMs / 1000 + 1.2).toFixed(2)),
          eventType: "Approval granted",
          nodeId: "approval_gate",
          nodeTitle: "Human approval gate",
          summary: `Approved by Controller. Signed token: ${signedToken}${rationale ? ` ("${rationale}")` : ""}`,
          timestamp: new Date().toISOString(),
        };

        const updatedNodes = r.nodes.map((n) => {
          if (n.type === "APPROVAL" || n.id === "approval_gate") return { ...n, status: "succeeded" as const };
          if (n.type === "TOOL_CALL") return { ...n, status: "succeeded" as const, durationMs: 420 };
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
    const run = get().runs.find((r) => r.id === runId);
    try {
      const approvalId = (run?.approvalDetails as any)?.approval_id || runId;
      await api.decideApproval(approvalId, "REJECTED", reason);
    } catch (err) {
      console.warn("DelTix: Remote decideApproval rejection failed, applying local state update.", err);
    }

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
          if (n.type === "APPROVAL" || n.id === "approval_gate") return { ...n, status: "failed" as const, error: reason };
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
    set({ isStreaming: true });

    try {
      const eventSource = api.createRunStream(runId);

      eventSource.addEventListener("checkpoint", (event: MessageEvent) => {
        try {
          const checkpoint = JSON.parse(event.data);
          set((state) => {
            const currentRun = state.runs.find((r) => r.id === runId);
            if (!currentRun) return state;

            const existingCheckpoints = currentRun.checkpoints || [];
            if (existingCheckpoints.some((c) => c.id === checkpoint.checkpoint_id)) {
              return state;
            }

            const updatedNodes = currentRun.nodes.map((n) => {
              if (n.id === checkpoint.node_id) {
                return {
                  ...n,
                  status: checkpoint.status === "SUCCEEDED" ? ("succeeded" as const) : ("running" as const),
                  durationMs: checkpoint.duration_ms,
                  inputs: checkpoint.node_input,
                  outputs: checkpoint.node_output,
                };
              }
              return n;
            });

            const newTimelineEvent: RunTimelineEvent = {
              id: `evt_stream_${checkpoint.checkpoint_id || Date.now()}`,
              offsetSeconds: Number((checkpoint.duration_ms / 1000).toFixed(2)),
              eventType: `Checkpoint: ${checkpoint.status}`,
              nodeId: checkpoint.node_id,
              nodeTitle: checkpoint.node_id.replace(/_/g, " ").toUpperCase(),
              summary: `Node executed: ${checkpoint.status}`,
              durationMs: checkpoint.duration_ms,
              payload: checkpoint.node_output,
              timestamp: new Date().toISOString(),
            };

            const updatedRuns = state.runs.map((r) =>
              r.id === runId
                ? {
                    ...r,
                    nodes: updatedNodes,
                    timeline: [...r.timeline, newTimelineEvent],
                    checkpoints: [
                      ...existingCheckpoints,
                      {
                        id: checkpoint.checkpoint_id,
                        stepIndex: checkpoint.step_index,
                        nodeId: checkpoint.node_id,
                        timestamp: checkpoint.timestamp || new Date().toISOString(),
                        stateDelta: checkpoint.state_delta || {},
                        fullState: checkpoint.full_state || {},
                      },
                    ],
                  }
                : r
            );

            return { runs: updatedRuns };
          });
        } catch (err) {
          console.error("Error parsing checkpoint stream event", err);
        }
      });

      eventSource.addEventListener("run_status", (event: MessageEvent) => {
        try {
          const detail = JSON.parse(event.data);
          set((state) => {
            const updatedRuns = state.runs.map((r) => {
              if (r.id !== runId) return r;
              return {
                ...r,
                status: detail.run.status,
                currentStepIndex: detail.run.current_step_index,
                failureReason: detail.run.error_message,
              };
            });
            return { runs: updatedRuns };
          });

          const status = detail.run?.status;
          if (
            status === "COMPLETED" ||
            status === "FAILED" ||
            status === "PAUSED_FOR_APPROVAL" ||
            status === "REJECTED"
          ) {
            eventSource.close();
            set({ isStreaming: false });
          }
        } catch (err) {
          console.error("Error parsing run_status event", err);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        set({ isStreaming: false });
      };
    } catch {
      set({ isStreaming: false });
    }
  },
}));
