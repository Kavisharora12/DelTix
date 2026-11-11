import { RunItem, AgentItem, AuditLogItem, LedgerEntryItem } from "@/types";

export const MOCK_AGENTS: AgentItem[] = [
  {
    id: "agent_payables",
    name: "payables-reconciler",
    version: "v2.4.1",
    description: "Reconciles inbound vendor invoices against purchase orders and drafts automated disbursements.",
    lastRunAt: "2026-11-11T13:30:00Z",
    successRate: 98.4,
    totalRuns: 1420,
    owner: "Ops Engineering",
    environment: "sandbox",
    definitionYaml: `name: payables-reconciler
version: 2.4.1
entrypoint: ingest_invoice
nodes:
  - id: ingest_invoice
    type: INGEST_DATA
    source: email_attachment
    next: reconcile_math
  - id: reconcile_math
    type: DETERMINISTIC_MATH
    expression: "round(sum(line_items.amount) + tax_cents, 2)"
    next: verify_grounding
  - id: verify_grounding
    type: GROUNDING_VERIFIER
    tolerance_cents: 0
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
  },
  {
    id: "agent_refunds",
    name: "refund-processor",
    version: "v1.8.0",
    description: "Evaluates dispute claims and calculates pro-rata merchant subscription refunds.",
    lastRunAt: "2026-11-11T13:15:00Z",
    successRate: 94.2,
    totalRuns: 612,
    owner: "Finance Automation",
    environment: "sandbox",
    definitionYaml: `name: refund-processor
version: 1.8.0
entrypoint: ingest_claim
nodes:
  - id: ingest_claim
    type: INGEST_DATA
    next: calculate_prorata
  - id: calculate_prorata
    type: DETERMINISTIC_MATH
    expression: "round(monthly_fee * (unused_days / total_days), 2)"
    next: verify_ledger
  - id: verify_ledger
    type: GROUNDING_VERIFIER
    next: issue_refund
  - id: issue_refund
    type: TOOL_CALL
    tool: paypal.refund
`,
  },
  {
    id: "agent_vendor",
    name: "vendor-onboarding",
    version: "v3.0.2",
    description: "Validates tax ID, bank routing tokens, and generates automated $1 test ping disbursements.",
    lastRunAt: "2026-11-11T12:45:00Z",
    successRate: 99.1,
    totalRuns: 890,
    owner: "Compliance",
    environment: "sandbox",
    definitionYaml: `name: vendor-onboarding
version: 3.0.2
entrypoint: verify_tax_id
nodes:
  - id: verify_tax_id
    type: TOOL_CALL
    next: test_ping_transfer
  - id: test_ping_transfer
    type: TOOL_CALL
    tool: paypal.payout
`,
  },
  {
    id: "agent_payroll",
    name: "payroll-checker",
    version: "v1.2.0",
    description: "Audits contract contractor timesheets against approved rate cards before monthly wire run.",
    lastRunAt: "2026-11-11T10:00:00Z",
    successRate: 96.7,
    totalRuns: 340,
    owner: "People Ops",
    environment: "sandbox",
    definitionYaml: `name: payroll-checker
version: 1.2.0
entrypoint: load_timesheet
nodes:
  - id: load_timesheet
    type: INGEST_DATA
    next: audit_hours
  - id: audit_hours
    type: DETERMINISTIC_MATH
    next: approval_gate
  - id: approval_gate
    type: APPROVAL
    next: execute_payroll
`,
  },
  {
    id: "agent_expense",
    name: "expense-auditor",
    version: "v2.0.0",
    description: "Enforces corporate travel and entertainment expense policy compliance and detects receipts anomalies.",
    lastRunAt: "2026-11-11T09:30:00Z",
    successRate: 91.5,
    totalRuns: 780,
    owner: "Finance Ops",
    environment: "sandbox",
    definitionYaml: `name: expense-auditor
version: 2.0.0
entrypoint: parse_receipt
nodes:
  - id: parse_receipt
    type: INGEST_DATA
    next: check_spend_category
  - id: check_spend_category
    type: POLICY_GATE
    next: reimbursement
`,
  },
];

export const MOCK_RUNS: RunItem[] = [
  // 1. WAITING FOR APPROVAL - The primary example from Section 7.3 of Design.md
  {
    id: "run_01J9A8Z1M4E3Q8H6R2",
    title: "Pay invoice INV-20418",
    agentId: "agent_payables",
    agentName: "payables-reconciler",
    counterparty: "Northwind Logistics",
    counterpartyId: "pp:NWL-8841-AQ",
    amountCents: 125000, // $1,250.00
    currency: "USD",
    status: "PAUSED_FOR_APPROVAL",
    environment: "sandbox",
    startedAt: "2026-11-11T13:18:22Z",
    durationMs: 8420,
    approvalDetails: {
      reason: "Amount exceeds the per-payment limit of $500.00",
      amountCents: 125000,
      recipientName: "Northwind Logistics",
      recipientAccount: "pp:NWL-8841-AQ",
      sourceAccount: "Operating account ending 4417",
      triggeredRule: "amount_usd > max_budget_usd (1250.00 > 500.00)",
      checksPassed: [
        "3 of 3 line items match the invoice",
        "Total recomputed: $1,250.00 (tolerance: $0.00)",
        "Recipient is on the approved vendor list",
        "No duplicate payment found (idempotency key unique)",
      ],
      requestedBy: "agent_payables (automated trigger)",
      waitingSince: "3m ago",
      initiatorIsCurrentUser: false,
    },
    nodes: [
      {
        id: "ingest_invoice",
        title: "Ingest invoice INV-20418",
        type: "INGEST_DATA",
        status: "succeeded",
        durationMs: 410,
        tokensUsed: 820,
        outputs: {
          vendor: "Northwind Logistics",
          invoice_number: "INV-20418",
          total_claimed: "1250.00",
          line_item_count: 3,
        },
      },
      {
        id: "deterministic_math",
        title: "Deterministic math sum",
        type: "DETERMINISTIC_MATH",
        status: "succeeded",
        durationMs: 45,
        tokensUsed: 0,
        mathProof: {
          expression: "round(Decimal('450.00') + Decimal('600.00') + Decimal('200.00'), 2)",
          variables: {
            "item_1_freight": "450.00",
            "item_2_customs": "600.00",
            "item_3_handling": "200.00",
          },
          exactDecimalResult: "1250.00",
          verified: true,
        },
        outputs: { computed_total: "1250.00", math_verified: true },
      },
      {
        id: "grounding_verifier",
        title: "Verify invoice grounding",
        type: "GROUNDING_VERIFIER",
        status: "succeeded",
        durationMs: 230,
        tokensUsed: 410,
        groundingProof: {
          sourceQuote: "Total Due: $1,250.00 Net 30 to Northwind Logistics account #NWL-8841",
          targetMatch: "$1,250.00 to pp:NWL-8841-AQ",
          confidence: 0.998,
          matchPassed: true,
        },
      },
      {
        id: "policy_guard",
        title: "Check spend policy",
        type: "POLICY_GATE",
        status: "succeeded",
        durationMs: 12,
        policyExpression: "amount_usd <= 500.00",
        outputs: { rule_triggered: "max_budget_usd", requires_approval: true },
      },
      {
        id: "approval_gate",
        title: "Human approval gate",
        type: "APPROVAL",
        status: "waiting",
        durationMs: 0,
      },
      {
        id: "paypal_disburse",
        title: "PayPal payout",
        type: "TOOL_CALL",
        status: "pending",
      },
    ],
    edges: [
      { id: "e1", source: "ingest_invoice", target: "deterministic_math" },
      { id: "e2", source: "deterministic_math", target: "grounding_verifier" },
      { id: "e3", source: "grounding_verifier", target: "policy_guard" },
      { id: "e4", source: "policy_guard", target: "approval_gate" },
      { id: "e5", source: "approval_gate", target: "paypal_disburse" },
    ],
    timeline: [
      {
        id: "evt_1",
        offsetSeconds: 0.0,
        eventType: "Run started",
        nodeId: "ingest_invoice",
        nodeTitle: "Ingest invoice INV-20418",
        summary: "Ingested invoice document from attachments",
        durationMs: 410,
        timestamp: "2026-11-11T13:18:22Z",
      },
      {
        id: "evt_2",
        offsetSeconds: 0.41,
        eventType: "Node completed",
        nodeId: "deterministic_math",
        nodeTitle: "Deterministic math sum",
        summary: "AST Decimal sum computed 1250.00 USD with 0 tolerance",
        durationMs: 45,
        timestamp: "2026-11-11T13:18:23Z",
      },
      {
        id: "evt_3",
        offsetSeconds: 0.68,
        eventType: "Grounding verified",
        nodeId: "grounding_verifier",
        nodeTitle: "Verify invoice grounding",
        summary: "Exact quote verified in PDF text at 99.8% confidence",
        durationMs: 230,
        timestamp: "2026-11-11T13:18:23Z",
      },
      {
        id: "evt_4",
        offsetSeconds: 0.71,
        eventType: "Policy check triggered",
        nodeId: "policy_guard",
        nodeTitle: "Check spend policy",
        summary: "Amount $1,250.00 exceeds auto-disburse threshold $500.00",
        durationMs: 12,
        timestamp: "2026-11-11T13:18:24Z",
      },
      {
        id: "evt_5",
        offsetSeconds: 0.72,
        eventType: "Execution paused",
        nodeId: "approval_gate",
        nodeTitle: "Human approval gate",
        summary: "Run paused awaiting dual-key HMAC cryptographic signature",
        timestamp: "2026-11-11T13:18:24Z",
      },
    ],
    checkpoints: [
      {
        id: "chk_01",
        stepIndex: 1,
        nodeId: "ingest_invoice",
        timestamp: "2026-11-11T13:18:22Z",
        stateDelta: { invoice_parsed: true, vendor: "Northwind Logistics" },
        fullState: { invoice_id: "INV-20418", vendor: "Northwind Logistics", currency: "USD" },
      },
      {
        id: "chk_02",
        stepIndex: 2,
        nodeId: "deterministic_math",
        timestamp: "2026-11-11T13:18:23Z",
        stateDelta: { amount_calculated: 1250.0, math_clean: true },
        fullState: { invoice_id: "INV-20418", vendor: "Northwind Logistics", amount_calculated: 1250.0 },
      },
      {
        id: "chk_03",
        stepIndex: 4,
        nodeId: "approval_gate",
        timestamp: "2026-11-11T13:18:24Z",
        stateDelta: { paused_for_approval: true, token_needed: true },
        fullState: {
          invoice_id: "INV-20418",
          vendor: "Northwind Logistics",
          amount: 1250.0,
          paused_node: "approval_gate",
        },
      },
    ],
    policyEvaluations: [
      {
        id: "pol_1",
        ruleName: "max_budget_usd",
        expression: "amount_usd <= 500.00",
        inputValue: "1250.00",
        result: "needs_approval",
        evaluatedAt: "2026-11-11T13:18:24Z",
      },
      {
        id: "pol_2",
        ruleName: "approved_vendor_whitelist",
        expression: "recipient_id in whitelist",
        inputValue: "pp:NWL-8841-AQ",
        result: "passed",
        evaluatedAt: "2026-11-11T13:18:24Z",
      },
      {
        id: "pol_3",
        ruleName: "idempotency_duplicate_guard",
        expression: "count(prior_payouts_24h) == 0",
        inputValue: "0",
        result: "passed",
        evaluatedAt: "2026-11-11T13:18:24Z",
      },
    ],
  },

  // 2. RUNNING RUN (Active with animated dash flow on executing edge)
  {
    id: "run_01J9A7X5P1N2B4K9D0",
    title: "Process supplier batch PO-8831",
    agentId: "agent_payables",
    agentName: "payables-reconciler",
    counterparty: "Starlight Silicon Inc.",
    counterpartyId: "pp:SSI-9902-TX",
    amountCents: 4890000, // $48,900.00
    currency: "USD",
    status: "RUNNING",
    environment: "sandbox",
    startedAt: "2026-11-11T13:28:10Z",
    durationMs: 3450,
    nodes: [
      {
        id: "n1",
        title: "Ingest PO-8831 data",
        type: "INGEST_DATA",
        status: "succeeded",
        durationMs: 380,
      },
      {
        id: "n2",
        title: "Audit unit price variance",
        type: "DETERMINISTIC_MATH",
        status: "succeeded",
        durationMs: 65,
      },
      {
        id: "n3",
        title: "Verify batch tax computation",
        type: "DETERMINISTIC_MATH",
        status: "running",
        durationMs: 120,
      },
      {
        id: "n4",
        title: "Check daily cumulative cap",
        type: "POLICY_GATE",
        status: "pending",
      },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3", isExecuting: true },
      { id: "e3", source: "n3", target: "n4" },
    ],
    timeline: [
      {
        id: "evt_r1",
        offsetSeconds: 0.0,
        eventType: "Run started",
        nodeId: "n1",
        nodeTitle: "Ingest PO-8831 data",
        summary: "Ingested 142 items from electronic manifest",
        durationMs: 380,
        timestamp: "2026-11-11T13:28:10Z",
      },
      {
        id: "evt_r2",
        offsetSeconds: 0.38,
        eventType: "Node completed",
        nodeId: "n2",
        nodeTitle: "Audit unit price variance",
        summary: "Contract price within 0.00% variance",
        durationMs: 65,
        timestamp: "2026-11-11T13:28:11Z",
      },
      {
        id: "evt_r3",
        offsetSeconds: 0.45,
        eventType: "Node started",
        nodeId: "n3",
        nodeTitle: "Verify batch tax computation",
        summary: "Executing exact tax calculations...",
        timestamp: "2026-11-11T13:28:11Z",
      },
    ],
    checkpoints: [
      {
        id: "chk_r1",
        stepIndex: 1,
        nodeId: "n1",
        timestamp: "2026-11-11T13:28:10Z",
        stateDelta: { manifest_loaded: true },
        fullState: { manifest_id: "PO-8831" },
      },
    ],
    policyEvaluations: [],
  },

  // 3. FAILED RUN (Duplicate idempotency key)
  {
    id: "run_01J9A5T8V6Y2C1M4P9",
    title: "Disburse reimbursement REIMB-4401",
    agentId: "agent_expense",
    agentName: "expense-auditor",
    counterparty: "Sarah Jenkins",
    counterpartyId: "pp:usr_991823",
    amountCents: 3820, // $38.20
    currency: "USD",
    status: "FAILED",
    environment: "sandbox",
    startedAt: "2026-11-11T12:40:15Z",
    durationMs: 1420,
    failureReason: "PayPal rejected the payout: duplicate idempotency key detected for transaction 4401. Payment already settled.",
    nodes: [
      { id: "n1", title: "Parse receipt", type: "INGEST_DATA", status: "succeeded" },
      { id: "n2", title: "Verify meal limit", type: "POLICY_GATE", status: "succeeded" },
      { id: "n3", title: "Dispatch PayPal payout", type: "TOOL_CALL", status: "failed", error: "Duplicate idempotency key" },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
    ],
    timeline: [
      {
        id: "evt_f1",
        offsetSeconds: 0.0,
        eventType: "Run started",
        nodeId: "n1",
        nodeTitle: "Parse receipt",
        summary: "Ingested dinner receipt $38.20",
        timestamp: "2026-11-11T12:40:15Z",
      },
      {
        id: "evt_f2",
        offsetSeconds: 1.42,
        eventType: "Tool error",
        nodeId: "n3",
        nodeTitle: "Dispatch PayPal payout",
        summary: "PayPal adapter returned error: IDEMPOTENCY_CONFLICT",
        timestamp: "2026-11-11T12:40:16Z",
      },
    ],
    checkpoints: [],
    policyEvaluations: [],
  },

  // 4. SUCCEEDED RUN
  {
    id: "run_01J9A4K2L9Z8X7V6C5",
    title: "Pay monthly retainer ACME-NOV-26",
    agentId: "agent_payables",
    agentName: "payables-reconciler",
    counterparty: "Acme Cloud Services",
    counterpartyId: "pp:ACM-1029-US",
    amountCents: 45000, // $450.00
    currency: "USD",
    status: "COMPLETED",
    environment: "sandbox",
    startedAt: "2026-11-11T12:10:00Z",
    durationMs: 2310,
    nodes: [
      { id: "n1", title: "Read invoice", type: "INGEST_DATA", status: "succeeded" },
      { id: "n2", title: "Verify contract rate", type: "DETERMINISTIC_MATH", status: "succeeded" },
      { id: "n3", title: "Check budget cap", type: "POLICY_GATE", status: "succeeded" },
      { id: "n4", title: "Execute disbursement", type: "TOOL_CALL", status: "succeeded" },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
    timeline: [
      {
        id: "evt_s1",
        offsetSeconds: 0.0,
        eventType: "Run started",
        nodeId: "n1",
        nodeTitle: "Read invoice",
        summary: "Invoice verified against master services agreement",
        timestamp: "2026-11-11T12:10:00Z",
      },
      {
        id: "evt_s2",
        offsetSeconds: 2.31,
        eventType: "Disbursement completed",
        nodeId: "n4",
        nodeTitle: "Execute disbursement",
        summary: "Disbursed $450.00 USD via PayPal Payouts. Tx ID: PAYID-MN34091",
        timestamp: "2026-11-11T12:10:02Z",
      },
    ],
    checkpoints: [],
    policyEvaluations: [],
  },

  // 5. WAITING FOR APPROVAL (Another pending item for the inbox)
  {
    id: "run_01J9A3B7N1M8K2L4P0",
    title: "Contractor milestone wire CW-7709",
    agentId: "agent_payroll",
    agentName: "payroll-checker",
    counterparty: "Vector Foundry Ltd.",
    counterpartyId: "pp:VFL-9912-UK",
    amountCents: 850000, // $8,500.00
    currency: "USD",
    status: "PAUSED_FOR_APPROVAL",
    environment: "sandbox",
    startedAt: "2026-11-11T11:45:00Z",
    durationMs: 4200,
    approvalDetails: {
      reason: "Amount exceeds contractor single payment limit of $3,000.00",
      amountCents: 850000,
      recipientName: "Vector Foundry Ltd.",
      recipientAccount: "pp:VFL-9912-UK",
      sourceAccount: "Operating account ending 4417",
      triggeredRule: "amount_usd > contractor_limit_usd (8500.00 > 3000.00)",
      checksPassed: [
        "Timesheet deliverables signed off by Engineering VP",
        "Hours verified against rate card ($125.00/hr)",
        "No prior duplicate claims in November 2026",
      ],
      requestedBy: "agent_payroll (timesheet parser)",
      waitingSince: "1h 35m ago",
      initiatorIsCurrentUser: false,
    },
    nodes: [],
    edges: [],
    timeline: [],
    checkpoints: [],
    policyEvaluations: [],
  },

  // 6. REJECTED RUN
  {
    id: "run_01J9A2V5C8X1Z3M7N9",
    title: "Expedited flight upgrade EXP-9910",
    agentId: "agent_expense",
    agentName: "expense-auditor",
    counterparty: "Skyway Airways",
    counterpartyId: "pp:SKY-4410-INTL",
    amountCents: 62000, // $620.00
    currency: "USD",
    status: "REJECTED",
    environment: "sandbox",
    startedAt: "2026-11-11T10:15:00Z",
    durationMs: 5100,
    failureReason: "Manual rejection: Controller rejected seat upgrade per travel policy §4.2 (requires CFO prior written sign-off).",
    nodes: [],
    edges: [],
    timeline: [],
    checkpoints: [],
    policyEvaluations: [],
  },
];

// Generate 34 additional realistic seeded runs to complete the 40-item requirement
const vendors = [
  "Northwind Logistics",
  "Acme Cloud Services",
  "Starlight Silicon Inc.",
  "Vector Foundry Ltd.",
  "Apex Cloud Hosting",
  "Quantum Dynamics",
  "Cascade Analytics",
  "Pioneer Freight Co.",
  "OmniSupply Global",
  "Helios Solar Energy",
];

const agents = [
  { id: "agent_payables", name: "payables-reconciler" },
  { id: "agent_refunds", name: "refund-processor" },
  { id: "agent_vendor", name: "vendor-onboarding" },
  { id: "agent_payroll", name: "payroll-checker" },
  { id: "agent_expense", name: "expense-auditor" },
];

for (let i = 7; i <= 40; i++) {
  const agent = agents[i % agents.length];
  const vendor = vendors[i % vendors.length];
  const isFailed = i === 14 || i === 28;
  const isRunning = i === 11 || i === 21;
  const isWaiting = i === 18;
  const isRejected = i === 33;
  const status = isFailed
    ? "FAILED"
    : isRunning
    ? "RUNNING"
    : isWaiting
    ? "PAUSED_FOR_APPROVAL"
    : isRejected
    ? "REJECTED"
    : "COMPLETED";

  const amountCents = ((i * 137 + 45) % 850 + 25) * 100 + (i % 2 === 0 ? 50 : 0);
  const minutesAgo = i * 22;
  const startTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

  MOCK_RUNS.push({
    id: `run_01J9A${(1000 + i).toString(36).toUpperCase()}8Z${i}X`,
    title: `${agent.name === "payables-reconciler" ? "Pay invoice" : agent.name === "refund-processor" ? "Process refund" : "Audit disbursement"} ${vendor.slice(0, 4).toUpperCase()}-${1000 + i}`,
    agentId: agent.id,
    agentName: agent.name,
    counterparty: vendor,
    counterpartyId: `pp:${vendor.slice(0, 3).toUpperCase()}-${2000 + i}`,
    amountCents: amountCents,
    currency: "USD",
    status: status,
    environment: "sandbox",
    startedAt: startTime,
    durationMs: 1200 + (i * 110) % 3000,
    failureReason: isFailed
      ? i === 14
        ? "PayPal rejected payout: recipient unverified. Ask vendor to confirm PayPal email."
        : "Circuit breaker open: 5 consecutive upstream timeouts to payment adapter."
      : undefined,
    approvalDetails: isWaiting
      ? {
          reason: "Batch disbursement exceeds organization threshold of $1,000.00",
          amountCents: amountCents,
          recipientName: vendor,
          recipientAccount: `pp:${vendor.slice(0, 3).toUpperCase()}-${2000 + i}`,
          sourceAccount: "Operating account ending 4417",
          triggeredRule: `amount_usd > threshold_usd (${(amountCents / 100).toFixed(2)} > 1000.00)`,
          checksPassed: ["Vendor tax ID on file", "Bank routing verified"],
          requestedBy: agent.name,
          waitingSince: `${minutesAgo}m ago`,
        }
      : undefined,
    nodes: [],
    edges: [],
    timeline: [],
    checkpoints: [],
    policyEvaluations: [],
  });
}

export const MOCK_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: "aud_9941",
    actor: "controller@company.internal",
    action: "POLICY_UPDATE",
    target: "max_budget_usd",
    targetId: "pol_payables_01",
    timestamp: "2026-11-11T13:00:14Z",
    hash: "a4f89d3c1e2b4a5f6e7d8c9b0a1f2e3d",
    status: "success",
  },
  {
    id: "aud_9940",
    actor: "system_policy_daemon",
    action: "HMAC_TOKEN_GENERATION",
    target: "run_01J9A8Z1M4E3Q8H6R2",
    targetId: "approval_gate",
    timestamp: "2026-11-11T13:18:24Z",
    hash: "f8c7b6a5e4d3c2b1a0f9e8d7c6b5a4e3",
    status: "success",
  },
  {
    id: "aud_9939",
    actor: "agent_expense",
    action: "DISBURSEMENT_ATTEMPT",
    target: "pp:usr_991823",
    targetId: "run_01J9A5T8V6Y2C1M4P9",
    timestamp: "2026-11-11T12:40:15Z",
    hash: "3b2a1f0e9d8c7b6a5e4d3c2b1a0f9e8d",
    status: "blocked",
  },
];

export const MOCK_LEDGER_ENTRIES: LedgerEntryItem[] = [
  {
    id: "led_01",
    runId: "run_01J9A4K2L9Z8X7V6C5",
    referenceId: "ACME-NOV-26",
    counterparty: "Acme Cloud Services",
    amountCents: 45000,
    currency: "USD",
    disbursementMethod: "PayPal Payouts",
    idempotencyKey: "idem_acme_nov26_0941",
    reconciliationStatus: "reconciled",
    timestamp: "2026-11-11T12:10:02Z",
  },
  {
    id: "led_02",
    runId: "run_01J9A8Z1M4E3Q8H6R2",
    referenceId: "INV-20418",
    counterparty: "Northwind Logistics",
    amountCents: 125000,
    currency: "USD",
    disbursementMethod: "PayPal Payouts",
    idempotencyKey: "idem_nwl_inv20418_8841",
    reconciliationStatus: "pending",
    timestamp: "2026-11-11T13:18:24Z",
  },
];

