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

