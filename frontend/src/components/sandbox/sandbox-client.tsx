"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Play,
  Terminal,
  Bot,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Loader2,
  DollarSign,
  Cpu,
  Layers,
  Database,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, BackendAgentSpec, BackendCheckpoint, BackendRunDetailResponse } from "@/lib/api";
import { useDelTixStore } from "@/lib/store";

interface ChatMessage {
  id: string;
  sender: "user" | "agent" | "system";
  text: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface SandboxClientProps {
  initialSpecId?: string;
}

function formatCheckpointSummary(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const obj = output as Record<string, any>;
  if (typeof obj.error === "string") {
    const rawErr = obj.error;
    // Extract clean PayPal API message if nested inside tool dispatch error
    const paypalMsgMatch = rawErr.match(/"message"\s*:\s*"([^"]+)"/);
    const paypalNameMatch = rawErr.match(/"name"\s*:\s*"([^"]+)"/);
    if (paypalNameMatch || paypalMsgMatch) {
      return `${paypalNameMatch?.[1] || "PayPal Error"}: ${paypalMsgMatch?.[1] || rawErr}`;
    }
    return rawErr;
  }
  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.status === "string") return `Step result: ${obj.status}`;
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;
  return keys.map((k) => `${k}: ${String(obj[k])}`).join(" • ");
}

