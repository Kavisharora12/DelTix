import { create } from "zustand";
import { RunItem, RunTimelineEvent, RunStatus, AgentItem } from "@/types";
import {
  api,
  AuthSession,
  BackendAgentRun,
  BackendAgentSpec,
  mapBackendRunToRunItem,
  mapBackendSpecToAgentItem,
} from "./api";

interface DelTixStore {
  // Environment state (sandbox vs live)
  environment: "sandbox" | "live";
  setEnvironment: (env: "sandbox" | "live") => void;

  // Authenticated session & workspace tenant
  session: AuthSession | null;
  authChecked: boolean;
  tenantId: string;
  setTenantId: (id: string) => void;
  refreshSession: () => Promise<AuthSession | null>;
  logout: () => Promise<void>;

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

  // Agent & run management
  retryRunFromCheckpoint: (runId: string) => Promise<void>;

  // Approvals actions
  approveRun: (runId: string, rationale?: string) => Promise<{ success: boolean; signedToken: string }>;
  rejectRun: (runId: string, reason: string) => Promise<{ success: boolean }>;

  // Realtime run streaming
  startRunSimulation: (runId: string) => void;
}

let inFlightInit: Promise<void> | null = null;

export const useDelTixStore = create<DelTixStore>((set, get) => ({
  environment: "sandbox",
  setEnvironment: (env) => set({ environment: env }),

  session: null,
  authChecked: false,
  tenantId: "",
  setTenantId: (id) => set({ tenantId: id }),

  refreshSession: async () => {
    api.syncOAuthCallbackFlag();
    try {
      const session = await api.getCurrentSession();
      set({
        session,
        authChecked: true,
        tenantId: session?.tenant_id || "",
      });
      return session;
    } catch (err) {
      const existing = get().session;
      set({
        authChecked: true,
        error: err instanceof Error ? err.message : "Failed to verify session",
      });
      return existing;
    }
  },

  logout: async () => {
    await api.logout();
    set({
      session: null,
      authChecked: true,
      tenantId: "",
      runs: [],
      agents: [],
      selectedRunId: null,
    });
  },

  runs: [],
  agents: [],
  selectedRunId: null,
  setSelectedRunId: (id) => set({ selectedRunId: id }),

  isLoading: false,
  error: null,
  isStreaming: false,

  init: async () => {
    if (inFlightInit) return inFlightInit;
    // Skip redundant full re-fetches if already initialized for an active session
    if (get().authChecked && get().session && (get().runs.length > 0 || get().agents.length > 0)) {
      return;
    }

    inFlightInit = (async () => {
      set({ isLoading: true, error: null });
      try {
        const session = await get().refreshSession();
        if (!session) {
          set({ runs: [], agents: [], isLoading: false });
          return;
        }
        await Promise.allSettled([get().fetchAgents(), get().fetchRuns()]);
      } catch (err: any) {
        set({ error: err.message || "Failed to initialize DelTix store." });
      } finally {
        set({ isLoading: false });
        inFlightInit = null;
      }
    })();

    return inFlightInit;
  },

  fetchAgents: async () => {
    try {
      const specs = await api.listSpecs();
      const runs = get().runs;
      const agents = specs.map((spec) =>
        mapBackendSpecToAgentItem(spec, runs.filter((r) => r.agentId === spec.spec_id).length)
      );
      set({ agents });
    } catch (err) {
      console.warn("DelTix: Failed to fetch agent specifications.", err);
    }
  },

  fetchRuns: async () => {
    try {
      const rawRuns = await api.listRuns();
      const specs = get().agents;

      // Only hydrate detailed checkpoints/approval for pending approvals or the 8 most recent runs in parallel
      const detailTargets = new Set(
        rawRuns
          .filter((r, idx) => idx < 8 || r.status === "PAUSED_FOR_APPROVAL")
          .map((r) => r.run_id)
      );

      const mappedRuns = await Promise.all(
        rawRuns.map(async (r) => {
          const spec = specs.find((a) => a.id === r.spec_id);
          if (!detailTargets.has(r.run_id)) {
            return mapBackendRunToRunItem(
              r,
              [],
              undefined,
              spec ? ({ spec_id: spec.id, name: spec.name } as any) : undefined
            );
          }
          try {
            const detail = await api.getRun(r.run_id);
            return mapBackendRunToRunItem(
              detail.run,
              detail.checkpoints || [],
              detail.pending_approval,
              spec ? ({ spec_id: spec.id, name: spec.name } as any) : undefined
            );
          } catch {
            return mapBackendRunToRunItem(r, []);
          }
        })
      );

      set((state) => ({
        runs: mappedRuns,
        agents: state.agents.map((a) => ({
          ...a,
          totalRuns: mappedRuns.filter((r) => r.agentId === a.id).length,
        })),
        selectedRunId: state.selectedRunId || (mappedRuns.length > 0 ? mappedRuns[0].id : null),
      }));
    } catch (err) {
      console.warn("DelTix: Failed to fetch runs.", err);
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

  retryRunFromCheckpoint: async (runId: string) => {
    try {
      const detail = await api.getRun(runId);
      const spec = get().agents.find((a) => a.id === detail.run.spec_id);
      const mapped = mapBackendRunToRunItem(detail.run, detail.checkpoints || [], detail.pending_approval, spec as any);
      set((state) => ({
        runs: state.runs.map((r) => (r.id === runId ? mapped : r)),
      }));
    } catch (err) {
      console.error("DelTix: Failed to refresh run from backend:", err);
      throw err;
    }
  },

  approveRun: async (runId, rationale) => {
    const run = get().runs.find((r) => r.id === runId);
    const approvalId = run?.approvalDetails?.approvalId || (run?.approvalDetails as any)?.approval_id || runId;
    const resp = await api.decideApproval(approvalId, "APPROVED", rationale || "Approved via DelTix Console");
    const signedToken = resp?.approval_token || "";
    await get().fetchRunDetails(runId);
    return { success: true, signedToken };
  },

  rejectRun: async (runId, reason) => {
    const run = get().runs.find((r) => r.id === runId);
    const approvalId = run?.approvalDetails?.approvalId || (run?.approvalDetails as any)?.approval_id || runId;
    await api.decideApproval(approvalId, "REJECTED", reason);
    await get().fetchRunDetails(runId);
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
