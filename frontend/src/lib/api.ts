import { AgentItem, RunItem, RunStatus, NodeType, GraphNodeData, GraphEdgeData, RunCheckpoint, RunTimelineEvent } from "@/types";

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return "/api/gateway";
  }
  return process.env.API_GATEWAY_INTERNAL_URL || "http://localhost:8080";
}

/**
 * Standard headers with dev authorization fallback.
 */
export interface AuthSession {
  session_id: string;
  user_id: string;
  tenant_id: string;
  email: string;
  name: string;
  picture?: string;
  created_at?: string;
  expires_at?: string;
}

const AUTH_MODE_KEY = "deltix_auth_mode";
const AUTH_TOKEN_KEY = "deltix_auth_token";
const TENANT_ID_KEY = "deltix_tenant_id";
const USER_ID_KEY = "deltix_user_id";

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  // Only attach dev bearer headers when the user explicitly activated Dev Sandbox mode.
  // Google OAuth relies on the HttpOnly `deltix_session` cookie via `credentials: "include"`.
  if (typeof window !== "undefined" && localStorage.getItem(AUTH_MODE_KEY) === "dev") {
    const devToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (devToken) {
      headers["Authorization"] = `Bearer ${devToken}`;
    }
    const tenantId = localStorage.getItem(TENANT_ID_KEY);
    if (tenantId) {
      headers["X-Tenant-ID"] = tenantId;
    }
    const userId = localStorage.getItem(USER_ID_KEY);
    if (userId) {
      headers["X-User-ID"] = userId;
    }
  }

  return headers;
}

export interface BackendNode {
  id: string;
  title?: string;
  type: string;
  payload?: {
    capability_id?: string;
    expression?: string;
    target_variable?: string;
    [key: string]: any;
  };
  description?: string;
  capability?: { capability_id: string };
  policy?: { rule_name: string };
  metadata?: Record<string, any>;
}

export interface BackendTransition {
  source?: string;
  target?: string;
  from_node?: string;
  to_node?: string;
  condition?: string;
}

export interface BackendAgentIR {
  schema?: string;
  ir_version: string;
  agent_id: string;
  tenant_id: string;
  metadata?: {
    name: string;
    description?: string;
    category?: string;
  };
  nodes: BackendNode[];
  transitions: BackendTransition[];
  capabilities?: Array<{
    capability_id: string;
    version?: string;
    is_mutation?: boolean;
    is_sensitive?: boolean;
    allowed_actions?: string[];
  }>;
  policies?: {
    max_budget_usd?: number;
    human_approval_threshold_usd?: number;
    require_human_approval?: boolean;
    allowed_capabilities?: string[];
    approval_triggers?: string[];
    forbidden_actions?: string[];
    read_only?: boolean;
  };
  execution_limits?: {
    max_steps?: number;
    timeout_seconds?: number;
    max_loop_iterations?: number;
    max_consecutive_errors?: number;
  };
}

