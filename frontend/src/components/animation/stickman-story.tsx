"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Calculator,
  KeyRound,
  Sparkles,
  DollarSign,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Scene {
  title: string;
  tag: string;
  tagColor: string;
  speech: string;
  detail: string;
  highlight: string;
}

const SCENES: Scene[] = [
  {
    title: "1. The Invoice Ingestion",
    tag: "INGEST_DATA",
    tagColor: "bg-blue-3 border-blue-6 text-blue-11",
    speech: "Here's Invoice #INV-20418 for $1,250.00!",
    detail: "Vendor submits an invoice. DelTix reads raw PDF tables, line items, and bank routing credentials into structured data.",
    highlight: "Raw PDF extracted: Freight $450 + Customs $600 + Handling $200",
  },
  {
    title: "2. Zero-Hallucination Math Proof",
    tag: "DETERMINISTIC_MATH",
    tagColor: "bg-green-3 border-green-6 text-green-11",
    speech: "Computing: 450.00 + 600.00 + 200.00 = $1,250.00 exact!",
    detail: "The AI agent NEVER does mental math. Arithmetic is executed via Python AST Decimals with 0-cent error tolerance.",
    highlight: "Decimal('450.00') + Decimal('600.00') + Decimal('200.00') == Decimal('1250.00')",
  },
  {
    title: "3. Hard Spend Policy Shield",
    tag: "POLICY_GATE",
    tagColor: "bg-amber-3 border-amber-6 text-amber-11",
    speech: "Halt! $1,250.00 exceeds our $500 auto-disbursement cap!",
    detail: "Deterministic policy rules outside the LLM halt execution safely into PAUSED_FOR_APPROVAL without holding DB locks.",
    highlight: "Rule triggered: amount_usd > max_budget_usd (1250.00 > 500.00)",
  },
  {
    title: "4. Human Controller Dual-Key Sign",
    tag: "HMAC_RELEASE",
    tagColor: "bg-purple-3 border-purple-6 text-purple-11",
    speech: "Line items verified against contract PO. Signed with HMAC token!",
    detail: "Human controller reviews invoice grounding and stamps a cryptographic HMAC signature (atok_live_...).",
    highlight: "HMAC_SHA256 signature minted: atok_live_9941_sig",
  },
  {
    title: "5. Safe PayPal Disbursement",
    tag: "TOOL_DISPATCH",
    tagColor: "bg-green-3 border-green-6 text-green-11",
    speech: "Disbursed via PayPal! Vendor settled with zero double-charge risk.",
    detail: "Pre-recorded intent in PostgreSQL prevents duplicate payouts. The vendor receives immediate funds.",
    highlight: "Settled in 1.4s via PayPal Payouts (Tx: PAYID-MN34091)",
  },
];

