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
  X,
  Mail,
  Calendar,
  Building,
} from "lucide-react";
import { StickmanStory } from "@/components/animation/stickman-story";
import { InteractiveSimulator } from "@/components/animation/interactive-simulator";
import { Button } from "@/components/ui/button";
import { useTourStore } from "@/lib/tour-store";

const SAMPLE_PROMPTS = [
  {
    label: "E-Com Refunds",
    prompt: "Refund e-commerce orders under $50 automatically via PayPal; escalate >$50 to manager",
    spendCap: "$500.00",
    threshold: "$50.00",
  },
  {
    label: "Vendor Invoicing",
    prompt: "Verify incoming vendor invoice against signed PO line items using exact Decimal math; disburse up to $250 automatically",
    spendCap: "$2,500.00",
    threshold: "$250.00",
  },
  {
    label: "Dispute Mitigation",
    prompt: "Check PayPal chargeback against delivery confirmation transcript; auto-credit customer concession if trust score > 0.9",
    spendCap: "$400.00",
    threshold: "$40.00",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { startTour } = useTourStore();
  const [activeTab, setActiveTab] = useState<"playground" | "story" | "simulator">("playground");
  const [playgroundPrompt, setPlaygroundPrompt] = useState(SAMPLE_PROMPTS[0].prompt);
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const handleLaunchTour = () => {
    startTour();
    router.push("/dashboard");
  };

  const handleSelectPreset = (idx: number) => {
    setActivePresetIndex(idx);
    setPlaygroundPrompt(SAMPLE_PROMPTS[idx].prompt);
  };

  return (
    <div className="min-h-screen bg-app text-slate-12 flex flex-col select-none relative overflow-x-hidden">
      {/* Subtle Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-9/10 via-transparent to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-5 bg-panel/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-btn bg-slate-12 text-slate-1 flex items-center justify-center font-bold text-xs shadow-sm">
              Δ
            </div>
            <span className="font-semibold text-slate-12 tracking-tight text-sm sm:text-base">
              DelTix
            </span>
          </Link>

          {/* Navigation Links (Smooth scroll) */}
          <nav className="hidden md:flex items-center gap-5 text-xs text-slate-10 font-medium">
            <a href="#platform" className="hover:text-slate-12 transition-colors">
              Platform
            </a>
            <a href="#guardrails" className="hover:text-slate-12 transition-colors">
              Guardrails
            </a>
            <a href="#pricing" className="hover:text-slate-12 transition-colors">
              Pricing
            </a>
            <a href="#docs" className="hover:text-slate-12 transition-colors">
              Docs
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-11 hover:text-slate-12 hidden sm:flex"
            >
              Dashboard
            </Button>
          </Link>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDemoModalOpen(true)}
            className="text-xs font-medium"
          >
            Book Demo
          </Button>

          <Link href="/dashboard">
            <Button
              variant="primary"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            >
              <span>Sign In with Google</span>
              <ArrowRight className="h-3 w-3 text-black" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 space-y-14">
        {/* Hero Section */}
        <section className="text-center space-y-5 max-w-3xl mx-auto pt-2">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-2 border border-slate-5 text-ui-xs font-mono text-slate-11 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-9 animate-pulse" />
            <span>Autonomous Financial AI Agents with Zero Hallucinations</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-12 leading-[1.15]">
            Compile natural language into{" "}
            <span className="text-blue-11">mathematically verified payment workflows.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-ui text-slate-10 max-w-xl mx-auto leading-relaxed">
            DelTix synthesizes financial requirements into deterministic execution DAGs. It verifies
            invoices with exact Python AST Decimals, enforces strict company spend limits, and pauses for human
            dual-key signoff before money leaves your account.
          </p>

          {/* Primary CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Link href="/studio/new">
              <Button
                variant="primary"
                size="lg"
                className="flex items-center gap-2 h-10 px-5 text-ui font-semibold shadow-md"
              >
                <Sparkles className="h-4 w-4 text-black" />
                <span>Enter Studio (Free Sandbox)</span>
                <ArrowRight className="h-3.5 w-3.5 text-black" />
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setDemoModalOpen(true)}
              className="h-10 px-4 text-ui font-medium border-slate-5 hover:border-slate-7 text-slate-12"
            >
              Book Enterprise Demo
            </Button>
          </div>

          {/* Key Metrics Strip */}
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

        {/* Interactive Showcase: Hero Playground + Story + Simulator */}
        <section id="platform" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-5 pb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-12 tracking-tight">
                Interactive Product Showcase
              </h2>
              <p className="text-ui-xs text-slate-10">
                Test guardrails before signing in, explore the visual story guide, or simulate live policy gates.
              </p>
            </div>

            {/* Segmented Controller */}
            <div className="inline-flex p-1 rounded-lg bg-slate-2 border border-slate-5 self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("playground")}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === "playground"
                    ? "bg-slate-4 text-slate-12 shadow-sm"
                    : "text-slate-10 hover:text-slate-12"
                }`}
              >
                <Sparkles className="h-3 w-3 text-blue-9" />
                <span>Prompt Playground</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("story")}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
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
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
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

          {/* Active Tab View */}
          <div className="pt-2">
            {activeTab === "playground" ? (
              <div className="p-6 bg-panel border border-slate-5 rounded-card space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-11 uppercase tracking-wider">
                      1. Choose or type a sample financial requirement:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {SAMPLE_PROMPTS.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelectPreset(i)}
                          className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                            activePresetIndex === i
                              ? "bg-blue-3 border-blue-6 text-blue-11 font-medium"
                              : "bg-slate-2 border-slate-5 text-slate-10 hover:text-slate-12"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={playgroundPrompt}
                    onChange={(e) => setPlaygroundPrompt(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-slate-2 border border-slate-5 rounded-btn text-xs text-slate-12 font-mono leading-relaxed focus:outline-none focus:border-slate-8 resize-none"
                  />
                </div>

                {/* 2. Live Guardrail Verification Preview */}
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-slate-11 uppercase tracking-wider block">
                    2. Live Guardrail Verification Preview:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 rounded bg-slate-2 border border-slate-5 space-y-1">
                      <div className="flex items-center gap-2 text-green-11 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Graph Cycle Detection: Safe DAG</span>
                      </div>
                      <div className="text-[11px] text-slate-10">
                        0 Infinite Loops &bull; Kahn Algorithm Topologically Sorted
                      </div>
                    </div>

                    <div className="p-3 rounded bg-slate-2 border border-slate-5 space-y-1">
                      <div className="flex items-center gap-2 text-green-11 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Deterministic Math AST: Python Decimal</span>
                      </div>
                      <div className="text-[11px] text-slate-10">
                        Exact Precision &bull; 0 Floating-Point Rounding Errors
                      </div>
                    </div>

                    <div className="p-3 rounded bg-slate-2 border border-slate-5 space-y-1">
                      <div className="flex items-center gap-2 text-green-11 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Spend Policy Engine: Fail-Closed</span>
                      </div>
                      <div className="text-[11px] text-slate-10">
                        Max Cap {SAMPLE_PROMPTS[activePresetIndex].spendCap} &bull; Human Gate at {SAMPLE_PROMPTS[activePresetIndex].threshold}
                      </div>
                    </div>

                    <div className="p-3 rounded bg-slate-2 border border-slate-5 space-y-1">
                      <div className="flex items-center gap-2 text-green-11 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>PII Redaction &amp; HMAC Seal</span>
                      </div>
                      <div className="text-[11px] text-slate-10">
                        Payment Cards &amp; Auth Headers Auto-Sanitized
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-5">
                  <span className="text-xs text-slate-10">
                    Ready to build and test this agent in the full studio?
                  </span>
                  <Link href="/studio/new">
                    <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                      <span>Open in Compiler Studio</span>
                      <ArrowRight className="h-3.5 w-3.5 text-black" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : activeTab === "story" ? (
              <StickmanStory />
            ) : (
              <InteractiveSimulator />
            )}
          </div>
        </section>

        {/* 3 Core Architectural Pillars (Guardrails Section) */}
        <section id="guardrails" className="space-y-4 pt-4">
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

        {/* Pricing Section Anchor */}
        <section id="pricing" className="p-6 sm:p-8 rounded-xl bg-panel border border-slate-5 space-y-4">
          <div className="text-center space-y-1 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-12">
              Transparent Financial Engineering Pricing
            </h2>
            <p className="text-ui-xs text-slate-10">
              Free in developer sandbox. Scale with institutional safety in production.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto pt-2">
            <div className="p-5 rounded-card bg-slate-2 border border-slate-5 space-y-3">
              <div className="font-semibold text-slate-12">Developer Sandbox</div>
              <div className="text-2xl font-bold font-mono text-slate-12">$0 / mo</div>
              <ul className="text-xs text-slate-10 space-y-1.5 font-mono">
                <li>&bull; Unlimited Agent Compilations</li>
                <li>&bull; PayPal Sandbox Adapter</li>
                <li>&bull; Python Decimal AST Engine</li>
                <li>&bull; Live SSE Execution Telemetry</li>
              </ul>
              <Link href="/studio/new" className="block pt-2">
                <Button variant="secondary" className="w-full text-xs">
                  Start in Sandbox
                </Button>
              </Link>
            </div>

            <div className="p-5 rounded-card bg-slate-3/60 border border-blue-6/60 space-y-3">
              <div className="font-semibold text-slate-12 flex items-center justify-between">
                <span>Enterprise Production</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-3 border border-blue-6 text-blue-11">
                  SOC2 / PCI
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-12">Custom Payout Vol</div>
              <ul className="text-xs text-slate-10 space-y-1.5 font-mono">
                <li>&bull; Dual-Key Multi-Sig Approvals</li>
                <li>&bull; Hardware Security Module (HSM)</li>
                <li>&bull; Dedicated Tenant Isolation</li>
                <li>&bull; 24/7 FinTech SLA Support</li>
              </ul>
              <div className="pt-2">
                <Button
                  variant="primary"
                  onClick={() => setDemoModalOpen(true)}
                  className="w-full text-xs font-semibold"
                >
                  Contact Enterprise Team
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Docs Section Anchor */}
        <section id="docs" className="p-6 rounded-xl bg-panel border border-slate-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-12">
              Comprehensive Developer &amp; End-User Manual
            </h3>
            <p className="text-xs text-slate-10 mt-1">
              Read the full specifications for Screens 1–6, LangGraph runtime, and PayPal adapter contracts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="secondary" size="sm" className="text-xs">
                Open Console
              </Button>
            </Link>
            <Link href="/studio/new">
              <Button variant="primary" size="sm" className="text-xs">
                Compile First Agent
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Clean Hairline Footer */}
      <footer className="border-t border-slate-5 py-6 px-4 text-center text-ui-xs text-slate-10 bg-panel/30">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-12">DelTix</span>
            <span>&bull;</span>
            <span>Deterministic Agentic Financial Control Plane</span>
          </div>
          <div className="font-mono text-slate-10 text-[11px]">
            Go 1.23 &bull; Python 3.12 LangGraph &bull; Supabase PostgreSQL 16
          </div>
        </div>
      </footer>

      {/* Book Enterprise Demo Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-panel border border-slate-5 rounded-card p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-12">
                  Book Enterprise Institutional Demo
                </h3>
                <p className="text-xs text-slate-10 mt-0.5">
                  Consult with DelTix financial engineers on SOC2 compliance and spend caps.
                </p>
              </div>
              <button
                onClick={() => setDemoModalOpen(false)}
                className="text-slate-9 hover:text-slate-12 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-10 mb-1">Company Email</label>
                <input
                  type="email"
                  placeholder="controller@acmepayments.com"
                  className="w-full px-3 py-1.5 bg-slate-2 border border-slate-5 rounded text-slate-12 font-mono focus:outline-none focus:border-slate-8"
                />
              </div>
              <div>
                <label className="block text-slate-10 mb-1">Estimated Monthly Disbursement</label>
                <select className="w-full px-3 py-1.5 bg-slate-2 border border-slate-5 rounded text-slate-12 focus:outline-none focus:border-slate-8">
                  <option>&lt; $100,000 USD / month</option>
                  <option>$100,000 – $1,000,000 USD / month</option>
                  <option>&gt; $1,000,000 USD / month</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-5">
              <Button variant="ghost" size="sm" onClick={() => setDemoModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  alert("Thank you! A DelTix financial engineer will contact you shortly.");
                  setDemoModalOpen(false);
                }}
              >
                Schedule Demo Session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
