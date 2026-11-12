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
      className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[92%] max-w-2xl z-50 animate-in slide-in-from-bottom-4 duration-fast select-none"
    >
      <div className="bg-[#080808] border border-[#E8602E] rounded-xl shadow-2xl overflow-hidden text-xs">
        {/* HUD Top Bar */}
        <div className="px-3.5 py-1.5 bg-[#0C0C0C] border-b border-[#232323] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8602E] animate-ping" />
            <span className="font-mono font-semibold text-[#E8602E]">{step.featureBadge}</span>
            <span className="text-[#4E4A48]">•</span>
            <span className="text-[#898989] font-mono">
              {step.stepNumber}/{step.totalSteps}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Step jump buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {HANDS_ON_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={`h-4 px-1.5 rounded text-[10px] font-mono transition-colors ${
                    idx === currentStepIndex
                      ? "bg-[#E8602E] text-white font-bold"
                      : "bg-[#141414] border border-[#232323] text-[#898989] hover:text-white"
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
              className="text-[#898989] hover:text-white p-0.5 rounded hover:bg-[#161616] transition-colors"
              title="Close tour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* HUD Content Area */}
        <div className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <h4 className="text-[13px] text-white font-semibold truncate">
              {step.title}
            </h4>

            <p className="text-[12px] text-[#B5B5B5] leading-snug line-clamp-2">
              {step.instruction}
            </p>

            <div className="px-2 py-1 rounded-md bg-[#0E0E0E] border border-[#232323] text-[11px] text-[#979797] flex items-center gap-1.5 truncate">
              <Sparkles className="h-3 w-3 text-[#E8602E] shrink-0" />
              <span className="truncate">
                <strong className="text-white">Task: </strong>
                {step.handsOnTask}
              </span>
            </div>
          </div>

          {/* Action Buttons Right */}
          <div className="flex items-center gap-2 shrink-0 sm:pl-3 sm:border-l sm:border-[#232323]">
            {!isFirst && (
              <Button
                variant="secondary"
                size="sm"
                onClick={prevStep}
                className="h-8 px-2.5 text-xs flex items-center gap-1 bg-[#121212] border-[#232323] text-[#D4D4D4] hover:text-white"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Prev</span>
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={nextStep}
              className="h-8 px-3 text-xs flex items-center gap-1.5 font-medium bg-[#E8602E] hover:bg-[#d45222] text-white border-0"
            >
              <span>{step.actionButtonText.replace(/\s*→\s*$/, "")}</span>
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

