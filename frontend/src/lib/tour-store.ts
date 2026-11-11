import { create } from "zustand";

export interface HandsOnStep {
  id: string;
  stepNumber: number;
  totalSteps: number;
  route: string; // The real route to navigate to
  featureBadge: string;
  title: string;
  targetElementText: string;
  instruction: string;
  handsOnTask: string;
  whyItMatters: string;
  actionButtonText: string;
}

export const HANDS_ON_STEPS: HandsOnStep[] = [
  // 1. AGENT STUDIO: Creating & Compiling
  {
    id: "tour_agents",
    stepNumber: 1,
    totalSteps: 6,
    route: "/agents",
    featureBadge: "MODULE 1: AGENT STUDIO",
    title: "Step 1: Creating & Compiling an Agent",
    targetElementText: "Agent Definition (YAML) & Compiler Diagnostics",
    instruction:
      "This is where agent graphs are born. On the left is the declarative YAML definition. On the right is the Compiler Diagnostics panel (styled like VS Code Problems) checking every node before it can ever touch money.",
    handsOnTask:
      "Notice the diagnostics panel catching rule warnings in real time (e.g. 'max_budget_usd is not bounded'). DelTix refuses to compile graphs that have dangling nodes or unverified payout tools.",
    whyItMatters: "Prevents broken or rogue agent code from ever deploying to production.",
    actionButtonText: "Next: Configure Policies →",
  },

  // 2. POLICIES: Setting Up Safety Caps
  {
    id: "tour_policies",
    stepNumber: 2,
    totalSteps: 6,
    route: "/policies",
    featureBadge: "MODULE 2: POLICY GUARDS",
    title: "Step 2: Spend Policies & Capability Rules",
    targetElementText: "Deterministic Policy Matrix Table",
    instruction:
      "Here controllers configure strict mathematical guardrails that execute completely OUTSIDE the LLM. For example: max $500 per transaction, $10,000 daily spend cap, and approved vendor whitelists.",
    handsOnTask:
      "Look at the 'Action on Exceed' column. Any payment exceeding the threshold triggers 'REQUIRE_HUMAN_APPROVAL' which instantly halts execution safely without holding DB locks.",
    whyItMatters: "Hard financial boundary. The AI agent can NEVER spend more than policy allows.",
    actionButtonText: "Next: Live Runs & Zero-Math →",
  },

  // 3. RUNS TABLE & DETAIL: Live Execution & Zero-Math Proofs
  {
    id: "tour_runs_detail",
    stepNumber: 3,
    totalSteps: 6,
    route: "/runs/run_01J9A8Z1M4E3Q8H6R2",
    featureBadge: "MODULE 3: RUN INSPECTOR",
    title: "Step 3: State DAG & Zero-Hallucination Proofs",
    targetElementText: "Graph DAG Canvas & Node Inspector (Right)",
    instruction:
      "This is the core execution HUD. The visual DAG shows the active path of run_01J9A8Z1M4E3Q8H6R2. On the right, select the 'deterministic_math' node to see the Python AST Decimal calculation ($450 + $600 + $200 = $1,250.00).",
    handsOnTask:
      "Notice the Grounding Verification proof: it verified the exact quote from the invoice PDF at 99.8% confidence with 0-cent tolerance.",
    whyItMatters: "LLM mental math is mathematically impossible here; zero hallucinations guaranteed.",
    actionButtonText: "Next: The Approval Gate →",
  },

  // 4. APPROVALS QUEUE: Human-in-the-Loop Release
  {
    id: "tour_approvals",
    stepNumber: 4,
    totalSteps: 6,
    route: "/approvals",
    featureBadge: "MODULE 4: APPROVAL GATE",
    title: "Step 4: Human Controller Approval Queue",
    targetElementText: "Pending Items Table & Decision Sheet",
    instruction:
      "When run_01J9A8Z1M4E3Q8H6R2 exceeded the $500 threshold, it paused here. In the decision sheet, review the amount ($1,250.00), verified vendor (Northwind Logistics), and automated checks passed.",
    handsOnTask:
      "Try clicking 'Approve $1,250.00'. It generates a cryptographic dual-key HMAC token (atok_live_...) that signs and releases the payout.",
    whyItMatters: "Separation of duties: you cannot approve runs you initiated yourself.",
    actionButtonText: "Next: Settlement Ledger →",
  },

  // 5. LEDGER: Idempotency & Reconciliation
  {
    id: "tour_ledger",
    stepNumber: 5,
    totalSteps: 6,
    route: "/ledger",
    featureBadge: "MODULE 5: SETTLEMENT LEDGER",
    title: "Step 5: Idempotency & Reconciliation",
    targetElementText: "Idempotent Settlement Ledger Table",
    instruction:
      "Every payout records an 'INTENT_RECORDED' row with a unique idempotency key before dispatching to PayPal. If network drops or retries happen, DelTix detects the key and prevents duplicate charges.",
    handsOnTask:
      "Check the 'Idempotency Key' and 'Reconciliation Status' columns. Reconciled entries link directly to PayPal transaction IDs.",
    whyItMatters: "Eliminates double-charging and payment loss during upstream network spikes.",
    actionButtonText: "Next: Cryptographic Audit →",
  },

  // 6. AUDIT: Immutable Tamper-Proof Trail
  {
    id: "tour_audit",
    stepNumber: 6,
    totalSteps: 6,
    route: "/audit",
    featureBadge: "MODULE 6: AUDIT TRAIL",
    title: "Step 6: Cryptographic Audit Trail",
    targetElementText: "SHA-256 Audit Log Table",
    instruction:
      "The final safety layer: an append-only log of every policy check, approval signature, and payout dispatch. Every single row has an immutable SHA-256 digest hash.",
    handsOnTask:
      "Click on any SHA-256 hash to copy it to your clipboard. These hashes can be audited independently by external accounting firms.",
    whyItMatters: "Full regulatory compliance (SOC2 / SOX) and tamper-proof financial accountability.",
    actionButtonText: "Finish Tour & Explore Console 🎉",
  },
];

interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  endTour: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,

  startTour: () => {
    set({ isActive: true, currentStepIndex: 0 });
  },

  nextStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex < HANDS_ON_STEPS.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    } else {
      set({ isActive: false, currentStepIndex: 0 });
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  goToStep: (index: number) => {
    if (index >= 0 && index < HANDS_ON_STEPS.length) {
      set({ currentStepIndex: index, isActive: true });
    }
  },

  endTour: () => {
    set({ isActive: false });
  },
}));

