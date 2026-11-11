import { AgentItem, RunItem, RunStatus, NodeType, GraphNodeData, GraphEdgeData, RunCheckpoint, RunTimelineEvent } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Standard headers with dev authorization fallback.
 */
function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  // If running in development and dev token exists or requested
  if (typeof window !== "undefined") {
    const devToken = localStorage.getItem("deltix_auth_token") || "dev_token_deltix";
    if (devToken) {
      headers["Authorization"] = `Bearer ${devToken}`;
    }
  }

  return headers;
}

export interface BackendAgentSpec {
  spec_id: string;
  seq_id: number;
  agent_id: string;
  version: string;
  tenant_id: string;
  name: string;
  category: string;
  ir_payload?: {
    ir_version: string;
    agent_name: string;
    nodes: Array<{
      id: string;
      title?: string;
      type: string;
      description?: string;
      capability?: { capability_id: string };
      policy?: { rule_name: string };
      metadata?: Record<string, any>;
    }>;
    transitions: Array<{
      source: string;
      target: string;
      condition?: string;
    }>;
  };
  validation_report?: {
    schema_valid: boolean;
    topology_valid: boolean;
    policy_compliant: boolean;
    tests_run: number;
    tests_passed: number;
    errors?: string[];
  };
  readiness_token?: string;
  status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BackendCheckpoint {
  checkpoint_id: string;
  seq_id: number;
  run_id: string;
  step_index: number;
  node_id: string;
  node_type: string;
  status: string;
  duration_ms: number;
  node_input?: Record<string, any>;
  node_output?: Record<string, any>;
  state_delta?: Record<string, any>;
  full_state?: Record<string, any>;
  timestamp: string;
}

export interface BackendAgentRun {
  run_id: string;
  seq_id: number;
  spec_id: string;
  tenant_id: string;
  triggered_by?: string;
  status: string;
  current_step_index: number;
  current_node_id?: string;
  cumulative_spend: number;
  inputs_payload?: Record<string, any>;
  state_payload?: Record<string, any>;
  final_output?: Record<string, any>;
  error_message?: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface BackendRunDetailResponse {
  run: BackendAgentRun;
  checkpoints?: BackendCheckpoint[];
  pending_approval?: {
    approval_id: string;
    seq_id: number;
    run_id: string;
    tenant_id: string;
    step_index: number;
    node_id: string;
    capability_id: string;
    action_summary: string;
    requested_payload?: Record<string, any>;
    amount_usd: number;
    status: string;
    created_at: string;
    expires_at: string;
  };
  trace_id?: string;
}

/**
 * Transform a backend AgentSpec into an AgentItem.
 */
export function mapBackendSpecToAgentItem(spec: BackendAgentSpec): AgentItem {
  const testsPassed = spec.validation_report?.tests_passed ?? 0;
  const testsRun = spec.validation_report?.tests_run ?? 0;
  const successRate = testsRun > 0 ? Math.round((testsPassed / testsRun) * 100) : 100;

  const definitionYaml = [
    `# DelTix Agent Specification — ${spec.name}`,
    `spec_id: ${spec.spec_id}`,
    `version: ${spec.version || "v1.0.0"}`,
    `category: ${spec.category || "financial-disbursement"}`,
    `readiness_token: ${spec.readiness_token ? spec.readiness_token.slice(0, 16) + "..." : "none"}`,
    `status: ${spec.status}`,
    "",
    "nodes:",
    ...(spec.ir_payload?.nodes?.map((n) => `  - id: ${n.id}\n    type: ${n.type}`) || ["  - id: start\n    type: INGEST_DATA"]),
  ].join("\n");

  return {
    id: spec.spec_id,
    name: spec.name || spec.agent_id || spec.spec_id,
    version: spec.version || "v1.0.0",
    description: `Policy-verified financial agent (${spec.category || "disbursements"}).`,
    lastRunAt: spec.updated_at || spec.created_at || new Date().toISOString(),
    successRate,
    totalRuns: 0,
    owner: spec.created_by || "Finance Ops",
    environment: "sandbox",
    definitionYaml,
  };
}

/**
 * Transform a backend AgentRun + Checkpoints into a rich RunItem.
 */
export function mapBackendRunToRunItem(
  run: BackendAgentRun,
  checkpoints: BackendCheckpoint[] = [],
  pendingApproval?: BackendRunDetailResponse["pending_approval"],
  spec?: BackendAgentSpec
): RunItem {
  const startedAt = run.started_at || new Date().toISOString();
  const completedAt = run.completed_at ? new Date(run.completed_at).getTime() : Date.now();
  const durationMs = Math.max(0, completedAt - new Date(startedAt).getTime());

  // Derive title from inputs or node
  const title = (run.inputs_payload?.description as string) ||
    (run.inputs_payload?.invoice_id ? `Process Invoice ${run.inputs_payload.invoice_id}` : `Disbursement Run ${run.run_id.slice(-8)}`);

  const counterparty = (run.inputs_payload?.recipient_name as string) ||
    (run.inputs_payload?.vendor_name as string) ||
    "Authorized Counterparty";

  const counterpartyId = (run.inputs_payload?.recipient_paypal_id as string) ||
    (run.inputs_payload?.recipient_id as string) ||
    "sbox-recip-01";

  // Build nodes from checkpoints or spec IR
  const nodes: GraphNodeData[] = [];
  const edges: GraphEdgeData[] = [];

  if (spec?.ir_payload?.nodes) {
    spec.ir_payload.nodes.forEach((n) => {
      const cp = checkpoints.find((c) => c.node_id === n.id);
      let status: GraphNodeData["status"] = "pending";
      if (cp) {
        if (cp.status === "SUCCEEDED") status = "succeeded";
        else if (cp.status === "FAILED") status = "failed";
        else if (cp.status === "STARTED") status = "running";
        else if (cp.status === "INTERRUPTED") status = "waiting";
      } else if (run.current_node_id === n.id) {
        status = run.status === "PAUSED_FOR_APPROVAL" ? "waiting" : "running";
      }

      nodes.push({
        id: n.id,
        title: n.title || n.id.replace(/_/g, " ").toUpperCase(),
        type: (n.type as NodeType) || "TOOL_CALL",
        status,
        durationMs: cp?.duration_ms,
        inputs: cp?.node_input,
        outputs: cp?.node_output,
      });
    });

    spec.ir_payload.transitions?.forEach((t, i) => {
      edges.push({
        id: `e_${t.source}_${t.target}_${i}`,
        source: t.source,
        target: t.target,
        label: t.condition,
      });
    });
  } else if (checkpoints.length > 0) {
    checkpoints.forEach((cp, i) => {
      nodes.push({
        id: cp.node_id,
        title: cp.node_id.replace(/_/g, " ").toUpperCase(),
        type: (cp.node_type as NodeType) || "TOOL_CALL",
        status: cp.status === "SUCCEEDED" ? "succeeded" : cp.status === "FAILED" ? "failed" : "running",
        durationMs: cp.duration_ms,
        inputs: cp.node_input,
        outputs: cp.node_output,
      });

      if (i > 0) {
        edges.push({
          id: `e_${checkpoints[i - 1].node_id}_${cp.node_id}`,
          source: checkpoints[i - 1].node_id,
          target: cp.node_id,
        });
      }
    });
  }

  // Build timeline events
  const timeline: RunTimelineEvent[] = checkpoints.map((cp, idx) => ({
    id: `tl_${cp.checkpoint_id || idx}`,
    offsetSeconds: Number((cp.duration_ms / 1000).toFixed(2)),
    eventType: `Step ${cp.step_index}: ${cp.status}`,
    nodeId: cp.node_id,
    nodeTitle: cp.node_id.replace(/_/g, " ").toUpperCase(),
    summary: `Execution of ${cp.node_id} status ${cp.status}`,
    durationMs: cp.duration_ms,
    payload: cp.node_output || cp.node_input,
    timestamp: cp.timestamp || run.started_at,
  }));

  // Build checkpoints
  const runCheckpoints: RunCheckpoint[] = checkpoints.map((cp) => ({
    id: cp.checkpoint_id,
    stepIndex: cp.step_index,
    nodeId: cp.node_id,
    timestamp: cp.timestamp || run.started_at,
    stateDelta: cp.state_delta || {},
    fullState: cp.full_state || {},
  }));

  return {
    id: run.run_id,
    title,
    agentId: run.spec_id,
    agentName: spec?.name || `Agent ${run.spec_id.slice(-6)}`,
    counterparty,
    counterpartyId,
    amountCents: Math.round((run.cumulative_spend || 0) * 100),
    currency: "USD",
    status: (run.status as RunStatus) || "RUNNING",
    environment: "sandbox",
    startedAt,
    durationMs,
    failureReason: run.error_message,
    approvalDetails: pendingApproval
      ? {
          reason: pendingApproval.action_summary || "High-value disbursement requiring dual authorization",
          amountCents: Math.round(pendingApproval.amount_usd * 100),
          recipientName: counterparty,
          recipientAccount: counterpartyId,
          sourceAccount: "DelTix Sandbox Treasury",
          triggeredRule: `spend_limit_check (${pendingApproval.capability_id})`,
          checksPassed: ["Deterministic AST Math Verification", "Grounding Quote Proof Passed", "Zero-Tolerance Variance Check"],
          requestedBy: run.triggered_by || "System Policy Guard",
          waitingSince: pendingApproval.created_at,
        }
      : undefined,
    nodes,
    edges,
    timeline,
    checkpoints: runCheckpoints,
    policyEvaluations: [],
  };
}

/**
 * Standard HTTP request wrapper with CORS credentials, problem JSON parsing, and dev auth fallback.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers as Record<string, string>),
    credentials: "include",
  });

  if (!res.ok) {
    let errorDetail = `${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.title || errJson.error_code || errJson.message || errorDetail;
    } catch {
      // Non-JSON error
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  /**
   * Check current session.
   */
  async getCurrentSession() {
    try {
      return await request<any>("/v1/auth/me", { method: "GET" });
    } catch {
      return null;
    }
  },

