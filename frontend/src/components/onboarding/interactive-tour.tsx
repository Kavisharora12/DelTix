"use client";

import React, { useState, useEffect } from "react";
import {
  Gamepad2,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  ShieldAlert,
  Search,
  Calculator,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  id: string;
  badge: string;
  title: string;
  targetDescription: string;
  explanation: string;
  keyboardTip?: string;
  actionText: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "step_welcome",
    badge: "MISSION BRIEFING",
    title: "Welcome to DelTix Ops Console",
    targetDescription: "Quick-Start Game Guide",
    explanation:
      "Just like booting up an RTS or simulator game, this console gives you complete control over autonomous AI agents that handle invoices and disbursements. Let's do a fast 60-second tour of what every button does!",
    actionText: "Start Walkthrough",
  },
  {
    id: "step_env",
    badge: "SAFETY BUTTON #1",
    title: "The Sandbox / Live Mode Switcher",
    targetDescription: "Top Bar → Environment Pill [Sandbox | Live]",
    explanation:
      "In Sandbox mode (amber banner), no real money ever moves. Payouts are simulated against PayPal developer sandboxes. The red Live mode is only toggled when releasing real corporate treasury payments.",
    keyboardTip: "Check the full-width amber banner at any time to verify your environment.",
    actionText: "Next: Keyboard Controls",
  },
  {
    id: "step_shortcuts",
    badge: "PLAYER CONTROLS",
    title: "Table Navigation & Quick Peek",
    targetDescription: "Runs Table → Rows & Keyboard",
    explanation:
      "You don't need a mouse to scan runs. Use J to move down and K to move up. Press SPACE on any row to open the instant peek drawer for facts, or press ENTER to jump into the full graph inspector.",
    keyboardTip: "Keys: 'J' down, 'K' up, 'SPACE' peek, 'ENTER' open, '?' shortcuts.",
    actionText: "Next: The Command Cheat Code",
  },
  {
    id: "step_cmdk",
    badge: "GLOBAL SEARCH",
    title: "Command Palette (Cmd+K)",
    targetDescription: "Top Bar → Search Button or ⌘K",
    explanation:
      "Press Cmd+K (or Ctrl+K) anywhere in the application. You can search runs by invoice ID, jump directly to pages (G R for Runs, G A for Approvals), or find agent graphs in milliseconds.",
    keyboardTip: "Shortcut: ⌘K or / to open instantly.",
    actionText: "Next: The Approval Gate",
  },
  {
    id: "step_approvals",
    badge: "CRITICAL ACTION",
    title: "The Human Approval Gate",
    targetDescription: "Approvals Page & Run Detail → Right Decision Sheet",
    explanation:
      "When an agent wants to pay more than company spend rules allow, it halts without holding database locks. The amber Decision Panel displays the exact quote, tolerance checks, and lets you sign an HMAC token to release funds.",
    keyboardTip: "Dual-key separation: you cannot approve runs you initiated yourself.",
    actionText: "Next: Zero-Hallucination Proofs",
  },
  {
    id: "step_proofs",
    badge: "SYSTEM ENGINE",
    title: "Deterministic Math & Quote Citations",
    targetDescription: "Run Detail → Node Inspector Tab",
    explanation:
      "DelTix guarantees zero hallucinations. Mental math by the LLM is strictly forbidden. Click on any DETERMINISTIC_MATH or GROUNDING_VERIFIER node in the DAG to inspect the Python AST Decimal calculation breakdown.",
    keyboardTip: "Tolerance: $0.00 cent-level accuracy.",
    actionText: "Finish Tour & Play",
  },
];

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InteractiveTour({ isOpen, onClose }: InteractiveTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIndex, onClose]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 select-none animate-in fade-in-0 duration-fast"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-panel border border-slate-5 rounded-panel shadow-floating overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tour Modal Header */}
        <div className="p-4 border-b border-slate-5 bg-slate-3/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-9 text-white flex items-center justify-center font-bold text-xs">
              <Gamepad2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-ui-xs text-blue-11 font-mono font-medium">
                {step.badge} • STEP {currentStepIndex + 1} OF {TOUR_STEPS.length}
              </div>
              <div className="text-title-section text-slate-12">
                {step.title}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-slate-10 hover:text-slate-12 hover:bg-slate-4 transition-colors"
            title="Close guide (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tour Content */}
        <div className="p-5 space-y-4">
          <div className="p-2.5 rounded bg-slate-3 border border-slate-5 text-ui-xs font-mono text-slate-11">
            <span className="text-slate-10 font-sans block mb-0.5">Focus Target:</span>
            {step.targetDescription}
          </div>

          <p className="text-ui text-slate-11 leading-relaxed">
            {step.explanation}
          </p>

          {step.keyboardTip && (
            <div className="p-3 bg-blue-3/40 border border-blue-6 rounded-btn text-ui-xs text-blue-11 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-9 shrink-0 mt-0.5" />
              <span>{step.keyboardTip}</span>
            </div>
          )}
        </div>

        {/* Tour Footer Controls */}
        <div className="p-4 border-t border-slate-5 bg-slate-3/20 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? "w-5 bg-blue-9"
                    : "w-2 bg-slate-6 hover:bg-slate-5"
                }`}
                title={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="secondary" size="sm" onClick={handlePrev}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                <span>Back</span>
              </Button>
            )}

            <Button variant="primary" size="sm" onClick={handleNext}>
              <span>{step.actionText}</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