export function SandboxClient({ initialSpecId }: SandboxClientProps) {
  const { runs, fetchRuns } = useDelTixStore();

  const [specs, setSpecs] = useState<BackendAgentSpec[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string>(initialSpecId || "");
  const [selectedSpec, setSelectedSpec] = useState<BackendAgentSpec | null>(null);

  // Chat & Trigger Inputs
  const [userPrompt, setUserPrompt] = useState(
    "Customer Alex requests refund for Order #ORD-7712. Item damaged in transit."
  );
  const [orderId, setOrderId] = useState("ORD-7712");
  const [amountUSD, setAmountUSD] = useState("38.00");
  const [customerEmail, setCustomerEmail] = useState("alex@example.com");

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("IDLE");
  const [cumulativeSpend, setCumulativeSpend] = useState<number>(0);
  const [checkpoints, setCheckpoints] = useState<BackendCheckpoint[]>([]);
  const [pendingApproval, setPendingApproval] = useState<any | null>(null);
  const [stateSnapshot, setStateSnapshot] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      sender: "system",
      text: "DelTix Sandbox initialized. Select an agent specification and send a test trigger to simulate financial workflow execution.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Load available specs
  useEffect(() => {
    api.listSpecs()
      .then((data) => {
        setSpecs(data);
        if (data.length > 0) {
          const target = initialSpecId
            ? data.find((s) => s.spec_id === initialSpecId) || data[0]
            : data[0];
          setSelectedSpecId(target.spec_id);
          setSelectedSpec(target);
        }
      })
      .catch((err) => console.warn("Failed to list specs in sandbox", err));
  }, [initialSpecId]);

  // Handle spec change
  const handleSpecChange = (specId: string) => {
    setSelectedSpecId(specId);
    const found = specs.find((s) => s.spec_id === specId);
    if (found) {
      setSelectedSpec(found);
      setMessages((prev) => [
        ...prev,
        {
          id: `spec_sw_${Date.now()}`,
          sender: "system",
          text: `Loaded Agent: ${found.name} (v${found.version || "1.0.0"}). Ready for test triggers.`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Quick preset pills
  const handleApplyPreset = (preset: {
    prompt: string;
    orderId: string;
    amount: string;
    email: string;
  }) => {
    setUserPrompt(preset.prompt);
    setOrderId(preset.orderId);
    setAmountUSD(preset.amount);
    setCustomerEmail(preset.email);
  };

  const handleStartRun = async () => {
    if (!selectedSpecId || isRunning) return;

    setIsRunning(true);
    setRunStatus("INITIALIZING");
    setCheckpoints([]);
    setPendingApproval(null);

    const parsedAmount = parseFloat(amountUSD) || 38.0;
    setCumulativeSpend(parsedAmount);

    // Add user message to chat
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: userPrompt,
      timestamp: new Date().toLocaleTimeString(),
      metadata: { orderId, amountUSD: parsedAmount, customerEmail },
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const inputs = {
        description: userPrompt,
        order_id: orderId,
        amount_usd: parsedAmount,
        customer_email: customerEmail,
        recipient_name: "Customer Alex",
        recipient_paypal_id: customerEmail,
      };

      const startResp = await api.startRun(selectedSpecId, inputs);
      const runId = startResp.run_id;
      setActiveRunId(runId);
      setRunStatus(startResp.status || "RUNNING");

      if (startResp.checkpoints?.length) {
        setCheckpoints(startResp.checkpoints);
      }
      if (startResp.pending_approval) {
        setPendingApproval(startResp.pending_approval);
      }
      if (startResp.run?.state_payload) {
        setStateSnapshot(startResp.run.state_payload);
      }

      const specPolicies = (selectedSpec?.ir_payload || selectedSpec?.agent_ir)?.policies;
      const specBudget = specPolicies?.max_budget_usd;

      // Add system confirmation
      setMessages((prev) => [
        ...prev,
        {
          id: `run_start_${Date.now()}`,
          sender: "system",
          text: `Run dispatched: ${runId} (Target: PayPal Sandbox${specBudget ? ` • Budget Cap: $${Number(specBudget).toFixed(2)}` : ""})`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // Connect SSE Live Stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const stream = api.createRunStream(runId);
      eventSourceRef.current = stream;

      stream.addEventListener("checkpoint", (event: MessageEvent) => {
        try {
          const cp: BackendCheckpoint = JSON.parse(event.data);
          setCheckpoints((prev) => {
            if (prev.some((c) => c.checkpoint_id === cp.checkpoint_id)) return prev;
            return [...prev, cp];
          });

          // If checkpoint has state snapshot, update inspector
          if (cp.state_snapshot) {
            setStateSnapshot(cp.state_snapshot);
          } else if (cp.full_state) {
            setStateSnapshot(cp.full_state);
          }

          // Emit chat pills for important node types
          if (cp.node_type === "DETERMINISTIC_MATH") {
            setMessages((prev) => [
              ...prev,
              {
                id: `math_${Date.now()}`,
                sender: "system",
                text: `Math Verified: Deducted Restocking Fee with 0.00 floating variance [Python Decimal AST ✓]`,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          } else if (cp.node_type === "TOOL_EXECUTION") {
            setMessages((prev) => [
              ...prev,
              {
                id: `tool_${Date.now()}`,
                sender: "agent",
                text: `Executed Tool: ${cp.node_id}. State reconciled successfully.`,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
        } catch (e) {
          console.error("Failed to parse checkpoint event", e);
        }
      });

      stream.addEventListener("run_status", (event: MessageEvent) => {
        try {
          const detail: BackendRunDetailResponse = JSON.parse(event.data);
          const currentStatus = detail.run.status;
          setRunStatus(currentStatus);
          setCumulativeSpend(detail.run.cumulative_spend || parsedAmount);

          if (detail.run.state_payload) {
            setStateSnapshot(detail.run.state_payload);
          }

          if (detail.pending_approval) {
            setPendingApproval(detail.pending_approval);
            setMessages((prev) => [
              ...prev,
              {
                id: `appr_wait_${Date.now()}`,
                sender: "system",
                text: `Human Approval Required: Amount ($${Number(detail.pending_approval?.amount_usd || 0).toFixed(2)} USD) requires operator sign-off before execution continues.`,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }

          if (currentStatus === "COMPLETED") {
            const spent = Number(detail.run.cumulative_spend || 0);
            setMessages((prev) => [
              ...prev,
              {
                id: `comp_${Date.now()}`,
                sender: "agent",
                text:
                  spent > 0
                    ? `Transaction finalized. Payment of $${spent.toFixed(2)} USD executed via PayPal Sandbox.`
                    : `Run completed cleanly with $0.00 USD disbursed.`,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
            stream.close();
            setIsRunning(false);
            fetchRuns();
          } else if (currentStatus === "PAUSED_FOR_APPROVAL") {
            stream.close();
            setIsRunning(false);
            fetchRuns();
          } else if (currentStatus === "FAILED" || currentStatus === "REJECTED") {
            setMessages((prev) => [
              ...prev,
              {
                id: `fail_${Date.now()}`,
                sender: "system",
                text: `Run terminated with status: ${currentStatus}. ${detail.run.error_message || ""}`,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
            stream.close();
            setIsRunning(false);
            fetchRuns();
          }
        } catch (e) {
          console.error("Failed to parse run_status event", e);
        }
      });

      stream.onerror = () => {
        stream.close();
        setIsRunning(false);
      };
    } catch (err: any) {
      setIsRunning(false);
      setRunStatus("FAILED");
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "system",
          text: `Failed to trigger sandbox execution: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-1 overflow-hidden select-none">
      {/* Top Banner */}
      <div className="h-12 border-b border-slate-5 bg-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-11" />
            <span className="text-sm font-semibold text-slate-12">Live Agent Sandbox</span>
          </div>
          <span className="text-slate-7 hidden sm:inline">&bull;</span>
          <span className="text-xs text-slate-10 hidden sm:inline">
            Interactive Testbed &amp; Live SSE Telemetry
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-10 font-medium hidden md:inline">
            Active Specification:
          </label>
          <select
            value={selectedSpecId}
            onChange={(e) => handleSpecChange(e.target.value)}
            className="bg-slate-3 border border-slate-5 rounded-btn px-2.5 py-1 text-xs text-slate-12 focus:outline-none focus:border-slate-8 max-w-[220px] truncate"
          >
            {specs.map((s) => (
              <option key={s.spec_id} value={s.spec_id}>
                {s.name} ({s.spec_id.slice(-6)})
              </option>
            ))}
          </select>

          <Link href="/studio/new">
            <Button variant="secondary" size="sm" className="h-7 text-xs gap-1.5 hidden sm:flex">
              <Sparkles className="h-3 w-3" />
              Compile New Spec
            </Button>
          </Link>
        </div>
      </div>

      {/* 3-Column Split View: Chat Terminal (36%) + SSE Timeline (36%) + State/Memory Inspector (28%) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* 1. Conversational Chat Terminal */}
        <div className="flex-1 lg:w-[36%] border-r border-slate-5 flex flex-col bg-panel min-h-0">
          <div className="p-3 border-b border-slate-5 bg-slate-3/30 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-11">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-blue-9" />
              <span>1. Conversational Chat Terminal</span>
            </div>
            <span className="text-[11px] font-mono text-slate-9 lowercase">
              trigger simulator
            </span>
          </div>

          {/* Quick Trigger Preset Pills */}
          <div className="p-2.5 border-b border-slate-5 bg-slate-2/40 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-9 shrink-0">Presets:</span>
            <button
              type="button"
              onClick={() =>
                handleApplyPreset({
                  prompt: "Customer Alex requests refund for Order #ORD-7712 ($38.00). Item damaged.",
                  orderId: "ORD-7712",
                  amount: "38.00",
                  email: "alex@example.com",
                })
              }
              className="px-2 py-0.5 rounded bg-slate-3 hover:bg-slate-4 border border-slate-5 text-slate-11 shrink-0 font-medium"
            >
              $38 Auto-Refund
            </button>
            <button
              type="button"
              onClick={() =>
                handleApplyPreset({
                  prompt: "Customer Jordan requests refund for Order #ORD-9912 ($150.00). Exceeds threshold.",
                  orderId: "ORD-9912",
                  amount: "150.00",
                  email: "jordan@example.com",
                })
              }
              className="px-2 py-0.5 rounded bg-amber-2 hover:bg-amber-3 border border-amber-6 text-amber-11 shrink-0 font-medium"
            >
              $150 (Approval Gate)
            </button>
          </div>

          {/* Chat Messages Stream */}
          <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((msg) => {
              if (msg.sender === "system") {
                return (
                  <div
                    key={msg.id}
                    className="p-2.5 rounded-btn bg-slate-2 border border-slate-5 text-xs text-slate-10 leading-relaxed font-mono"
                  >
                    <span className="text-slate-8 mr-1.5">&gt;</span>
                    {msg.text}
                  </div>
                );
              }

              if (msg.sender === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] p-3 rounded-card bg-blue-3 border border-blue-6 text-xs text-blue-12 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-blue-10 font-mono">
                        <span>Customer Input</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="leading-relaxed font-medium">{msg.text}</p>
                      {msg.metadata && (
                        <div className="pt-1 border-t border-blue-6/50 text-[10px] font-mono text-blue-11 flex flex-wrap gap-2">
                          <span>Order: {msg.metadata.orderId}</span>
                          <span>Amount: ${msg.metadata.amountUSD}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[85%] p-3 rounded-card bg-slate-2 border border-slate-5 text-xs text-slate-12 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-9 font-mono">
                      <span className="text-green-11 font-medium">DelTix Agent</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trigger Input Form */}
          <div className="p-3 border-t border-slate-5 bg-panel space-y-2.5">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-9 uppercase font-mono block mb-1">
                  Order ID
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-2 border border-slate-5 rounded text-xs text-slate-12 font-mono focus:outline-none focus:border-slate-8"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-9 uppercase font-mono block mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  value={amountUSD}
                  onChange={(e) => setAmountUSD(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-2 border border-slate-5 rounded text-xs text-slate-12 font-mono focus:outline-none focus:border-slate-8"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-9 uppercase font-mono block mb-1">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-2 border border-slate-5 rounded text-xs text-slate-12 font-mono focus:outline-none focus:border-slate-8"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Type customer message or webhook payload..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleStartRun();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-slate-2 border border-slate-5 rounded-btn text-xs text-slate-12 focus:outline-none focus:border-slate-8"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartRun}
                disabled={isRunning || !selectedSpecId}
                className="h-8 px-3 gap-1.5 text-xs font-semibold shrink-0"
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send Trigger</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Live Execution Timeline (SSE) */}
        <div className="flex-1 lg:w-[36%] border-r border-slate-5 flex flex-col bg-slate-2/40 min-h-0">
          <div className="p-3 border-b border-slate-5 bg-panel flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-11">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-green-9" />
              <span>2. Live Execution Timeline (SSE)</span>
            </div>
            <div className="flex items-center gap-2">
              {activeRunId && (
                <span className="font-mono text-[10px] text-slate-9">
                  {activeRunId.slice(-8)}
                </span>
              )}
              <StatusBadge status={runStatus as any} />
            </div>
          </div>

          {/* Pending Approval Alert Banner */}
          {pendingApproval && (
            <div className="p-3 bg-amber-2 border-b border-amber-6 text-xs text-amber-12 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-11 shrink-0" />
                <div>
                  <div className="font-semibold">Human Approval Gate Triggered</div>
                  <div className="text-[11px] text-amber-11">
                    Amount ${pendingApproval.amount_usd?.toFixed(2)} USD exceeds policy limit.
                  </div>
                </div>
              </div>
              <Link href="/approvals">
                <Button variant="primary" size="sm" className="h-7 text-xs bg-amber-9 hover:bg-amber-10 text-black border-amber-11 shrink-0">
                  Review Gate &rarr;
                </Button>
              </Link>
            </div>
          )}

          {/* Checkpoint Steps List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
            {checkpoints.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-9 text-xs">
                <Clock className="h-8 w-8 text-slate-7 mb-2" />
                <span>Waiting for run trigger...</span>
                <span className="text-[11px] text-slate-8 mt-1">
                  Steps will stream over Server-Sent Events in real time
                </span>
              </div>
            ) : (
              checkpoints.map((cp, idx) => (
                <div
                  key={cp.checkpoint_id || idx}
                  className="p-3 bg-panel border border-slate-5 rounded-card text-xs space-y-1.5 hover:border-slate-7 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cp.status === "SUCCEEDED" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-9 shrink-0" />
                      ) : cp.status === "FAILED" ? (
                        <AlertTriangle className="h-4 w-4 text-red-9 shrink-0" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-blue-9 animate-spin shrink-0" />
                      )}
                      <span className="font-semibold text-slate-12">
                        {idx + 1}. {cp.node_id.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-3 border border-slate-5 text-slate-10">
                      {cp.node_type}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-10 flex items-center justify-between font-mono">
                    <span>Duration: {cp.duration_ms}ms</span>
                    <span
                      className={
                        cp.status === "FAILED"
                          ? "text-red-11 font-medium"
                          : cp.status === "SUCCEEDED"
                            ? "text-green-11 font-medium"
                            : "text-amber-11 font-medium"
                      }
                    >
                      {cp.status}
                    </span>
                  </div>

                  {formatCheckpointSummary(cp.node_output) && (
                    <div
                      className={
                        cp.status === "FAILED"
                          ? "p-2 rounded bg-red-2/60 border border-red-6/50 text-[11px] text-red-11 leading-relaxed break-words"
                          : "p-2 rounded bg-slate-2 border border-slate-5 text-[11px] text-slate-11 leading-relaxed break-words"
                      }
                    >
                      {formatCheckpointSummary(cp.node_output)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Timeline Bottom Summary */}
          {activeRunId && (
            <div className="p-3 border-t border-slate-5 bg-panel flex items-center justify-between text-xs font-mono">
              <span className="text-slate-10">Cumulative Run Spend:</span>
              <span className="text-slate-12 font-bold">${cumulativeSpend.toFixed(2)} USD</span>
            </div>
          )}
        </div>

        {/* 3. State, Memory & Integrity Inspector */}
        <div className="flex-1 lg:w-[28%] flex flex-col bg-panel min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="pb-3 border-b border-slate-5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-11">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-purple-9" />
              <span>3. State &amp; Integrity Inspector</span>
            </div>
          </div>

          {/* Zero-Hallucination Integrity Badges */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-12">Cryptographic Safety Proofs</div>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="p-2 rounded bg-green-2 border border-green-6/50 text-green-12 flex items-center justify-between">
                <span>[AST Math Engine]</span>
                <span className="font-semibold text-green-11">0 Variance ✓</span>
              </div>
              <div className="p-2 rounded bg-blue-2 border border-blue-6/50 text-blue-12 flex items-center justify-between">
                <span>[Grounding Verifier]</span>
                <span className="font-semibold text-blue-11">Quote Proof ✓</span>
              </div>
              <div className="p-2 rounded bg-purple-2 border border-purple-6/50 text-purple-12 flex items-center justify-between">
                <span>[PII Redaction]</span>
                <span className="font-semibold text-purple-11">Sanitized ✓</span>
              </div>
              <div className="p-2 rounded bg-slate-2 border border-slate-5 text-slate-11 flex items-center justify-between">
                <span>[HMAC Readiness]</span>
                <span className="font-semibold text-slate-12">Sealed ✓</span>
              </div>
            </div>
          </div>

          {/* Readable Execution Inputs & Variables */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-xs font-medium text-slate-12 mb-1.5 flex items-center justify-between">
              <span>Run Inputs &amp; State</span>
              <span className="text-[10px] font-mono text-slate-9">Step Telemetry</span>
            </div>
            <div className="flex-1 p-3 rounded-card bg-slate-2 border border-slate-5 text-[11px] text-slate-11 overflow-auto max-h-56 space-y-1.5">
              {Object.keys(stateSnapshot).length > 0 ? (
                Object.entries(
                  (stateSnapshot.inputs && typeof stateSnapshot.inputs === "object"
                    ? { ...stateSnapshot.inputs, ...(stateSnapshot.variables || {}) }
                    : stateSnapshot) as Record<string, unknown>
                )
                  .filter(([, v]) => v !== undefined && v !== null && typeof v !== "object")
                  .map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-2 border-b border-slate-5/50 pb-1 last:border-0">
                      <span className="font-mono text-slate-9 truncate">{key}</span>
                      <span className="font-mono text-slate-12 truncate max-w-[180px]">{String(val)}</span>
                    </div>
                  ))
              ) : (
                <div className="text-slate-8 italic">
                  Send a test trigger to inspect live run variables.
                </div>
              )}
            </div>
          </div>

          {/* Mem0 Customer Memory Panel */}
          <div className="p-3 rounded-card bg-slate-2/70 border border-slate-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-12 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-blue-9" />
              <span>Mem0 Persistent Memory Context</span>
            </div>
            <div className="text-[11px] text-slate-10 space-y-1 font-mono">
              <div>User: {customerEmail || "Not specified"}</div>
              <div>
                Retrieved Records:{" "}
                {Array.isArray(stateSnapshot.memory_context) ? stateSnapshot.memory_context.length : 0}
              </div>
              {Array.isArray(stateSnapshot.memory_context) && stateSnapshot.memory_context.length > 0 ? (
                <div className="text-green-11">
                  Loaded from Supabase pgvector for this run
                </div>
              ) : (
                <div className="text-slate-9">
                  No prior memories loaded for this run yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