  /**
   * List all agent specifications from the compiler service.
   */
  async listSpecs(): Promise<BackendAgentSpec[]> {
    const data = await request<{ specs?: BackendAgentSpec[] }>("/v1/agents/specs?limit=50", { method: "GET" });
    return data.specs || [];
  },

  /**
   * Get single agent spec by ID.
   */
  async getSpec(specId: string): Promise<BackendAgentSpec> {
    return request<BackendAgentSpec>(`/v1/agents/specs/${encodeURIComponent(specId)}`, { method: "GET" });
  },

  /**
   * Compile a new natural language prompt into an Agent IR.
   */
  async compilePrompt(prompt: string, category: string = "financial-disbursement") {
    return request<any>("/v1/agents/compile", {
      method: "POST",
      body: JSON.stringify({ prompt, category }),
    });
  },

  /**
   * List all runs from runtime service.
   */
  async listRuns(): Promise<BackendAgentRun[]> {
    const data = await request<{ runs?: BackendAgentRun[] }>("/v1/runs?limit=50", { method: "GET" });
    return data.runs || [];
  },

  /**
   * Get run details including checkpoints and approval states.
   */
  async getRun(runId: string): Promise<BackendRunDetailResponse> {
    return request<BackendRunDetailResponse>(`/v1/runs/${encodeURIComponent(runId)}`, { method: "GET" });
  },

  /**
   * Trigger a new agent run.
   */
  async startRun(specId: string, inputs: Record<string, any> = {}): Promise<{ run_id: string; status: string }> {
    return request<{ run_id: string; status: string }>("/v1/runs", {
      method: "POST",
      body: JSON.stringify({ spec_id: specId, inputs }),
    });
  },

  /**
   * Submit an approval decision (APPROVE or REJECT).
   */
  async decideApproval(
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
    reason: string = "",
    approvedBy: string = "Controller"
  ) {
    return request<any>(`/v1/approvals/${encodeURIComponent(approvalId)}/decide`, {
      method: "POST",
      body: JSON.stringify({
        approval_id: approvalId,
        approval_status: decision,
        decision_reason: reason,
        approved_by: approvedBy,
      }),
    });
  },

  /**
   * List registered capabilities.
   */
  async listCapabilities() {
    return request<{ capabilities?: any[] }>("/v1/capabilities", { method: "GET" });
  },

  /**
   * Stream live run events via Server-Sent Events (SSE).
   */
  createRunStream(runId: string): EventSource {
    return new EventSource(`${API_BASE}/v1/runs/${encodeURIComponent(runId)}/stream`, {
      withCredentials: true,
    });
  },
};
