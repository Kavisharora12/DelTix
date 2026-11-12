"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Play,
  GitBranch,
  Sparkles,
  Loader2,
  ShieldCheck,
  Lock,
  ArrowDown,
} from "lucide-react";
import { AgentItem } from "@/types";
import { Button } from "@/components/ui/button";
import { api, BackendAgentSpec } from "@/lib/api";

interface AgentStudioProps {
  agent: AgentItem;
}

export function AgentStudio({ agent }: AgentStudioProps) {
  const router = useRouter();
  const [isLoadingSpec, setIsLoadingSpec] = useState(false);
  const [specDetail, setSpecDetail] = useState<BackendAgentSpec | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingSpec(true);
    setLoadError(null);
    setSpecDetail(null);

    api
      .getSpec(agent.id)
      .then((spec) => {
        if (!cancelled) {
          setSpecDetail(spec);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setLoadError(err?.message || "Failed to load specification details.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSpec(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  const compiledIR = specDetail?.agent_ir || specDetail?.ir_payload || null;
  const irNodes = Array.isArray(compiledIR?.nodes) ? compiledIR.nodes : [];
  const policies = compiledIR?.policies;
  const limits = compiledIR?.execution_limits;
  const capabilities = Array.isArray(compiledIR?.capabilities) ? compiledIR.capabilities : [];
  const validationErrors = specDetail?.validation_report?.errors || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-[#000000] select-none font-sans">
      {/* Top Header */}
      <div className="h-14 border-b border-[#232323] bg-[#050505] px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display text-[17px] text-white truncate">{agent.name}</span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#0C0C0C] border border-[#232323] text-[#979797] shrink-0">
            {agent.version}
          </span>
          <span className="text-[11px] font-mono text-[#6B6B6B] truncate hidden md:inline">
            {agent.id}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-ui-xs font-mono">
          {isLoadingSpec ? (
            <span className="flex items-center gap-1 text-slate-10">
              <Loader2 className="h-3 w-3 animate-spin" /> Syncing spec...
            </span>
          ) : validationErrors.length > 0 ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-3 border border-red-6 text-red-11">
              <AlertCircle className="h-3 w-3" /> {validationErrors.length} errors
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-3 border border-green-6 text-green-11 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Sealed &amp; Ready
            </span>
          )}
        </div>
      </div>

      {/* Single Clean Column: Compact Guardrails Strip + Workflow Steps */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 space-y-5 bg-[#000000]">
        {loadError && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/40 text-xs text-red-300">
            {loadError}
          </div>
        )}

        {/* Compact Guardrails Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="px-3.5 py-2.5 rounded-xl bg-[#080808] border border-[#232323]">
            <div className="text-[10px] text-[#898989] uppercase font-mono">Max Budget / Run</div>
            <div className="font-mono font-semibold text-sm text-white mt-0.5">
              {isLoadingSpec
                ? "..."
                : policies
                  ? `$${Number(policies.max_budget_usd ?? 0).toFixed(2)} USD`
                  : "Not set"}
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-[#080808] border border-[#232323]">
            <div className="text-[10px] text-[#898989] uppercase font-mono">Approval Gate</div>
            <div className="font-mono font-semibold text-sm text-white mt-0.5">
              {isLoadingSpec
                ? "..."
                : policies
                  ? policies.require_human_approval
                    ? "Human Sign-Off"
                    : "Auto-Execute"
                  : "Not set"}
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-[#080808] border border-[#232323]">
            <div className="text-[10px] text-[#898989] uppercase font-mono">Step Ceiling</div>
            <div className="font-mono font-semibold text-sm text-white mt-0.5">
              {isLoadingSpec
                ? "..."
                : limits?.max_steps
                  ? `${limits.max_steps} max steps`
                  : "Default (50)"}
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-[#080808] border border-[#232323]">
            <div className="text-[10px] text-[#898989] uppercase font-mono">Pre-Flight Tests</div>
            <div className="font-mono font-semibold text-sm text-emerald-400 mt-0.5">
              {isLoadingSpec
                ? "..."
                : specDetail?.validation_report
                  ? `${specDetail.validation_report.tests_passed} / ${specDetail.validation_report.tests_run} Passed`
                  : "Verified"}
            </div>
          </div>
        </div>

        {/* Permitted Capabilities (inline pills if any) */}
        {capabilities.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#898989] mr-1">
              Capabilities:
            </span>
            {capabilities.map((cap) => (
              <span
                key={cap.capability_id}
                className="px-2.5 py-1 rounded-md bg-[#E8602E]/10 border border-[#E8602E]/30 text-[11px] font-mono text-[#E8602E]"
              >
                {cap.capability_id}
              </span>
            ))}
          </div>
        )}

        {/* Workflow Steps */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#898989]">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-[#E8602E]" />
              <span>Compiled Workflow Steps ({irNodes.length})</span>
            </div>
            <span className="text-[#6B6B6B]">
              {specDetail?.category || compiledIR?.metadata?.category || "financial-workflow"}
            </span>
          </div>

          {isLoadingSpec ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#898989]">
              <Loader2 className="h-4 w-4 animate-spin text-[#E8602E]" />
              <span>Loading workflow steps...</span>
            </div>
          ) : irNodes.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6B6B6B]">
              No workflow steps found for this specification.
            </div>
          ) : (
            <div className="space-y-2">
              {irNodes.map((node: any, idx: number) => (
                <div
                  key={node.id || idx}
                  className="px-4 py-3 rounded-xl bg-[#080808] border border-[#232323] hover:border-[#3A3533] transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#141414] border border-[#2E2E2E] text-[11px] font-mono text-[#D4D4D4] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-[13px] font-medium text-white truncate">
                        {node.title || node.id.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </div>
                    {node.description && (
                      <p className="text-xs text-[#898989] mt-1 pl-7.5 line-clamp-1">
                        {node.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {node.payload?.capability_id && (
                      <span className="text-[11px] font-mono text-[#898989] hidden sm:inline">
                        {node.payload.capability_id}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-[#E8602E]/10 border border-[#E8602E]/30 text-[10px] font-mono font-medium text-[#E8602E]">
                      {node.type || "STEP"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="h-12 border-t border-[#232323] bg-[#050505] px-5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          {validationErrors.length === 0 ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>Spec sealed &amp; ready for Live Sandbox</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400 font-medium">
              <AlertCircle className="h-4 w-4" />
              <span>{validationErrors.length} validation errors</span>
            </span>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => router.push(`/sandbox/${encodeURIComponent(agent.id)}`)}
          className="flex items-center gap-1.5 font-medium"
        >
          <Play className="h-3.5 w-3.5" />
          <span>Open in Live Sandbox &rarr;</span>
        </Button>
      </div>
    </div>
  );
}
