"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Bot,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Play,
  ChevronRight,
  DollarSign,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDelTixStore } from "@/lib/store";

export default function DashboardPage() {
  const { runs, agents, tenantId, init } = useDelTixStore();

  useEffect(() => {
    init();
  }, [init]);

  // Compute live metrics from actual runs & agents
  const completedRuns = runs.filter((r) => r.status === "COMPLETED");
  const pendingApprovals = runs.filter((r) => r.status === "PAUSED_FOR_APPROVAL");
  const failedOrRejectedRuns = runs.filter((r) => r.status === "FAILED" || r.status === "REJECTED");

  const totalSettledCents = completedRuns.reduce((sum, r) => sum + (r.settledCents ?? 0), 0);
  const totalSavedCents =
    failedOrRejectedRuns.reduce((sum, r) => sum + (r.amountCents || 0), 0) +
    pendingApprovals.reduce((sum, r) => sum + (r.approvalDetails?.amountCents || r.amountCents || 0), 0);

  const activeAgentsCount = agents.length;
  const runningExecutionsCount = runs.filter((r) => r.status === "RUNNING").length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#000000] text-white font-sans overflow-y-auto">
      {/* Top Header */}
      <div className="border-b border-[#232323] bg-[#050505] px-6 md:px-8 py-7">
        <div className="max-w-[1360px] mx-auto w-full flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[28px] md:text-[32px] font-normal text-white leading-[1.15] tracking-tight">
                Financial AI Agent Operations
              </h1>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-[#E8602E]/10 border border-[#E8602E]/30 text-[#E8602E] font-medium">
                TENANT: {tenantId || "—"}
              </span>
            </div>
            <p className="text-[14px] md:text-[15px] font-light text-[#979797] mt-1.5">
              Real-time overview of autonomous financial workflows, spend limits, and human approval gates.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/sandbox"
              className="h-9 px-4 rounded-lg border-[0.5px] border-[#4E4A48] bg-gradient-to-b from-[#171212] to-[#100B0B] hover:from-[#211A1A] hover:to-[#161010] text-[13.5px] font-normal text-[#E5E5E5] hover:text-white inline-flex items-center gap-2 transition-all"
            >
              <Play className="h-3.5 w-3.5 text-[#E8602E]" />
              <span>Live Sandbox</span>
            </Link>
            <Link
              href="/studio/new"
              className="h-9 px-4 rounded-lg bg-[#E8602E] hover:bg-[#d45222] text-[13.5px] font-medium text-white inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Compile New Agent</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-8 py-7 space-y-7 max-w-[1360px] mx-auto w-full">
        {/* Workspace Financial Snapshot (4 KPI Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Settled Volume */}
          <div className="bg-[#080808] border border-[#232323] rounded-xl p-5 flex flex-col justify-between hover:border-[#3A3533] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#898989] uppercase tracking-[0.08em]">
                Total Settled Volume
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[26px] md:text-[28px] font-bold tracking-tight font-mono text-white leading-none">
                <Money amountCents={totalSettledCents} />
              </div>
              <div className="flex items-center gap-1.5 text-[12.5px] text-emerald-400 mt-2 font-normal">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{completedRuns.length} transactions executed</span>
              </div>
            </div>
          </div>

          {/* 2. Active Agents */}
          <div className="bg-[#080808] border border-[#232323] rounded-xl p-5 flex flex-col justify-between hover:border-[#3A3533] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#898989] uppercase tracking-[0.08em]">
                Active Agents
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#E8602E]/10 border border-[#E8602E]/30 flex items-center justify-center text-[#E8602E]">
                <Bot className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[26px] md:text-[28px] font-bold tracking-tight font-mono text-white leading-none">
                {activeAgentsCount}{" "}
                <span className="text-[14px] font-sans font-normal text-[#898989]">Compiled</span>
              </div>
              <div className="flex items-center gap-1.5 text-[12.5px] text-[#898989] mt-2 font-normal">
                <Activity className="h-3.5 w-3.5 text-[#E8602E]" />
                <span>{runningExecutionsCount} active runs in progress</span>
              </div>
            </div>
          </div>

          {/* 3. Pending Approvals */}
          <div
            className={`bg-[#080808] border rounded-xl p-5 flex flex-col justify-between transition-colors ${
              pendingApprovals.length > 0
                ? "border-amber-500/40 bg-amber-950/15"
                : "border-[#232323] hover:border-[#3A3533]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#898989] uppercase tracking-[0.08em]">
                Pending Approvals
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  pendingApprovals.length > 0
                    ? "bg-amber-500/15 border border-amber-500/40 text-amber-400"
                    : "bg-[#121212] border border-[#232323] text-[#898989]"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[26px] md:text-[28px] font-bold tracking-tight font-mono text-white leading-none">
                {pendingApprovals.length}{" "}
                <span className="text-[14px] font-sans font-normal text-[#898989]">Waiting</span>
              </div>
              <div className="mt-2">
                {pendingApprovals.length > 0 ? (
                  <Link
                    href="/approvals"
                    className="text-[12.5px] text-amber-400 hover:underline font-medium flex items-center gap-1"
                  >
                    Action Required &bull; Review Gate &rarr;
                  </Link>
                ) : (
                  <span className="text-[12.5px] text-[#6B6B6B]">All gates clear</span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Protected by Caps */}
          <div className="bg-[#080808] border border-[#232323] rounded-xl p-5 flex flex-col justify-between hover:border-[#3A3533] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#898989] uppercase tracking-[0.08em]">
                Protected by Caps
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#E8602E]/10 border border-[#E8602E]/30 flex items-center justify-center text-[#E8602E]">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[26px] md:text-[28px] font-bold tracking-tight font-mono text-white leading-none">
                <Money amountCents={totalSavedCents} />
              </div>
              <div className="flex items-center gap-1.5 text-[12.5px] text-[#E8602E] mt-2 font-normal">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{failedOrRejectedRuns.length + pendingApprovals.length} limit enforcement events</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/studio/new"
            className="p-5 bg-[#080808] border border-[#232323] rounded-xl hover:border-[#E8602E]/50 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#E8602E]/10 border border-[#E8602E]/30 text-[#E8602E] flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[15px] font-medium text-white group-hover:text-[#E8602E] transition-colors">
                  Agent Compiler Studio
                </div>
                <div className="text-[13px] font-light text-[#898989] mt-0.5">
                  Prompt workflows in plain English
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#6B6B6B] group-hover:text-white transition-colors shrink-0" />
          </Link>

          <Link
            href="/sandbox"
            className="p-5 bg-[#080808] border border-[#232323] rounded-xl hover:border-emerald-500/40 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Play className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[15px] font-medium text-white group-hover:text-emerald-400 transition-colors">
                  Live Chat Sandbox
                </div>
                <div className="text-[13px] font-light text-[#898989] mt-0.5">
                  Test triggers with live SSE stream
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#6B6B6B] group-hover:text-white transition-colors shrink-0" />
          </Link>

          <Link
            href="/approvals"
            className="p-5 bg-[#080808] border border-[#232323] rounded-xl hover:border-amber-500/40 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[15px] font-medium text-white group-hover:text-amber-400 transition-colors">
                  Human Approval Gates
                </div>
                <div className="text-[13px] font-light text-[#898989] mt-0.5">
                  {pendingApprovals.length} actions requiring sign-off
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#6B6B6B] group-hover:text-white transition-colors shrink-0" />
          </Link>
        </div>

        {/* Recent Agent Executions Table */}
        <div className="bg-[#080808] border border-[#232323] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#232323] flex items-center justify-between">
            <div>
              <h2 className="font-display text-[17px] font-normal text-white">
                Recent Agent Executions
              </h2>
              <p className="text-[13px] font-light text-[#898989] mt-0.5">
                Live record of transactional runs, policy checks, and disbursement states.
              </p>
            </div>
            <Link
              href="/runs"
              className="text-[13px] text-[#898989] hover:text-[#E8602E] transition-colors font-normal"
            >
              View All Runs &rarr;
            </Link>
          </div>

          {runs.length === 0 ? (
            <div className="p-14 text-center">
              <Bot className="h-10 w-10 text-[#4E4A48] mx-auto mb-3" />
              <h3 className="text-[15px] font-medium text-white">
                No agent executions recorded yet
              </h3>
              <p className="text-[13px] font-light text-[#898989] mt-1 max-w-sm mx-auto">
                Create an agent specification in the Studio or trigger a test run in the Live Sandbox.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link
                  href="/studio/new"
                  className="h-9 px-4 rounded-lg bg-[#E8602E] hover:bg-[#d45222] text-[13.5px] font-medium text-white inline-flex items-center gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Compile First Agent</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[#232323] bg-[#0C0C0C] text-[#898989] text-[12px] font-medium select-none">
                    <th className="py-3 px-5">Agent Name</th>
                    <th className="py-3 px-5">Trigger / Input</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Spend</th>
                    <th className="py-3 px-5">Started</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {runs.slice(0, 8).map((run) => (
                    <tr
                      key={run.id}
                      className="hover:bg-[#0E0E0E] transition-colors group"
                    >
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-white">
                          {run.agentName}
                        </div>
                        <div className="text-[11px] font-mono text-[#6B6B6B] truncate max-w-[190px] mt-0.5">
                          {run.id}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="text-[#D4D4D4] truncate max-w-[240px]">
                          {run.title}
                        </div>
                        <div className="text-[12px] text-[#6B6B6B] truncate max-w-[240px] mt-0.5">
                          To: {run.counterparty}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-medium text-white">
                        <Money amountCents={run.status === "COMPLETED" ? (run.settledCents ?? 0) : run.amountCents} />
                      </td>
                      <td className="py-3.5 px-5 text-[#898989] font-mono text-[12px]">
                        {new Date(run.startedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {run.status === "PAUSED_FOR_APPROVAL" ? (
                          <Link href="/approvals">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2.5 text-[12px] text-amber-400 border-amber-500/40 bg-amber-950/30 hover:bg-amber-950/50"
                            >
                              Review Gate
                            </Button>
                          </Link>
                        ) : (
                          <Link
                            href={`/runs/${run.id}`}
                            className="text-[12.5px] text-[#898989] hover:text-white transition-colors"
                          >
                            View Run &rarr;
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
