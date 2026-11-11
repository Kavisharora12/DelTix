"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Calculator,
  Play,
  Gamepad2,
  Lock,
  Layers,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  Sliders,
  ExternalLink,
  ChevronRight,
  Bot,
  FileCheck2,
} from "lucide-react";
import { StickmanStory } from "@/components/animation/stickman-story";
import { InteractiveSimulator } from "@/components/animation/interactive-simulator";
import { Button } from "@/components/ui/button";
import { useTourStore } from "@/lib/tour-store";

export default function LandingPage() {
  const router = useRouter();
  const { startTour } = useTourStore();
  const [activeTab, setActiveTab] = useState<"story" | "simulator">("story");

  const handleLaunchTour = () => {
    startTour();
    router.push("/agents");
  };

  return (
    <div className="min-h-screen bg-app text-slate-12 flex flex-col select-none relative overflow-x-hidden">
      {/* Subtle Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-9/10 via-transparent to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-5 bg-panel/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-btn bg-slate-12 text-slate-1 flex items-center justify-center font-bold text-xs shadow-sm">
            Δ
          </div>
          <span className="font-semibold text-slate-12 tracking-tight text-sm sm:text-base">
            DelTix
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-badge bg-blue-3 border border-blue-6 text-blue-11 font-medium hidden sm:inline-block">
            Console v1.2
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/runs")}
            className="text-ui-sm text-slate-11 hover:text-slate-12"
          >
            Direct Console
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleLaunchTour}
            className="flex items-center gap-1.5 text-ui-sm font-semibold shadow-sm"
          >
            <Gamepad2 className="h-3.5 w-3.5 text-black" />
            <span>Interactive Game Tour</span>
            <ArrowRight className="h-3 w-3 text-black" />
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 space-y-14">
        {/* Hero Section */}
        <section className="text-center space-y-5 max-w-3xl mx-auto pt-2">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-2 border border-slate-5 text-ui-xs font-mono text-slate-11 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-9 animate-pulse" />
            <span>Deterministic Agentic Financial Control Plane</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-12 leading-[1.15]">
            Move real money with AI agents,{" "}
            <span className="text-blue-11">guaranteed zero hallucinations.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-ui text-slate-10 max-w-xl mx-auto leading-relaxed">
            DelTix synthesizes financial workflows into deterministic execution DAGs. It verifies
            invoices with exact AST Decimals, enforces strict company spend limits, and pauses for human
            dual-key signoff before money leaves your account.
          </p>

          {/* Primary CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button
              variant="primary"
              size="lg"
              onClick={handleLaunchTour}
              className="flex items-center gap-2 h-10 px-5 text-ui font-semibold shadow-md"
            >
              <Gamepad2 className="h-4 w-4 text-black" />
              <span>Start Hands-On Tour Guide</span>
              <ArrowRight className="h-3.5 w-3.5 text-black" />
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => router.push("/runs")}
              className="h-10 px-4 text-ui font-medium border-slate-5 hover:border-slate-7 text-slate-12"
            >
              Open Operations Console
            </Button>
          </div>

          {/* Key Metrics Strip (Clean hairline, tabular nums) */}
          <div className="pt-6 border-t border-slate-5/70 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto text-center">
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-12 tabular-nums">
                $42.8M+
              </div>
              <div className="text-[11px] text-slate-10 mt-0.5">Disbursed Safely</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-11 tabular-nums">
                0.00%
              </div>
              <div className="text-[11px] text-slate-10 mt-0.5">Math Variance</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-blue-11 tabular-nums">
                14,200+
              </div>
              <div className="text-[11px] text-slate-10 mt-0.5">Dual-Key Approvals</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-12 tabular-nums">
                99.99%
              </div>
              <div className="text-[11px] text-slate-10 mt-0.5">Idempotent Settlement</div>
            </div>
          </div>
        </section>

        {/* Unified Interactive Showcase: Segmented Switcher */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-5 pb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-12 tracking-tight">
                Interactive Product Showcase
              </h2>
              <p className="text-ui-xs text-slate-10">
                Switch between the visual stickman story guide and the live policy simulator.
              </p>
            </div>

            {/* Segmented Controller */}
            <div className="inline-flex p-1 rounded-lg bg-slate-2 border border-slate-5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab("story")}
                className={`px-3 py-1.5 rounded-md text-ui-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === "story"
                    ? "bg-slate-4 text-slate-12 shadow-sm"
                    : "text-slate-10 hover:text-slate-12"
                }`}
              >
                <span>Stickman Story Guide</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("simulator")}
                className={`px-3 py-1.5 rounded-md text-ui-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === "simulator"
                    ? "bg-slate-4 text-slate-12 shadow-sm"
                    : "text-slate-10 hover:text-slate-12"
                }`}
              >
                <Zap className="h-3 w-3 text-amber-10" />
                <span>Live Policy Simulator</span>
              </button>
            </div>
          </div>

          {/* Active Interactive Component */}
          <div className="pt-2">
            {activeTab === "story" ? (
              <StickmanStory />
            ) : (
              <InteractiveSimulator />
            )}
          </div>
        </section>

        {/* 3 Core Architectural Pillars */}
        <section className="space-y-4 pt-4">
          <div className="text-center space-y-1 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-12">
              Engineered for Zero Financial Risk
            </h2>
            <p className="text-ui-xs text-slate-10">
              Three sovereign guarantees that separate DelTix from generic LLM wrappers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pillar 1: Deterministic AST Math */}
            <div className="p-5 rounded-xl bg-panel border border-slate-5 space-y-3 flex flex-col justify-between hover:border-slate-6 transition-colors">
              <div>
                <div className="w-7 h-7 rounded-btn bg-emerald-3 border border-emerald-6 text-emerald-11 flex items-center justify-center mb-2.5">
                  <Calculator className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-ui font-semibold text-slate-12">
                  Deterministic AST Math
                </h3>
                <p className="text-ui-xs text-slate-10 leading-relaxed mt-1">
                  LLM mental math is strictly prohibited. Numbers are extracted to high-precision
                  Python AST Decimals with 0-cent variance tolerance before entering policy gates.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-5/50 font-mono text-[11px] text-emerald-11">
                Invariant: 0.00% Variance
              </div>
            </div>

            {/* Pillar 2: Fail-Closed Policy Matrix */}
            <div className="p-5 rounded-xl bg-panel border border-slate-5 space-y-3 flex flex-col justify-between hover:border-slate-6 transition-colors">
              <div>
                <div className="w-7 h-7 rounded-btn bg-amber-3 border border-amber-6 text-amber-11 flex items-center justify-center mb-2.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-ui font-semibold text-slate-12">
                  Fail-Closed Policy Matrix
                </h3>
                <p className="text-ui-xs text-slate-10 leading-relaxed mt-1">
                  Company spend caps, daily volume velocity, and vendor allowlists are enforced
                  outside the model. Any policy exception pauses execution safely without holding DB locks.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-5/50 font-mono text-[11px] text-amber-11">
                Rule: Fail-Closed
              </div>
            </div>

            {/* Pillar 3: Dual-Key Cryptographic Signoff */}
            <div className="p-5 rounded-xl bg-panel border border-slate-5 space-y-3 flex flex-col justify-between hover:border-slate-6 transition-colors">
              <div>
                <div className="w-7 h-7 rounded-btn bg-purple-3 border border-purple-6 text-purple-11 flex items-center justify-center mb-2.5">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-ui font-semibold text-slate-12">
                  Dual-Key Cryptographic Signoff
                </h3>
                <p className="text-ui-xs text-slate-10 leading-relaxed mt-1">
                  Separation of duties: initiators cannot approve their own runs. Approvers inspect
                  grounded citations and mint signed HMAC tokens required by the payout gateway.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-5/50 font-mono text-[11px] text-purple-11">
                Security: HMAC-SHA256
              </div>
            </div>
          </div>
        </section>

        {/* Streamlined Bottom Action Card */}
        <section className="p-6 sm:p-8 rounded-xl bg-panel border border-slate-5 text-center space-y-3 shadow-lg">
          <h3 className="text-lg sm:text-xl font-bold text-slate-12 tracking-tight">
            Ready to explore the operations console?
          </h3>
          <p className="text-ui-sm text-slate-10 max-w-md mx-auto leading-relaxed">
            The hands-on game tour guides you step-by-step through Agent Studio, Policies, Runs DAG, Approvals, and Ledger.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="default"
              onClick={handleLaunchTour}
              className="flex items-center gap-2 font-semibold shadow-sm"
            >
              <Gamepad2 className="h-4 w-4 text-black" />
              <span>Launch Hands-On Game Tour</span>
              <ArrowRight className="h-3.5 w-3.5 text-black" />
            </Button>
            <Button
              variant="secondary"
              size="default"
              onClick={() => router.push("/runs")}
              className="border-slate-5 hover:border-slate-7 text-slate-12"
            >
              Skip Directly to Runs HUD
            </Button>
          </div>
        </section>
      </main>

      {/* Clean Hairline Footer */}
      <footer className="border-t border-slate-5 py-6 px-4 text-center text-ui-xs text-slate-10 bg-panel/30">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-12">DelTix</span>
            <span>•</span>
            <span>Deterministic Agentic Financial Control Plane</span>
          </div>
          <div className="font-mono text-slate-10 text-[11px]">
            Go 1.23 • Python 3.12 LangGraph • Supabase pgvector
          </div>
        </div>
      </footer>
    </div>
  );
}
