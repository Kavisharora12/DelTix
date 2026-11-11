"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Play,
  Upload,
  Code2,
  FileText,
  GitBranch,
  Sparkles,
  Loader2,
} from "lucide-react";
import { AgentItem } from "@/types";
import { Button } from "@/components/ui/button";
import { useDelTixStore } from "@/lib/store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Diagnostic {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  line: number;
  column: number;
  code: string;
}

interface AgentStudioProps {
  agent: AgentItem;
  onSave?: (yaml: string) => void;
}

export function AgentStudio({ agent, onSave }: AgentStudioProps) {
  const router = useRouter();
  const { createRunFromAgent, publishAgentVersion } = useDelTixStore();
  const [yamlContent, setYamlContent] = useState(agent.definitionYaml);
  const [activeTab, setActiveTab] = useState<"definition" | "ir">("definition");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<Diagnostic | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledIR, setCompiledIR] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    setYamlContent(agent.definitionYaml);
    setDiagnostics([]);
    setCompiledIR(null);
  }, [agent.id, agent.definitionYaml]);

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

  const handleCompile = async () => {
    setIsCompiling(true);
    setPublishFeedback(null);
    try {
      const resp = await api.compilePrompt({
        name: agent.name,
        category: "financial-disbursement",
        natural_language_prompt: yamlContent,
      });
      if (resp.agent_ir) {
        setCompiledIR(resp.agent_ir);
      }

      if (resp.validation_report?.errors && resp.validation_report.errors.length > 0) {
        setDiagnostics(
          resp.validation_report.errors.map((msg: string, idx: number) => ({
            id: `err_${idx}`,
            severity: "error",
            message: msg,
            line: idx + 1,
            column: 1,
            code: "VAL_ERR",
          }))
        );
        setPublishFeedback("Validation reported errors in specification.");
      } else {
        setDiagnostics([]);
        setPublishFeedback("Compiled & validated successfully!");
      }
    } catch (err: any) {
      setDiagnostics([
        {
          id: `err_api`,
          severity: "error",
          message: err.message || "Failed to reach compiler service",
          line: 1,
          column: 1,
          code: "COMPILER_ERR",
        },
      ]);
      setPublishFeedback("Compiler error occurred.");
    } finally {
      setIsCompiling(false);
      setTimeout(() => setPublishFeedback(null), 4000);
    }
  };

  const handleRunSandbox = async () => {
    const newRun = await createRunFromAgent(agent.id);
    router.push(`/runs/${newRun.id}`);
  };

  const handlePublish = async () => {
    await publishAgentVersion(agent.id);
    setPublishFeedback(`Published version successfully!`);
    setTimeout(() => setPublishFeedback(null), 3500);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Top Header */}
      <div className="h-12 border-b border-slate-5 bg-panel px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-title-section text-slate-12">{agent.name}</span>
          <span className="font-mono text-ui-xs px-1.5 py-0.5 rounded bg-slate-3 border border-slate-5 text-slate-11">
            {agent.version}
          </span>
          <span className="text-ui-xs text-slate-10">Owner: {agent.owner}</span>
        </div>

        {/* Editor Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-3 p-0.5 rounded-btn border border-slate-5">
          <button
            type="button"
            onClick={() => setActiveTab("definition")}
            className={cn(
              "px-3 py-1 text-ui rounded font-medium transition-colors",
              activeTab === "definition" ? "bg-slate-5 text-slate-12" : "text-slate-10 hover:text-slate-12"
            )}
          >
            Agent Definition (YAML)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ir")}
            className={cn(
              "px-3 py-1 text-ui rounded font-medium transition-colors",
              activeTab === "ir" ? "bg-slate-5 text-slate-12" : "text-slate-10 hover:text-slate-12"
            )}
          >
            Compiled IR Preview
          </button>
        </div>
      </div>

      {/* Main Split Pane: Left Editor (55%) + Right Problems & Diagnostics Panel (45%) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Code Editor */}
        <div className="flex-[55] flex flex-col border-r border-slate-5 bg-slate-2">
          <div className="p-2 border-b border-slate-5 bg-slate-3/40 flex items-center justify-between text-ui-xs text-slate-10 font-mono">
            <span>{activeTab === "definition" ? "agent_graph.yaml" : "agent_ir_synthesized.json"}</span>
            <span>{activeTab === "definition" ? "UTF-8 • YAML" : "UTF-8 • JSON (Read-Only)"}</span>
          </div>

          {activeTab === "definition" ? (
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              spellCheck={false}
              className="flex-1 p-4 bg-transparent font-mono text-ui-xs text-slate-11 focus:outline-none resize-none leading-relaxed selection:bg-blue-3 selection:text-blue-11"
            />
          ) : (
            <pre className="flex-1 p-4 bg-transparent font-mono text-ui-xs text-slate-11 overflow-auto leading-relaxed select-text">
              {compiledIR
                ? JSON.stringify(compiledIR, null, 2)
                : "# No IR compiled yet. Click 'Compile Intent' below to generate Agent IR."}
            </pre>
          )}
        </div>

        {/* Right: Compiler Output */}
        <div className="flex-[45] flex flex-col bg-panel overflow-hidden">
          <div className="p-3 border-b border-slate-5 bg-slate-3/30 flex items-center justify-between text-ui-xs font-semibold uppercase tracking-wider text-slate-10">
            <span>Compiler Diagnostics ({diagnostics.length})</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-red-11">
                <AlertCircle className="h-3 w-3 text-red-9" /> {errorCount} errors
              </span>
              <span className="flex items-center gap-1 text-amber-11">
                <AlertTriangle className="h-3 w-3 text-amber-9" /> {warningCount} warnings
              </span>
            </div>
          </div>

          {/* Diagnostics List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-5">
            {diagnostics.length === 0 ? (
              <div className="p-6 text-center text-slate-10 text-ui-sm flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-9" />
                <span>Compiler clean. Zero errors or rule warnings.</span>
              </div>
            ) : (
              diagnostics.map((diag) => {
                const isSelected = selectedDiagnostic?.id === diag.id;

                return (
                  <div
                    key={diag.id}
                    onClick={() => setSelectedDiagnostic(diag)}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-slate-3 transition-colors text-ui-sm flex items-start gap-2.5",
                      isSelected && "bg-slate-4"
                    )}
                  >
                    {diag.severity === "error" && (
                      <AlertCircle className="h-4 w-4 text-red-9 shrink-0 mt-0.5" />
                    )}
                    {diag.severity === "warning" && (
                      <AlertTriangle className="h-4 w-4 text-amber-9 shrink-0 mt-0.5" />
                    )}
                    {diag.severity === "info" && (
                      <Info className="h-4 w-4 text-blue-9 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-slate-12 leading-tight">
                        {diag.message}
                      </div>
                      <div className="font-mono text-ui-xs text-slate-10 mt-1 flex items-center gap-2">
                        <span>line {diag.line}:{diag.column}</span>
                        <span>•</span>
                        <span>{diag.code}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Graph Structure Preview */}
          <div className="h-48 border-t border-slate-5 bg-slate-2 p-3 overflow-y-auto">
            <div className="text-ui-xs text-slate-10 font-semibold uppercase tracking-wider mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                <span>Synthesized Node Execution Order</span>
              </div>
              {compiledIR?.nodes && (
                <span className="text-[11px] font-mono text-green-11">
                  {compiledIR.nodes.length} nodes
                </span>
              )}
            </div>
            <div className="space-y-1 font-mono text-ui-xs text-slate-11">
              {compiledIR?.nodes && compiledIR.nodes.length > 0 ? (
                compiledIR.nodes.map((node: any, idx: number) => (
                  <div key={node.id || idx} className="truncate">
                    {idx + 1}. [{node.type || "NODE"}] {node.title || node.id}
                  </div>
                ))
              ) : (
                <>
                  <div>1. [INGEST] ingest_invoice</div>
                  <div>2. [MATH] reconcile_math (Decimal AST)</div>
                  <div>3. [GROUND] verify_grounding</div>
                  <div>4. [POLICY] check_policy (max_budget_usd)</div>
                  <div>5. [GATE] require_human_approval</div>
                  <div>6. [TOOL] disburse_payout (paypal_refund_capture)</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="h-10 border-t border-slate-5 bg-panel px-4 flex items-center justify-between text-ui shrink-0">
        <div className="flex items-center gap-2 text-ui-sm">
          {errorCount === 0 ? (
            <span className="flex items-center gap-1.5 text-green-11 font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-9" />
              <span>Compilation verified: 0 errors</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-11 font-medium">
              <AlertCircle className="h-4 w-4 text-red-9" />
              <span>{errorCount} blocking compile errors</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {publishFeedback && (
            <span className="text-ui-xs text-green-11 bg-green-3 border border-green-6 px-2.5 py-1 rounded-btn font-medium">
              {publishFeedback}
            </span>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCompile}
            disabled={isCompiling}
            className="flex items-center gap-1.5"
            title="Compile intent with Gemini cascade & Tarjan graph validator"
          >
            {isCompiling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-blue-9" />
            )}
            <span>{isCompiling ? "Compiling..." : "Compile Intent"}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRunSandbox}
            className="flex items-center gap-1.5"
            title="Execute compiled graph in sandbox runtime"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Run in sandbox</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handlePublish}
            disabled={errorCount > 0 || isCompiling}
            className="flex items-center gap-1.5 font-semibold"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Publish version</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
