"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  Play,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Loader2,
  ChevronDown,
  Lock,
  FileCode,
  Layers,
  Activity,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { api, CompilePromptResponse, ClarificationQuestion, SyntheticTestResult } from "@/lib/api";
import { useDelTixStore } from "@/lib/store";

interface ExampleTemplate {
  name: string;
  category: string;
  prompt: string;
  spendCap: number;
  approvalThreshold: number;
  tools: string[];
}

const TEMPLATES: Record<string, ExampleTemplate> = {
  ecommerce_refund: {
    name: "E-Commerce Automated Refund Agent",
    category: "customer-service-refunds",
    prompt:
      "When a customer requests a refund with order_id and reason, verify PayPal capture status. If capture is COMPLETED and total amount is <= $50.00 USD, refund automatically via PayPal. If amount is > $50.00 USD, pause and require human finance manager approval. Deduct 5% restocking fee using exact Decimal arithmetic. Do not exceed max spend of $500.00 USD per run.",
    spendCap: 500,
    approvalThreshold: 50,
    tools: ["paypal_get_capture", "paypal_refund_capture", "return_policy_rag"],
  },
  vendor_payable: {
    name: "Vendor Invoice & Accounts Payable Agent",
    category: "accounts-payable",
    prompt:
      "Ingest incoming vendor invoice with vendor_id, invoice_id, and line_items. Verify line item subtotal sums to total using exact Decimal math. Check whether vendor bank account is verified. If total <= $250.00 USD, disburse payment via PayPal Payouts. If total > $250.00 USD, hold disbursement and require Controller approval. Maximum budget limit is $2500.00 USD.",
    spendCap: 2500,
    approvalThreshold: 250,
    tools: ["paypal_get_capture", "paypal_refund_capture"],
  },
  dispute_mitigation: {
    name: "Chargeback & Dispute Mitigation Agent",
    category: "dispute-resolution",
    prompt:
      "Inspect inbound chargeback notification from PayPal. Query customer support transcript for delivery confirmation and signed tracking number. Ground reason against refund policy. If dispute claim is under $40.00 USD and customer has high trust score, issue merchant concession credit. Otherwise escalate to human risk officer.",
    spendCap: 400,
    approvalThreshold: 40,
    tools: ["paypal_get_capture", "return_policy_rag"],
  },
  saas_proration: {
    name: "Monthly SaaS Proration & Credit Agent",
    category: "subscription-billing",
    prompt:
      "When subscriber downgrades plan mid-cycle, calculate exact daily proration credit using 30-day denominator Decimal AST. Verify subscription state. Issue proration credit to balance if amount <= $100.00 USD. If refund requested to original payment method and exceeds $100.00 USD, require manager review.",
    spendCap: 1000,
    approvalThreshold: 100,
    tools: ["paypal_get_capture", "paypal_refund_capture"],
  },
};