export function StickmanStory() {
  const [activeScene, setActiveScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveScene((prev) => (prev + 1) % SCENES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const scene = SCENES[activeScene];

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl bg-gradient-to-b from-slate-2 to-slate-1 border border-slate-5/80 shadow-2xl overflow-hidden select-none">
      {/* Top Scene Navigation Strip */}
      <div className="px-5 py-3 border-b border-slate-5/80 bg-slate-2/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-9 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-9" />
          </span>
          <span className="font-mono text-ui-xs font-semibold text-slate-12">
            DELTIX WORKFLOW ANIMATION
          </span>
          <span className="text-slate-8">•</span>
          <span className="text-ui-xs text-slate-10 font-mono">
            SCENE {activeScene + 1} OF {SCENES.length}
          </span>
        </div>

        {/* Play/Pause & Reset Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-7 px-2.5 text-ui-xs text-slate-10 hover:text-slate-12 hover:bg-slate-3"
          >
            {isPlaying ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            <span>{isPlaying ? "Pause" : "Play Story"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveScene(0);
              setIsPlaying(true);
            }}
            className="h-7 w-7 p-0 text-slate-10 hover:text-slate-12 hover:bg-slate-3"
            title="Restart from beginning"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main Animated Stage (SVG Canvas) */}
      <div className="relative w-full h-[260px] bg-slate-1/90 flex items-center justify-center overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Ambient colored lighting based on scene */}
        <div
          className={`absolute w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700 ${
            activeScene === 0
              ? "bg-blue-9"
              : activeScene === 1
              ? "bg-green-9"
              : activeScene === 2
              ? "bg-amber-9"
              : activeScene === 3
              ? "bg-purple-9"
              : "bg-emerald-9"
          }`}
        />

        {/* Fluid SVG Character Stage */}
        <svg viewBox="0 0 600 240" className="w-full h-full max-h-[250px] relative z-10">
          {/* Ground Runway with subtle graduation */}
          <line x1="30" y1="185" x2="570" y2="185" stroke="var(--slate6)" strokeWidth="2" />
          <line x1="120" y1="188" x2="480" y2="188" stroke="var(--slate5)" strokeWidth="1" strokeDasharray="6 6" />

          {/* SCENE 0: Vendor arrives with Invoice */}
          {activeScene === 0 && (
            <g className="animate-in fade-in zoom-in-95 duration-300">
              {/* Vendor Stickman */}
              <circle cx="140" cy="105" r="14" stroke="var(--slate12)" strokeWidth="2.5" fill="var(--slate3)" />
              {/* Friendly eyes */}
              <circle cx="144" cy="103" r="1.5" fill="var(--slate12)" />
              <line x1="140" y1="119" x2="140" y2="155" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="140" y1="130" x2="180" y2="135" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="140" y1="130" x2="115" y2="145" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="140" y1="155" x2="125" y2="185" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="140" y1="155" x2="155" y2="185" stroke="var(--slate12)" strokeWidth="2.5" />
              <text x="140" y="82" textAnchor="middle" fill="var(--slate10)" fontSize="12" fontWeight="600" fontFamily="sans-serif">
                Vendor
              </text>

              {/* Glowing Invoice Document in Hand */}
              <g className="animate-bounce" style={{ animationDuration: "2s" }}>
                <rect x="185" y="115" width="28" height="38" rx="3" fill="var(--slate2)" stroke="var(--blue9)" strokeWidth="2" />
                <line x1="191" y1="123" x2="207" y2="123" stroke="var(--blue11)" strokeWidth="1.5" />
                <line x1="191" y1="129" x2="203" y2="129" stroke="var(--slate10)" strokeWidth="1.5" />
                <line x1="191" y1="135" x2="205" y2="135" stroke="var(--slate10)" strokeWidth="1.5" />
                <text x="194" y="147" fill="var(--blue11)" fontSize="9" fontWeight="bold" fontFamily="monospace">$</text>
              </g>

              {/* Ingestion beam particles */}
              <line x1="218" y1="134" x2="365" y2="134" stroke="var(--blue9)" strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />

              {/* DelTix AI Agent Stickman */}
              <circle cx="400" cy="105" r="14" stroke="var(--blue9)" strokeWidth="2.5" fill="var(--blue3)" />
              <circle cx="396" cy="103" r="1.5" fill="var(--blue11)" />
              <line x1="400" y1="119" x2="400" y2="155" stroke="var(--blue9)" strokeWidth="2.5" />
              <line x1="400" y1="130" x2="365" y2="135" stroke="var(--blue9)" strokeWidth="2.5" />
              <line x1="400" y1="130" x2="425" y2="145" stroke="var(--blue9)" strokeWidth="2.5" />
              <line x1="400" y1="155" x2="385" y2="185" stroke="var(--blue9)" strokeWidth="2.5" />
              <line x1="400" y1="155" x2="415" y2="185" stroke="var(--blue9)" strokeWidth="2.5" />
              <text x="400" y="82" textAnchor="middle" fill="var(--blue11)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
                DelTix AI Agent
              </text>
            </g>
          )}

          {/* SCENE 1: Deterministic Math Chalkboard */}
          {activeScene === 1 && (
            <g className="animate-in fade-in zoom-in-95 duration-300">
              {/* Agent working on blackboard */}
              <circle cx="160" cy="105" r="14" stroke="var(--green9)" strokeWidth="2.5" fill="var(--green3)" />
              <circle cx="165" cy="103" r="1.5" fill="var(--green11)" />
              <line x1="160" y1="119" x2="160" y2="155" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="160" y1="130" x2="200" y2="120" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="160" y1="130" x2="145" y2="145" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="160" y1="155" x2="145" y2="185" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="160" y1="155" x2="175" y2="185" stroke="var(--green9)" strokeWidth="2.5" />
              <text x="160" y="82" textAnchor="middle" fill="var(--green11)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
                Math Engine
              </text>

              {/* Glowing High-Precision Calculator Blackboard */}
              <rect x="215" y="80" width="240" height="85" rx="8" fill="var(--slate2)" stroke="var(--green9)" strokeWidth="2" />
              <text x="230" y="103" fill="var(--slate10)" fontSize="11" fontFamily="monospace">
                AST Decimal Recomputation:
              </text>
              <text x="230" y="124" fill="var(--slate12)" fontSize="13" fontFamily="monospace">
                $450.00 + $600.00 + $200.00
              </text>
              <text x="230" y="148" fill="var(--green11)" fontSize="16" fontWeight="bold" fontFamily="monospace">
                = $1,250.00 USD ✓
              </text>
              <text x="400" y="148" fill="var(--slate9)" fontSize="10" fontFamily="sans-serif">
                (0.00% variance)
              </text>
            </g>
          )}

          {/* SCENE 2: Policy Shield Gate drops */}
          {activeScene === 2 && (
            <g className="animate-in fade-in zoom-in-95 duration-300">
              {/* Agent raising hand in halt */}
              <circle cx="170" cy="105" r="14" stroke="var(--amber9)" strokeWidth="2.5" fill="var(--amber3)" />
              <line x1="170" y1="119" x2="170" y2="155" stroke="var(--amber9)" strokeWidth="2.5" />
              <line x1="170" y1="130" x2="205" y2="125" stroke="var(--amber9)" strokeWidth="2.5" />
              <line x1="170" y1="130" x2="150" y2="145" stroke="var(--amber9)" strokeWidth="2.5" />
              <line x1="170" y1="155" x2="155" y2="185" stroke="var(--amber9)" strokeWidth="2.5" />
              <line x1="170" y1="155" x2="185" y2="185" stroke="var(--amber9)" strokeWidth="2.5" />
              <text x="170" y="82" textAnchor="middle" fill="var(--amber11)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
                Policy Intercept
              </text>

              {/* Massive Protective Shield */}
              <path
                d="M 285 70 Q 335 55 385 70 Q 385 130 335 165 Q 285 130 285 70 Z"
                fill="var(--amber3)"
                stroke="var(--amber9)"
                strokeWidth="2.5"
              />
              <text x="335" y="105" textAnchor="middle" fill="var(--amber12)" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
                HALT SAFE
              </text>
              <text x="335" y="125" textAnchor="middle" fill="var(--amber11)" fontSize="11" fontWeight="bold" fontFamily="monospace">
                &gt; $500.00 CAP
              </text>
              <text x="335" y="142" textAnchor="middle" fill="var(--amber10)" fontSize="9" fontFamily="sans-serif">
                Paused for Human Sign-off
              </text>
            </g>
          )}

          {/* SCENE 3: Controller Signs with HMAC Stamp */}
          {activeScene === 3 && (
            <g className="animate-in fade-in zoom-in-95 duration-300">
              {/* Human Controller Stickman */}
              <circle cx="160" cy="105" r="14" stroke="var(--purple9)" strokeWidth="2.5" fill="var(--purple3)" />
              <circle cx="165" cy="103" r="1.5" fill="var(--purple11)" />
              <line x1="160" y1="119" x2="160" y2="155" stroke="var(--purple9)" strokeWidth="2.5" />
              <line x1="160" y1="130" x2="200" y2="135" stroke="var(--purple9)" strokeWidth="2.5" />
              <line x1="160" y1="130" x2="140" y2="145" stroke="var(--purple9)" strokeWidth="2.5" />
              <line x1="160" y1="155" x2="145" y2="185" stroke="var(--purple9)" strokeWidth="2.5" />
              <line x1="160" y1="155" x2="175" y2="185" stroke="var(--purple9)" strokeWidth="2.5" />
              <text x="160" y="82" textAnchor="middle" fill="var(--purple11)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
                Controller (You)
              </text>

              {/* Cryptographic Stamp Card */}
              <rect x="215" y="95" width="180" height="60" rx="6" fill="var(--slate2)" stroke="var(--purple9)" strokeWidth="2" />
              <text x="230" y="118" fill="var(--purple11)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
                ✓ DUAL-KEY AUTHORIZED
              </text>
              <text x="230" y="138" fill="var(--slate10)" fontSize="10" fontFamily="monospace">
                HMAC: atok_live_9941_sig
              </text>
            </g>
          )}

          {/* SCENE 4: Safe PayPal Settlement & Transfer */}
          {activeScene === 4 && (
            <g className="animate-in fade-in zoom-in-95 duration-300">
              {/* Happy Controller */}
              <circle cx="120" cy="105" r="14" stroke="var(--green9)" strokeWidth="2.5" fill="var(--green3)" />
              <line x1="120" y1="119" x2="120" y2="155" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="120" y1="130" x2="150" y2="120" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="120" y1="130" x2="95" y2="120" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="120" y1="155" x2="105" y2="185" stroke="var(--green9)" strokeWidth="2.5" />
              <line x1="120" y1="155" x2="135" y2="185" stroke="var(--green9)" strokeWidth="2.5" />
              <text x="120" y="82" textAnchor="middle" fill="var(--green11)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
                Controller
              </text>

              {/* Glowing Flying Coin */}
              <g className="animate-pulse">
                <circle cx="280" cy="130" r="18" fill="var(--green3)" stroke="var(--green9)" strokeWidth="2" />
                <text x="280" y="137" textAnchor="middle" fill="var(--green11)" fontSize="16" fontWeight="bold" fontFamily="monospace">
                  $
                </text>
                {/* Movement line */}
                <line x1="160" y1="130" x2="255" y2="130" stroke="var(--green9)" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="305" y1="130" x2="400" y2="130" stroke="var(--green9)" strokeWidth="1.5" strokeDasharray="4 4" />
              </g>

              {/* Delighted Vendor receiving payment */}
              <circle cx="440" cy="105" r="14" stroke="var(--slate12)" strokeWidth="2.5" fill="var(--slate3)" />
              <circle cx="436" cy="103" r="1.5" fill="var(--slate12)" />
              <line x1="440" y1="119" x2="440" y2="155" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="440" y1="130" x2="410" y2="120" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="440" y1="130" x2="470" y2="120" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="440" y1="155" x2="425" y2="185" stroke="var(--slate12)" strokeWidth="2.5" />
              <line x1="440" y1="155" x2="455" y2="185" stroke="var(--slate12)" strokeWidth="2.5" />
              <text x="440" y="82" textAnchor="middle" fill="var(--green11)" fontSize="12" fontWeight="bold" fontFamily="sans-serif">
                Vendor Paid!
              </text>
            </g>
          )}

          {/* Speech dialogue bubble floating above characters */}
          <rect x="130" y="16" width="340" height="38" rx="6" fill="var(--panel-bg)" stroke="var(--slate5)" strokeWidth="1.5" />
          <polygon points="280,54 290,64 300,54" fill="var(--panel-bg)" stroke="var(--slate5)" strokeWidth="1.5" />
          <text x="300" y="40" textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="500" fontFamily="sans-serif">
            {scene.speech}
          </text>
        </svg>

        {/* Step dots navigation */}
        <div className="absolute bottom-3 left-5 flex items-center gap-1.5 z-20">
          {SCENES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setActiveScene(idx);
                setIsPlaying(false);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === activeScene ? "w-7 bg-blue-9" : "w-2 bg-slate-6 hover:bg-slate-5"
              }`}
              title={`Jump to scene ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Detail Footer */}
      <div className="p-5 bg-panel/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-5/80">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-title-section text-slate-12 font-semibold">{scene.title}</span>
            <span className={`font-mono text-ui-xs px-2 py-0.5 rounded border ${scene.tagColor}`}>
              {scene.tag}
            </span>
          </div>
          <p className="text-ui-xs text-slate-10 leading-relaxed">
            {scene.detail}
          </p>
          <div className="text-[11px] font-mono text-slate-11 pt-1 flex items-center gap-1.5">
            <span className="text-slate-9 font-sans">Under the hood:</span>
            <code className="text-blue-11">{scene.highlight}</code>
          </div>
        </div>

        {/* Step Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setActiveScene((prev) => (prev > 0 ? prev - 1 : SCENES.length - 1));
              setIsPlaying(false);
            }}
          >
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setActiveScene((prev) => (prev + 1) % SCENES.length);
              setIsPlaying(false);
            }}
            className="flex items-center gap-1"
          >
            <span>Next</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