export interface BackendAgentSpec {
  spec_id: string;
  seq_id: number;
  agent_id: string;
  version: string;
  tenant_id: string;
  name: string;
  category: string;
  agent_ir?: BackendAgentIR;
  ir_payload?: BackendAgentIR;
  validation_report?: {
    schema_valid: boolean;
    topology_valid: boolean;
    capabilities_resolved?: string[];
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
  seq_id?: number;
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
  state_snapshot?: Record<string, any>;
  timestamp?: string;
  created_at?: string;
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

export interface CompilePromptRequest {
  name: string;
  category?: string;
  natural_language_prompt: string;
  clarifications?: Record<string, string>;
}

export interface ClarificationQuestion {
  field: string;
  question: string;
  why_required: string;
  suggestions?: string[];
}

export interface SyntheticTestResult {
  scenario_name: string;
  passed: boolean;
  steps_visited: number;
  detail: string;
}

export interface CompilePromptResponse {
  status: "CLARIFICATION_REQUIRED" | "FAILED_VALIDATION" | "READY";
  spec_id?: string;
  agent_id?: string;
  version?: string;
  clarification_questions?: ClarificationQuestion[];
  agent_ir?: any;
  validation_report?: {
    schema_valid: boolean;
    topology_valid: boolean;
    capabilities_resolved?: string[];
    policy_compliant: boolean;
    tests_run: number;
    tests_passed: number;
    errors?: string[];
  };
  synthetic_tests?: SyntheticTestResult[];
  readiness_token?: string;
  trace_id?: string;
}

/**
 * Transform a backend AgentSpec into an AgentItem.
 */
export function mapBackendSpecToAgentItem(spec: BackendAgentSpec, totalRuns: number = 0): AgentItem {
  const testsPassed = spec.validation_report?.tests_passed ?? 0;
  const testsRun = spec.validation_report?.tests_run ?? 0;
  const successRate = testsRun > 0 ? Math.round((testsPassed / testsRun) * 100) : 100;

  const rawNodes = spec.agent_ir?.nodes || spec.ir_payload?.nodes || [];
  const definitionYaml = [
    `# DelTix Agent Specification — ${spec.name}`,
    `spec_id: ${spec.spec_id}`,
    `version: ${spec.version || "v1.0.0"}`,
    `category: ${spec.category || "financial-disbursement"}`,
    `readiness_token: ${spec.readiness_token ? spec.readiness_token.slice(0, 16) + "..." : "none"}`,
    `status: ${spec.status}`,
    "",
    "nodes:",
    ...(rawNodes.length > 0
      ? rawNodes.map((n) => `  - id: ${n.id}\n    type: ${n.type}`)
      : []),
  ].join("\n");

  return {
    id: spec.spec_id,
    name: spec.name || spec.agent_id || spec.spec_id,
    version: spec.version || "v1.0.0",
    description: `Policy-verified financial agent (${spec.category || "disbursements"}).`,
    lastRunAt: spec.updated_at || spec.created_at || new Date().toISOString(),
    successRate,
    totalRuns,
    owner: spec.created_by || "Workspace Operator",
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
    (run.inputs_payload?.customer_email as string) ||
    "Unspecified";

  const counterpartyId = (run.inputs_payload?.recipient_paypal_id as string) ||
    (run.inputs_payload?.recipient_id as string) ||
    (run.inputs_payload?.customer_email as string) ||
    "—";

  // Build nodes from spec IR or checkpoints
  const nodes: GraphNodeData[] = [];
  const edges: GraphEdgeData[] = [];

  const rawNodes = spec?.agent_ir?.nodes || spec?.ir_payload?.nodes;
  const rawTransitions = spec?.agent_ir?.transitions || spec?.ir_payload?.transitions;

  if (rawNodes && rawNodes.length > 0) {
    rawNodes.forEach((n) => {
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

    rawTransitions?.forEach((t, i) => {
      const source = t.source || t.from_node || "";
      const target = t.target || t.to_node || "";
      if (source && target) {
        edges.push({
          id: `e_${source}_${target}_${i}`,
          source,
          target,
          label: t.condition,
        });
      }
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
    timestamp: cp.timestamp || cp.created_at || run.started_at,
  }));

  // Build checkpoints
  const runCheckpoints: RunCheckpoint[] = checkpoints.map((cp) => ({
    id: cp.checkpoint_id,
    stepIndex: cp.step_index,
    nodeId: cp.node_id,
    timestamp: cp.timestamp || cp.created_at || run.started_at,
    stateDelta: cp.state_delta || {},
    fullState: cp.full_state || cp.state_snapshot || {},
  }));

  const settledUSD = Number(run.cumulative_spend || 0);
  const requestedUSD = Number(
    pendingApproval?.amount_usd ?? run.inputs_payload?.amount_usd ?? 0
  );
  const effectiveUSD = settledUSD > 0 ? settledUSD : requestedUSD;

  const succeededChecks = checkpoints
    .filter((cp) => cp.status === "SUCCEEDED")
    .map((cp) => `${cp.node_id} (${cp.node_type})`);

  return {
    id: run.run_id,
    title,
    agentId: run.spec_id,
    agentName: spec?.name || `Agent ${run.spec_id.slice(-6)}`,
    counterparty,
    counterpartyId,
    amountCents: Math.round(effectiveUSD * 100),
    settledCents: Math.round(settledUSD * 100),
    currency: "USD",
    status: (run.status as RunStatus) || "RUNNING",
    environment: "sandbox",
    startedAt,
    durationMs,
    failureReason: run.error_message,
    approvalDetails: pendingApproval
      ? {
          approvalId: pendingApproval.approval_id,
          capabilityId: pendingApproval.capability_id,
          requestedPayload: pendingApproval.requested_payload,
          reason: pendingApproval.action_summary || "Human approval required before execution continues.",
          amountCents: Math.round((Number(pendingApproval.amount_usd || 0) || requestedUSD) * 100),
          recipientName: counterparty,
          recipientAccount: counterpartyId,
          sourceAccount: (run.inputs_payload?.source_account as string) || "PayPal Sandbox",
          triggeredRule: `${pendingApproval.capability_id || "policy_gate"} (node: ${pendingApproval.node_id})`,
          checksPassed: succeededChecks,
          requestedBy: run.triggered_by || "Runtime Policy Guard",
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
  const url = `${getApiBase()}${endpoint}`;
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
   * Clear stale dev auth overrides after a browser Google OAuth callback redirect (?auth=google).
   */
  syncOAuthCallbackFlag() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "google") {
      localStorage.removeItem(AUTH_MODE_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(TENANT_ID_KEY);
      localStorage.removeItem(USER_ID_KEY);
    }
  },

  /**
   * Check current session against API Gateway (cookie or explicit dev bearer token).
   */
  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const data = await request<{ session?: AuthSession } | AuthSession>("/v1/auth/me", { method: "GET" });
      const sess = (data as { session?: AuthSession })?.session ?? (data as AuthSession);
      if (sess && (sess.session_id || sess.user_id || sess.email)) {
        return sess;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Request the Google OAuth consent redirect URL for the selected workspace tenant.
   */
  async getGoogleLoginUrl(tenantId: string): Promise<string> {
    const cleanTenant = tenantId.trim();
    if (!cleanTenant) {
      throw new Error("Workspace / Tenant ID is required.");
    }
    const data = await request<{ auth_url?: string }>(
      `/v1/auth/google/login?tenant_id=${encodeURIComponent(cleanTenant)}`,
      { method: "GET" }
    );
    if (!data?.auth_url) {
      throw new Error("API Gateway did not return an OAuth authorization URL.");
    }
    return data.auth_url;
  },

  /**
   * Explicitly opt into the Developer Sandbox workspace when allowed by gateway config.
   */
  async enableDevSession(tenantId: string = "ten_dev_workspace"): Promise<AuthSession> {
    if (typeof window === "undefined") {
      throw new Error("Dev session cannot be enabled on the server.");
    }
    localStorage.setItem(AUTH_MODE_KEY, "dev");
    localStorage.setItem(AUTH_TOKEN_KEY, "dev_token_deltix");
    localStorage.setItem(TENANT_ID_KEY, tenantId.trim() || "ten_dev_workspace");

    const sess = await api.getCurrentSession();
    if (!sess) {
      localStorage.removeItem(AUTH_MODE_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(TENANT_ID_KEY);
      throw new Error("Developer auth bypass is disabled on API Gateway (GATEWAY_ALLOW_DEV_AUTH=false).");
    }
    return sess;
  },

  /**
   * Revoke current OAuth session cookie and clear any local dev token state.
   */
  async logout(): Promise<void> {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_MODE_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(TENANT_ID_KEY);
      localStorage.removeItem(USER_ID_KEY);
    }
    try {
      await request("/v1/auth/logout", { method: "POST" });
    } catch {
      // Ignore network/401 errors while clearing session
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
    const data = await request<{ spec?: BackendAgentSpec } | BackendAgentSpec>(
      `/v1/agents/specs/${encodeURIComponent(specId)}`,
      { method: "GET" }
    );
    return (data as { spec?: BackendAgentSpec })?.spec ?? (data as BackendAgentSpec);
  },

  /**
   * Compile a new natural language prompt into an Agent IR.
   */
  async compilePrompt(
    promptOrReq: string | CompilePromptRequest,
    category: string = "financial-disbursement"
  ): Promise<CompilePromptResponse> {
    let body: any;
    if (typeof promptOrReq === "string") {
      body = {
        name: "Autonomous Financial Agent",
        category,
        natural_language_prompt: promptOrReq,
      };
    } else {
      body = {
        name: promptOrReq.name || "Autonomous Financial Agent",
        category: promptOrReq.category || category,
        natural_language_prompt: promptOrReq.natural_language_prompt,
        clarifications: promptOrReq.clarifications,
      };
    }
    const url = `${getApiBase()}/v1/agents/compile`;
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (res.status === 422 && data && data.status === "FAILED_VALIDATION") {
      return data as CompilePromptResponse;
    }

    if (!res.ok) {
      const errorDetail =
        data?.detail || data?.title || data?.error_code || data?.message || `${res.status} ${res.statusText}`;
      throw new Error(errorDetail);
    }

    return data as CompilePromptResponse;
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
  async startRun(
    specId: string,
    inputs: Record<string, any> = {}
  ): Promise<{ run_id: string; status: string; run?: BackendAgentRun; checkpoints?: BackendCheckpoint[]; pending_approval?: any }> {
    const resp = await request<any>("/v1/runs", {
      method: "POST",
      body: JSON.stringify({ spec_id: specId, inputs }),
    });
    const runId = resp.run?.run_id || resp.run_id;
    const status = resp.run?.status || resp.status || "RUNNING";
    return {
      run_id: runId,
      status,
      run: resp.run,
      checkpoints: resp.checkpoints,
      pending_approval: resp.pending_approval,
    };
  },

  /**
   * Submit an approval decision (APPROVE or REJECT).
   */
  async decideApproval(
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
    reason: string = "",
    _approvedBy?: string
  ) {
    return request<any>(`/v1/approvals/${encodeURIComponent(approvalId)}/decide`, {
      method: "POST",
      body: JSON.stringify({
        decision,
        reason,
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
    const base = getApiBase();
    return new EventSource(`${base}/v1/runs/${encodeURIComponent(runId)}/stream`, {
      withCredentials: true,
    });
  },
};
