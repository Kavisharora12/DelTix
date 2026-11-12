"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Bot,
  AlertTriangle,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  ExternalLink,
  Play,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDelTixStore } from "@/lib/store";

export default function DashboardPage() {
  const { runs, agents, tenantId, init, isLoading } = useDelTixStore();

  useEffect(() => {
    init();
  }, [init]);

  // Compute live metrics from actual runs & agents
  const completedRuns = runs.filter((r) => r.status === "COMPLETED");
  const pendingApprovals = runs.filter((r) => r.status === "PAUSED_FOR_APPROVAL");
  const failedOrRejectedRuns = runs.filter((r) => r.status === "FAILED" || r.status === "REJECTED");

  const totalSettledCents = completedRuns.reduce((sum, r) => sum + (r.settledCents ?? 0), 0);
  const totalSavedCents = failedOrRejectedRuns.reduce((sum, r) => sum + (r.amountCents || 0), 0) +
    pendingApprovals.reduce((sum, r) => sum + (r.approvalDetails?.amountCents || r.amountCents || 0), 0);

  const activeAgentsCount = agents.length;
  const runningExecutionsCount = runs.filter((r) => r.status === "RUNNING").length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-1 overflow-y-auto">
      {/* Top Header */}
      <div className="border-b border-slate-5 bg-panel px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-12 tracking-tight">
                Financial AI Agent Operations
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-3 border border-blue-6 text-blue-11 font-medium">
                TENANT: {tenantId || "—"}
              </span>
            </div>
              <p className="text-sm text-slate-10 mt-1">
                Real-time overview of autonomous financial workflows, spend limits, and human approval gates.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link href="/sandbox">
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Play className="h-3.5 w-3.5 text-blue-11" />
                  Live Sandbox
                </Button>
              </Link>
              <Link href="/studio/new">
                <Button variant="primary" size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  + Compile New Agent
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Workspace Financial Snapshot (4 KPI Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Settled Volume */}
            <div className="bg-panel border border-slate-5 rounded-card p-4 flex flex-col justify-between hover:border-slate-7 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-10 uppercase tracking-wider">
                  Total Settled Volume
                </span>
                <div className="w-7 h-7 rounded bg-green-3 border border-green-6 flex items-center justify-center text-green-11">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight font-mono text-slate-12">
                  <Money amountCents={totalSettledCents} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-11 mt-1 font-medium">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{completedRuns.length} transactions executed</span>
                </div>
              </div>
            </div>

            {/* 2. Active Agents */}
            <div className="bg-panel border border-slate-5 rounded-card p-4 flex flex-col justify-between hover:border-slate-7 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-10 uppercase tracking-wider">
                  Active Agents
                </span>
                <div className="w-7 h-7 rounded bg-blue-3 border border-blue-6 flex items-center justify-center text-blue-11">
                  <Bot className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight font-mono text-slate-12">
                  {activeAgentsCount} <span className="text-sm font-normal text-slate-10">Compiled</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-10 mt-1 font-medium">
                  <Activity className="h-3.5 w-3.5 text-blue-9" />
                  <span>{runningExecutionsCount} active runs in progress</span>
                </div>
              </div>
            </div>

            {/* 3. Pending Approvals */}
            <div
              className={`bg-panel border rounded-card p-4 flex flex-col justify-between transition-colors ${
                pendingApprovals.length > 0
                  ? "border-amber-7/50 bg-amber-2/20"
                  : "border-slate-5 hover:border-slate-7"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-10 uppercase tracking-wider">
                  Pending Approvals
                </span>
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center ${
                    pendingApprovals.length > 0
                      ? "bg-amber-3 border border-amber-6 text-amber-11"
                      : "bg-slate-3 border border-slate-5 text-slate-10"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight font-mono text-slate-12">
                  {pendingApprovals.length}{" "}
                  <span className="text-sm font-normal text-slate-10">Waiting</span>
                </div>
                <div className="mt-1">
                  {pendingApprovals.length > 0 ? (
                    <Link
                      href="/approvals"
                      className="text-xs text-amber-11 hover:underline font-medium flex items-center gap-1"
                    >
                      Action Required &bull; Review Gate &rarr;
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-9">All gates clear</span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Saved by Caps */}
            <div className="bg-panel border border-slate-5 rounded-card p-4 flex flex-col justify-between hover:border-slate-7 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-10 uppercase tracking-wider">
                  Protected by Caps
                </span>
                <div className="w-7 h-7 rounded bg-purple-3 border border-purple-6 flex items-center justify-center text-purple-11">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight font-mono text-slate-12">
                  <Money amountCents={totalSavedCents} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-purple-11 mt-1 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{failedOrRejectedRuns.length + pendingApprovals.length} limit enforcement events</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/studio/new"
              className="p-3.5 bg-panel border border-slate-5 rounded-card hover:border-slate-7 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-blue-3 border border-blue-6 text-blue-11 flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-12 group-hover:text-blue-11 transition-colors">
                    Agent Compiler Studio
                  </div>
                  <div className="text-xs text-slate-9">
                    Prompt workflows in plain English
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-8 group-hover:text-slate-12 transition-colors" />
            </Link>

            <Link
              href="/sandbox"
              className="p-3.5 bg-panel border border-slate-5 rounded-card hover:border-slate-7 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-green-3 border border-green-6 text-green-11 flex items-center justify-center">
                  <Play className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-12 group-hover:text-green-11 transition-colors">
                    Live Chat Sandbox
                  </div>
                  <div className="text-xs text-slate-9">
                    Test triggers with live SSE stream
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-8 group-hover:text-slate-12 transition-colors" />
            </Link>

            <Link
              href="/approvals"
              className="p-3.5 bg-panel border border-slate-5 rounded-card hover:border-slate-7 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-amber-3 border border-amber-6 text-amber-11 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-12 group-hover:text-amber-11 transition-colors">
                    Human Approval Gates
                  </div>
                  <div className="text-xs text-slate-9">
                    {pendingApprovals.length} actions requiring sign-off
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-8 group-hover:text-slate-12 transition-colors" />
            </Link>
          </div>

          {/* Recent Agent Executions Table */}
          <div className="bg-panel border border-slate-5 rounded-card overflow-hidden">
            <div className="p-4 border-b border-slate-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-12">
                  Recent Agent Executions
                </h2>
                <p className="text-xs text-slate-9 mt-0.5">
                  Live record of transactional runs, policy checks, and disbursement states.
                </p>
              </div>
              <Link href="/runs">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  View All Runs &rarr;
                </Button>
              </Link>
            </div>

            {runs.length === 0 ? (
              <div className="p-12 text-center">
                <Bot className="h-10 w-10 text-slate-8 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-slate-12">
                  No agent executions recorded yet
                </h3>
                <p className="text-xs text-slate-9 mt-1 max-w-sm mx-auto">
                  Create an agent specification in the Studio or trigger a test run in the Live Sandbox.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Link href="/studio/new">
                    <Button variant="primary" size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Compile First Agent
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-5 bg-slate-2/50 text-slate-10 font-medium select-none">
                      <th className="py-2.5 px-4">Agent Name</th>
                      <th className="py-2.5 px-4">Trigger / Input</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Spend</th>
                      <th className="py-2.5 px-4">Started</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-5">
                    {runs.slice(0, 8).map((run) => (
                      <tr
                        key={run.id}
                        className="hover:bg-slate-2 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-12">
                            {run.agentName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-9 truncate max-w-[180px]">
                            {run.id}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-11 truncate max-w-[220px]">
                            {run.title}
                          </div>
                          <div className="text-[11px] text-slate-9 truncate max-w-[220px]">
                            To: {run.counterparty}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-12">
                          <Money amountCents={run.status === "COMPLETED" ? (run.settledCents ?? 0) : run.amountCents} />
                        </td>
                        <td className="py-3 px-4 text-slate-10 font-mono text-[11px]">
                          {new Date(run.startedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {run.status === "PAUSED_FOR_APPROVAL" ? (
                            <Link href="/approvals">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-amber-11 border-amber-6 bg-amber-2 hover:bg-amber-3"
                              >
                                Review Gate
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/runs/${run.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-slate-10 hover:text-slate-12"
                              >
                                View Run &rarr;
                              </Button>
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
