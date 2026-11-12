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
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Top Header */}
      <div className="h-12 border-b border-slate-5 bg-panel px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-title-section text-slate-12 truncate">{agent.name}</span>
          <span className="font-mono text-ui-xs px-1.5 py-0.5 rounded bg-slate-3 border border-slate-5 text-slate-11 shrink-0">
            {agent.version}
          </span>
          <span className="text-ui-xs text-slate-10 truncate">
            ID: {agent.id}
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

      {/* Main Split Pane: Left Readable Workflow Steps (55%) + Right Policy & Limits Overview (45%) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Visual Workflow Step Flow (no raw YAML/JSON dumps) */}
        <div className="flex-[55] flex flex-col border-r border-slate-5 bg-slate-1 overflow-hidden min-w-0">
          <div className="p-3 border-b border-slate-5 bg-panel/60 flex items-center justify-between text-ui-xs font-semibold uppercase tracking-wider text-slate-10">
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-blue-9" />
              <span>Compiled Workflow Steps ({irNodes.length})</span>
            </div>
            <span className="font-mono text-[11px] text-slate-9">
              {specDetail?.category || compiledIR?.metadata?.category || "financial-workflow"}
            </span>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-2">
            {isLoadingSpec ? (
              <div className="h-full flex items-center justify-center gap-2 text-ui-xs text-slate-10">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading workflow steps...</span>
              </div>
            ) : irNodes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-ui-xs text-slate-9">
                No workflow steps found for this specification.
              </div>
            ) : (
              irNodes.map((node: any, idx: number) => (
                <React.Fragment key={node.id || idx}>
                  <div className="p-3 rounded-card bg-panel border border-slate-5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-3 border border-slate-5 text-[11px] font-mono text-slate-11 flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-12 truncate">
                          {node.title || node.id.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </span>
                      </div>
                      {node.description && (
                        <p className="text-[11px] text-slate-10 mt-1 pl-7 line-clamp-2">
                          {node.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-blue-2 border border-blue-6/60 text-[10px] font-mono font-medium text-blue-11">
                        {node.type || "STEP"}
                      </span>
                      {node.payload?.capability_id && (
                        <span className="text-[10px] font-mono text-slate-10">
                          {node.payload.capability_id}
                        </span>
                      )}
                    </div>
                  </div>
                  {idx < irNodes.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="h-3.5 w-3.5 text-slate-7" />
                    </div>
                  )}
                </React.Fragment>
              ))
            )}
          </div>
        </div>

        {/* Right: Guardrails, Limits & Permitted PayPal Actions */}
        <div className="flex-[45] flex flex-col bg-panel overflow-y-auto p-4 space-y-4">
          <div className="text-ui-xs font-semibold uppercase tracking-wider text-slate-10 pb-2 border-b border-slate-5">
            Active Financial Guardrails
          </div>

          {loadError ? (
            <div className="p-3 rounded bg-red-2 border border-red-6 text-ui-xs text-red-11">
              {loadError}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 text-ui-xs">
                <div className="p-3 rounded-card bg-slate-2 border border-slate-5">
                  <div className="text-[10px] text-slate-9 uppercase font-mono">Max Budget / Run</div>
                  <div className="font-mono font-semibold text-sm text-slate-12 mt-1">
                    {isLoadingSpec
                      ? "Loading..."
                      : policies
                        ? `$${Number(policies.max_budget_usd ?? 0).toFixed(2)} USD`
                        : "Not set"}
                  </div>
                </div>

                <div className="p-3 rounded-card bg-slate-2 border border-slate-5">
                  <div className="text-[10px] text-slate-9 uppercase font-mono">Approval Gate</div>
                  <div className="font-mono font-semibold text-sm text-slate-12 mt-1">
                    {isLoadingSpec
                      ? "Loading..."
                      : policies
                        ? policies.require_human_approval
                          ? "Human Sign-Off"
                          : "Auto-Execute"
                        : "Not set"}
                  </div>
                </div>

                <div className="p-3 rounded-card bg-slate-2 border border-slate-5">
                  <div className="text-[10px] text-slate-9 uppercase font-mono">Step Ceiling</div>
                  <div className="font-mono font-medium text-slate-12 mt-1">
                    {isLoadingSpec
                      ? "Loading..."
                      : limits?.max_steps
                        ? `${limits.max_steps} max steps`
                        : "Default (50)"}
                  </div>
                </div>

                <div className="p-3 rounded-card bg-slate-2 border border-slate-5">
                  <div className="text-[10px] text-slate-9 uppercase font-mono">Pre-Flight Tests</div>
                  <div className="font-mono font-medium text-green-11 mt-1">
                    {isLoadingSpec
                      ? "Loading..."
                      : specDetail?.validation_report
                        ? `${specDetail.validation_report.tests_passed} / ${specDetail.validation_report.tests_run} Passed`
                        : "Verified"}
                  </div>
                </div>
              </div>

              {/* Permitted PayPal Capabilities */}
              <div className="p-3 rounded-card bg-slate-2 border border-slate-5 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-10">
                  Permitted External Capabilities
                </div>
                {capabilities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((cap) => (
                      <span
                        key={cap.capability_id}
                        className="px-2 py-0.5 rounded bg-blue-2 border border-blue-6/60 text-[11px] font-mono text-blue-11"
                      >
                        {cap.capability_id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-ui-xs text-slate-9 font-mono">
                    No external PayPal mutations declared.
                  </div>
                )}
              </div>

              {specDetail?.readiness_token && (
                <div className="p-3 rounded-card bg-green-2/50 border border-green-6/50 flex items-center gap-2 text-ui-xs">
                  <Lock className="h-3.5 w-3.5 text-green-9 shrink-0" />
                  <span className="font-mono text-green-11 truncate">
                    Sealed Token: {specDetail.readiness_token}
                  </span>
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="space-y-1.5">
                  {validationErrors.map((errMsg, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-red-2 border border-red-6 text-ui-xs text-red-11">
                      {errMsg}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="h-10 border-t border-slate-5 bg-panel px-4 flex items-center justify-between text-ui shrink-0">
        <div className="flex items-center gap-2 text-ui-sm">
          {validationErrors.length === 0 ? (
            <span className="flex items-center gap-1.5 text-green-11 font-medium">
              <ShieldCheck className="h-4 w-4 text-green-9" />
              <span>Spec sealed &amp; ready for Live Sandbox</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-11 font-medium">
              <AlertCircle className="h-4 w-4 text-red-9" />
              <span>{validationErrors.length} validation errors</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/studio/new">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-9" />
              <span>New Spec in Studio</span>
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push(`/sandbox/${encodeURIComponent(agent.id)}`)}
            className="flex items-center gap-1.5 font-semibold"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Open in Live Sandbox &rarr;</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