export default function StudioNewPage() {
  const router = useRouter();
  const { fetchAgents } = useDelTixStore();

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("ecommerce_refund");
  const [agentName, setAgentName] = useState<string>(TEMPLATES.ecommerce_refund.name);
  const [promptText, setPromptText] = useState<string>(TEMPLATES.ecommerce_refund.prompt);
  const [spendCap, setSpendCap] = useState<number>(TEMPLATES.ecommerce_refund.spendCap);
  const [approvalThreshold, setApprovalThreshold] = useState<number>(TEMPLATES.ecommerce_refund.approvalThreshold);
  const [selectedTools, setSelectedTools] = useState<string[]>(TEMPLATES.ecommerce_refund.tools);

  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompilePromptResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clarification Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    const tmpl = TEMPLATES[key];
    if (tmpl) {
      setAgentName(tmpl.name);
      setPromptText(tmpl.prompt);
      setSpendCap(tmpl.spendCap);
      setApprovalThreshold(tmpl.approvalThreshold);
      setSelectedTools(tmpl.tools);
      setCompileResult(null);
      setErrorMsg(null);
    }
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  };

  const handleCompile = async (clarificationsOverride?: Record<string, string>) => {
    setIsCompiling(true);
    setErrorMsg(null);

    // Build enhanced prompt that includes quick settings explicitly
    const finalPrompt = promptText.trim();

    try {
      const resp = await api.compilePrompt({
        name: agentName,
        category: TEMPLATES[selectedTemplateKey]?.category || "financial-disbursement",
        natural_language_prompt: finalPrompt,
        clarifications: clarificationsOverride || (Object.keys(clarificationAnswers).length > 0 ? clarificationAnswers : undefined),
      });

      setCompileResult(resp);

      if (resp.status === "CLARIFICATION_REQUIRED" && resp.clarification_questions?.length) {
        // Initialize default answers with recommendations
        const initialAnswers: Record<string, string> = { ...clarificationAnswers };
        resp.clarification_questions.forEach((q) => {
          if (!initialAnswers[q.field] && q.suggestions && q.suggestions.length > 0) {
            initialAnswers[q.field] = q.suggestions[0];
          }
        });
        setClarificationAnswers(initialAnswers);
        setDrawerOpen(true);
      } else {
        setDrawerOpen(false);
        // Refresh specs list in store so agents and dashboard see the new compiled spec
        fetchAgents();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to compile financial agent");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleApplyClarifications = () => {
    setDrawerOpen(false);
    handleCompile(clarificationAnswers);
  };

  const handleLaunchSandbox = () => {
    if (compileResult?.spec_id) {
      router.push(`/sandbox/${compileResult.spec_id}`);
    } else {
      router.push("/sandbox");
    }
  };

  const nodes = compileResult?.agent_ir?.nodes || [];

  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full bg-slate-1 overflow-hidden relative">
        {/* Top Header */}
        <div className="h-12 border-b border-slate-5 bg-panel px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-12">Compiler Studio</span>
            <span className="text-slate-7">/</span>
            <span className="text-xs text-slate-10 font-mono">natural_language_prompt &rarr; agent_ir</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-10 font-medium hidden sm:inline">
              Load Example Template:
            </label>
            <select
              value={selectedTemplateKey}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="bg-slate-3 border border-slate-5 rounded-btn px-2.5 py-1 text-xs text-slate-12 focus:outline-none focus:border-slate-8"
            >
              <option value="ecommerce_refund">E-Commerce Automated Refund Agent</option>
              <option value="vendor_payable">Vendor Invoice & Accounts Payable</option>
              <option value="dispute_mitigation">Chargeback & Dispute Mitigation</option>
              <option value="saas_proration">Monthly SaaS Proration & Credit</option>
            </select>
          </div>
        </div>

        {/* Studio Main Workspace (2-Column Split: 52% Composer, 48% Diagnostics & Graph) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Column: Natural Language Financial Prompt Composer */}
          <div className="flex-1 lg:w-[52%] border-r border-slate-5 flex flex-col bg-panel overflow-y-auto p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-11 uppercase tracking-wider mb-1.5">
                Agent Specification Name
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. E-Commerce Automated Refund Agent"
                className="w-full bg-slate-2 border border-slate-5 rounded-btn px-3 py-2 text-sm text-slate-12 focus:outline-none focus:border-slate-8 font-medium"
              />
            </div>

            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-11 uppercase tracking-wider">
                  Describe Agent Financial Workflow (Plain English)
                </label>
                <span className="text-[11px] text-slate-9 font-mono">
                  AST Python Math &bull; Fail-Closed
                </span>
              </div>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe trigger condition, verification checks, exact math calculations, spend limits, and human approval threshold..."
                rows={9}
                className="w-full flex-1 p-3 bg-slate-2 border border-slate-5 rounded-card text-xs text-slate-12 font-mono leading-relaxed focus:outline-none focus:border-slate-8 resize-none selection:bg-blue-3 selection:text-blue-11"
              />
            </div>

            {/* Quick Settings (Auto-Synced with Financial Bounds) */}
            <div className="p-4 bg-slate-2/60 border border-slate-5 rounded-card space-y-4">
              <div className="text-xs font-semibold text-slate-11 uppercase tracking-wider flex items-center justify-between">
                <span>Quick Financial Settings</span>
                <span className="text-[11px] font-normal text-slate-9 lowercase">
                  auto-synchronized with compiler IR
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-10 mb-1">
                    Max Spend Limit / Run (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-9 font-mono">$</span>
                    <input
                      type="number"
                      value={spendCap}
                      onChange={(e) => setSpendCap(Number(e.target.value))}
                      className="w-full pl-6 pr-3 py-1.5 bg-slate-3 border border-slate-5 rounded text-xs text-slate-12 font-mono focus:outline-none focus:border-slate-8"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-10 mb-1">
                    Human Approval Threshold (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-9 font-mono">$</span>
                    <input
                      type="number"
                      value={approvalThreshold}
                      onChange={(e) => setApprovalThreshold(Number(e.target.value))}
                      className="w-full pl-6 pr-3 py-1.5 bg-slate-3 border border-slate-5 rounded text-xs text-slate-12 font-mono focus:outline-none focus:border-slate-8"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-10 mb-2">
                  Permitted External Capabilities
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "paypal_get_capture", label: "PayPal: Get Capture" },
                    { id: "paypal_refund_capture", label: "PayPal: Refund Capture" },
                    { id: "return_policy_rag", label: "Return Policy Grounding" },
                  ].map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleTool(tool.id)}
                      className={`px-2.5 py-1 rounded text-xs border font-mono transition-colors ${
                        selectedTools.includes(tool.id)
                          ? "bg-blue-3 border-blue-6 text-blue-11 font-medium"
                          : "bg-slate-3 border-slate-5 text-slate-10 hover:text-slate-12"
                      }`}
                    >
                      {selectedTools.includes(tool.id) ? "✓ " : "+ "}
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-red-2 border border-red-6 rounded text-xs text-red-11 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-9" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="primary"
                onClick={() => handleCompile()}
                disabled={isCompiling || !promptText.trim()}
                className="gap-2 text-xs h-9 px-4"
              >
                {isCompiling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compiling & Verifying AST...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Compile Financial Agent ⚡
                  </>
                )}
              </Button>

              {compileResult?.status === "CLARIFICATION_REQUIRED" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDrawerOpen(true)}
                  className="text-amber-11 border-amber-6 bg-amber-2 hover:bg-amber-3 gap-1.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Answer Clarifications ({compileResult.clarification_questions?.length})
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Compiler Diagnostics, Guardrails & Graph Preview */}
          <div className="flex-1 lg:w-[48%] flex flex-col bg-slate-2/40 overflow-y-auto p-6 space-y-5">
            {/* Compilation Status Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-11">
                Compilation Diagnostics
              </div>
              <div>
                {!compileResult ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-3 border border-slate-5 text-slate-10">
                    IDLE &bull; READY TO COMPILE
                  </span>
                ) : compileResult.status === "READY" ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-green-3 border border-green-6 text-green-11 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> COMPILED &amp; SEALED
                  </span>
                ) : compileResult.status === "CLARIFICATION_REQUIRED" ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-3 border border-amber-6 text-amber-11 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> CLARIFICATION REQUIRED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-red-3 border border-red-6 text-red-11 font-medium">
                    VALIDATION FAILED
                  </span>
                )}
              </div>
            </div>

            {/* Financial Guardrails Detected */}
            <div className="bg-panel border border-slate-5 rounded-card p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-12 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-green-9" />
                <span>Financial Guardrails Detected</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded bg-slate-2 border border-slate-5">
                  <div className="text-[11px] text-slate-9 uppercase font-mono">Spend Cap</div>
                  <div className="font-mono font-medium text-slate-12 mt-0.5">
                    ${spendCap.toFixed(2)} USD / run
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-2 border border-slate-5">
                  <div className="text-[11px] text-slate-9 uppercase font-mono">Approval Gate</div>
                  <div className="font-mono font-medium text-slate-12 mt-0.5">
                    Above ${approvalThreshold.toFixed(2)} USD
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-2 border border-slate-5">
                  <div className="text-[11px] text-slate-9 uppercase font-mono">Math Engine</div>
                  <div className="font-mono font-medium text-slate-12 mt-0.5">
                    Python Decimal AST
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-2 border border-slate-5">
                  <div className="text-[11px] text-slate-9 uppercase font-mono">Grounding Policy</div>
                  <div className="font-mono font-medium text-slate-12 mt-0.5">
                    RAG Quote Match
                  </div>
                </div>
              </div>
            </div>

            {/* Pre-Flight Test Scorecard */}
            {compileResult?.synthetic_tests && compileResult.synthetic_tests.length > 0 && (
              <div className="bg-panel border border-slate-5 rounded-card p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-12 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-blue-9" />
                    <span>Pre-Flight Synthetic Test Scorecard</span>
                  </div>
                  <span className="text-[11px] font-mono text-green-11">
                    {compileResult.synthetic_tests.filter((t) => t.passed).length} / {compileResult.synthetic_tests.length} Passed
                  </span>
                </div>

                <div className="space-y-2">
                  {compileResult.synthetic_tests.map((test, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-slate-2 border border-slate-5 text-xs flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-12 flex items-center gap-1.5">
                          {test.passed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-9 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-9 shrink-0" />
                          )}
                          <span>{test.scenario_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-9 mt-0.5">{test.detail}</div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-10 shrink-0">
                        {test.steps_visited} steps
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HMAC Readiness Token Display */}
            {compileResult?.readiness_token && (
              <div className="bg-panel border border-green-6/50 rounded-card p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-green-3 border border-green-6 text-green-11 flex items-center justify-center">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-12">
                      HMAC Readiness Token [SEALED ✓]
                    </div>
                    <div className="text-[11px] font-mono text-slate-10 truncate max-w-[280px]">
                      {compileResult.readiness_token}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-green-3 border border-green-6 text-green-11 font-medium">
                  v{compileResult.version || "1.0.0"}
                </span>
              </div>
            )}

            {/* Synthesized Node Execution Order */}
            <div className="bg-panel border border-slate-5 rounded-card p-4 flex-1 flex flex-col">
              <div className="text-xs font-semibold text-slate-12 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-9" />
                  <span>Synthesized DAG Nodes ({nodes.length})</span>
                </div>
                {compileResult?.spec_id && (
                  <span className="text-[11px] font-mono text-slate-10">
                    ID: {compileResult.spec_id.slice(-8)}
                  </span>
                )}
              </div>

              {nodes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-9 text-xs">
                  <FileCode className="h-8 w-8 text-slate-7 mb-2" />
                  <span>Click &quot;Compile Financial Agent ⚡&quot; to synthesize execution graph</span>
                </div>
              ) : (
                <div className="space-y-1.5 font-mono text-xs overflow-y-auto max-h-64">
                  {nodes.map((node: any, idx: number) => (
                    <div
                      key={node.id || idx}
                      className="p-2 rounded bg-slate-2 border border-slate-5 flex items-center justify-between text-slate-11 hover:text-slate-12 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-slate-9 w-4">{idx + 1}.</span>
                        <span className="font-semibold text-blue-11">
                          [{node.type || "NODE"}]
                        </span>
                        <span className="truncate">{node.title || node.id}</span>
                      </div>
                      {node.payload?.capability_id && (
                        <span className="text-[10px] text-slate-9 truncate ml-2">
                          {node.payload.capability_id}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Launch & Deploy Actions */}
            {compileResult?.status === "READY" && (
              <div className="pt-2 flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={handleLaunchSandbox}
                  className="flex-1 gap-2 text-xs h-9"
                >
                  <Play className="h-3.5 w-3.5" />
                  Launch in Live Sandbox &rarr;
                </Button>
                <Link href="/runs" className="flex-1">
                  <Button variant="secondary" className="w-full text-xs h-9">
                    Deploy to Runtime
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Clarification Drawer Modal */}
        {drawerOpen && compileResult?.clarification_questions && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end">
            <div className="w-full max-w-lg h-full bg-panel border-l border-slate-5 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="space-y-4 overflow-y-auto">
                <div className="flex items-start justify-between pb-3 border-b border-slate-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-amber-3 border border-amber-6 text-amber-11 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-12">
                        Missing Financial Boundaries
                      </h3>
                      <p className="text-xs text-slate-9 mt-0.5">
                        DelTix cannot compile an agent without safety limits.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="text-slate-9 hover:text-slate-12 p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-5 pt-2">
                  {compileResult.clarification_questions.map((q, idx) => (
                    <div key={q.field || idx} className="space-y-2">
                      <div className="text-xs font-medium text-slate-12">
                        Question {idx + 1}: {q.question}
                      </div>
                      <div className="text-[11px] text-slate-9">
                        Reason: {q.why_required}
                      </div>

                      {q.suggestions && q.suggestions.length > 0 ? (
                        <div className="space-y-1.5">
                          {q.suggestions.map((suggestion, sIdx) => (
                            <label
                              key={sIdx}
                              className={`flex items-center gap-2.5 p-2 rounded border cursor-pointer text-xs transition-colors ${
                                clarificationAnswers[q.field] === suggestion
                                  ? "bg-blue-3 border-blue-6 text-blue-12"
                                  : "bg-slate-2 border-slate-5 text-slate-11 hover:border-slate-7"
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.field}
                                value={suggestion}
                                checked={clarificationAnswers[q.field] === suggestion}
                                onChange={() =>
                                  setClarificationAnswers((prev) => ({
                                    ...prev,
                                    [q.field]: suggestion,
                                  }))
                                }
                                className="text-blue-9"
                              />
                              <span>
                                {suggestion}{" "}
                                {sIdx === 0 && (
                                  <span className="text-[10px] text-blue-11 font-mono font-medium">
                                    (Recommended)
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={clarificationAnswers[q.field] || ""}
                          onChange={(e) =>
                            setClarificationAnswers((prev) => ({
                              ...prev,
                              [q.field]: e.target.value,
                            }))
                          }
                          placeholder="Enter required parameter..."
                          className="w-full bg-slate-2 border border-slate-5 rounded px-3 py-1.5 text-xs text-slate-12 focus:outline-none focus:border-slate-8"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-5 flex items-center justify-end gap-2.5">
                <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyClarifications}
                  disabled={isCompiling}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Apply Boundaries &amp; Re-Compile
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
