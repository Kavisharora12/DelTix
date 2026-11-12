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
  // 1. STUDIO: Creating & Compiling
  {
    id: "tour_studio",
    stepNumber: 1,
    totalSteps: 6,
    route: "/studio/new",
    featureBadge: "MODULE 1: COMPILER STUDIO",
    title: "Step 1: Compiling Rules into a Sealed Agent",
    targetElementText: "Describe Agent Financial Workflow & Compilation Diagnostics",
    instruction:
      "Write your financial workflow rules in plain English. DelTix compiles them into an Agent IR state graph, checks spend bounds, runs pre-flight synthetic tests, and seals it with an HMAC readiness token.",
    handsOnTask:
      "If you omit spend limits or approval thresholds, the Compiler pauses with CLARIFICATION_REQUIRED instead of guessing bounds.",
    whyItMatters: "Prevents unverified or unbounded workflows from ever executing.",
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
    targetElementText: "Policy Rules & Capability Registry",
    instruction:
      "Inspect all active spend caps, human approval thresholds, and registered PayPal capabilities enforced outside the LLM by the Go Capability & Policy Service.",
    handsOnTask:
      "Switch to the Capability Registry tab to view the registered PayPal Sandbox tools allowed in this workspace.",
    whyItMatters: "Hard financial boundary: the AI agent can only call allowlisted tools within policy limits.",
    actionButtonText: "Next: Live Sandbox & Runs →",
  },

  // 3. SANDBOX & RUNS: Live Execution
  {
    id: "tour_runs_detail",
    stepNumber: 3,
    totalSteps: 6,
    route: "/sandbox",
    featureBadge: "MODULE 3: LIVE SANDBOX",
    title: "Step 3: Live Execution & Real-Time SSE Timeline",
    targetElementText: "Conversational Chat Terminal & Live Execution Timeline",
    instruction:
      "Test your compiled agent using simulated customer triggers against PayPal Developer Sandbox while watching step-by-step checkpoints stream in real time.",
    handsOnTask:
      "Try a $38 Auto-Refund preset vs a $150 (Approval Gate) trigger to watch how policy routing behaves.",
    whyItMatters: "Lets you test financial behavior safely before real customers invoke the agent.",
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
    targetElementText: "Pending Items Table & Decision Panel",
    instruction:
      "When a transaction triggers a human approval threshold, execution pauses cleanly (PAUSED_FOR_APPROVAL) without dropping state or double-charging.",
    handsOnTask:
      "Review any pending approval item here to approve (minting a signed HMAC approval token) or reject it.",
    whyItMatters: "Human sign-off enforced deterministically before sensitive money movement.",
    actionButtonText: "Next: Settlement Ledger →",
  },

  // 5. LEDGER: Reconciliation
  {
    id: "tour_ledger",
    stepNumber: 5,
    totalSteps: 6,
    route: "/ledger",
    featureBadge: "MODULE 5: SETTLEMENT LEDGER",
    title: "Step 5: Settlement & Idempotency Tracking",
    targetElementText: "Settlement Ledger Table",
    instruction:
      "Tracks settled disbursements and pending approval holds derived from your workspace runs, along with any idempotency keys returned by tool execution.",
    handsOnTask:
      "Export CSV reconciliation reports once runs disburse or hold funds.",
    whyItMatters: "Clear traceability from agent run ID to payment settlement status.",
    actionButtonText: "Next: Audit Trail →",
  },

  // 6. AUDIT: Execution Activity Trail
  {
    id: "tour_audit",
    stepNumber: 6,
    totalSteps: 6,
    route: "/audit",
    featureBadge: "MODULE 6: AUDIT TRAIL",
    title: "Step 6: Execution & Policy Activity Log",
    targetElementText: "Audit Activity Table",
    instruction:
      "Filter and export run execution, approval gate, and settlement events across all agents in your workspace.",
    handsOnTask:
      "Click any row to inspect its run reference, operator, and PayPal idempotency key (when issued).",
    whyItMatters: "Centralized operational visibility across every agent run.",
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

