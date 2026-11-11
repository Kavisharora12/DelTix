"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Gamepad2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  CheckCircle2,
  Compass,
  Layers,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { HANDS_ON_STEPS, useTourStore } from "@/lib/tour-store";
import { Button } from "@/components/ui/button";

export function HandsOnTourHUD() {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, currentStepIndex, nextStep, prevStep, endTour, goToStep } = useTourStore();

  const step = HANDS_ON_STEPS[currentStepIndex];

  // Whenever step changes, navigate the user directly to the target screen
  useEffect(() => {
    if (!isActive || !step) return;

    // Check if we are already on the route or need to navigate
    if (pathname !== step.route) {
      router.push(step.route);
    }
  }, [isActive, currentStepIndex, step, pathname, router]);

  if (!isActive || !step) return null;

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === HANDS_ON_STEPS.length - 1;

  return (
    <aside
      aria-label="Interactive Tour HUD"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl z-50 animate-in slide-in-from-bottom-4 duration-fast select-none"
    >
      <div className="bg-panel border-2 border-blue-9 rounded-panel shadow-floating overflow-hidden text-ui">
        {/* HUD Top Bar */}
        <div className="px-4 py-2 bg-slate-3 border-b border-slate-5 flex items-center justify-between text-ui-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-9 animate-ping" />
            <span className="font-mono font-semibold text-blue-11">{step.featureBadge}</span>
            <span className="text-slate-8">•</span>
            <span className="text-slate-10 font-mono">
              STEP {step.stepNumber} OF {step.totalSteps}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Step jump buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {HANDS_ON_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`h-5 px-1.5 rounded text-[10px] font-mono transition-colors ${
                    idx === currentStepIndex
                      ? "bg-blue-9 text-white font-bold"
                      : "bg-slate-4 text-slate-10 hover:text-slate-12 hover:bg-slate-5"
                  }`}
                  title={`Jump to ${s.title}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={endTour}
              className="text-slate-10 hover:text-slate-12 p-0.5 rounded hover:bg-slate-4 transition-colors"
              title="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* HUD Content Area */}
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h4 className="text-title-section text-slate-12 font-semibold">
                {step.title}
              </h4>
              <span className="text-ui-xs text-blue-11 font-mono truncate hidden sm:inline">
                [{step.targetElementText}]
              </span>
            </div>

            <p className="text-ui text-slate-11 leading-relaxed">
              {step.instruction}
            </p>

            <div className="p-2 rounded bg-slate-3 border border-slate-5 text-ui-xs text-slate-10 flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-9 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-12">Hands-on task: </strong>
                {step.handsOnTask}
              </span>
            </div>
          </div>

          {/* Action Buttons Right */}
          <div className="flex items-center gap-2 shrink-0 md:pl-4 md:border-l md:border-slate-5">
            {!isFirst && (
              <Button
                variant="secondary"
                size="sm"
                onClick={prevStep}
                className="flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </Button>
            )}

            <Button
              variant="primary"
              size="default"
              onClick={nextStep}
              className="flex items-center gap-2 font-medium"
            >
              <span>{step.actionButtonText}</span>
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

