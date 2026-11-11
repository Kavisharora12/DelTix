export type RunStatus =
  | "COMPLETED"
  | "RUNNING"
  | "PAUSED_FOR_APPROVAL"
  | "FAILED"
  | "REJECTED"
  | "QUEUED";

export type NodeType =
  | "DETERMINISTIC_MATH"
  | "GROUNDING_VERIFIER"
  | "TOOL_CALL"
  | "APPROVAL"
  | "POLICY_GATE"
  | "INGEST_DATA"
  | "DECISION_BRANCH";

export type NodeStatus = "pending" | "running" | "succeeded" | "waiting" | "failed";

export interface GraphNodeData {
  id: string;
  title: string;
  type: NodeType;
  status: NodeStatus;
  durationMs?: number;
  tokensUsed?: number;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error?: string;
  policyExpression?: string;
  groundingProof?: {
    sourceQuote: string;
    targetMatch: string;
    confidence: number;
    matchPassed: boolean;
  };
  mathProof?: {
    expression: string;
    variables: Record<string, string>;
    exactDecimalResult: string;
    verified: boolean;
  };
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  isExecuting?: boolean;
}

export interface RunTimelineEvent {
  id: string;
  offsetSeconds: number; // e.g. +0.42s
  eventType: string; // "Node started", "Node completed", "Policy evaluated", etc.
  nodeId: string;
  nodeTitle: string;
  summary: string;
  durationMs?: number;
  payload?: Record<string, any>;
  timestamp: string;
}

export interface RunCheckpoint {
  id: string;
  stepIndex: number;
  nodeId: string;
  timestamp: string;
  stateDelta: Record<string, any>;
  fullState: Record<string, any>;
}

export interface PolicyRuleEvaluation {
  id: string;
  ruleName: string;
  expression: string;
  inputValue: string;
  result: "passed" | "blocked" | "needs_approval";
  evaluatedAt: string;
}

export interface RunItem {
  id: string;
  title: string; // e.g. "Pay invoice INV-20418"
  agentId: string;
  agentName: string;
  counterparty: string;
  counterpartyId: string;
  amountCents: number; // in cents for precise tabular rendering
  currency: string;
  status: RunStatus;
  environment: "sandbox" | "live";
  startedAt: string;
  durationMs: number;
  failureReason?: string;
  approvalDetails?: {
    approvalId?: string;
    capabilityId?: string;
    requestedPayload?: Record<string, any>;
    tokenHash?: string;
    reason: string;
    amountCents: number;
    recipientName: string;
    recipientAccount: string;
    sourceAccount: string;
    triggeredRule: string;
    checksPassed: string[];
    requestedBy: string;
    waitingSince: string;
    initiatorIsCurrentUser?: boolean;
    signedToken?: string;
  };
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  timeline: RunTimelineEvent[];
  checkpoints: RunCheckpoint[];
  policyEvaluations: PolicyRuleEvaluation[];
}

export interface AgentItem {
  id: string;
  name: string;
  version: string;
  description: string;
  lastRunAt: string;
  successRate: number; // 0 - 100
  totalRuns: number;
  owner: string;
  environment: "sandbox" | "live";
  definitionYaml: string;
}

export interface AuditLogItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  targetId: string;
  timestamp: string;
  hash: string;
  status: "success" | "blocked" | "flagged";
}

export interface LedgerEntryItem {
  id: string;
  runId: string;
  referenceId: string; // e.g. INV-20418
  counterparty: string;
  amountCents: number;
  currency: string;
  disbursementMethod: string; // e.g. PayPal Payouts
  idempotencyKey: string;
  reconciliationStatus: "reconciled" | "pending" | "discrepancy";
  timestamp: string;
}

