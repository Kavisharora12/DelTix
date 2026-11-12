"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  ArrowUpDown,
  Clock,
  ExternalLink,
  ChevronRight,
  X,
  Play,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";
import { RunItem, RunStatus } from "@/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Money } from "@/components/ui/money";
import { KeyFacts } from "@/components/ui/key-facts";
import { Button } from "@/components/ui/button";
import { useDelTixStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface RunsTableProps {
  runs: RunItem[];
}

export function RunsTable({ runs }: RunsTableProps) {
  const router = useRouter();
  const { setSelectedRunId } = useDelTixStore();

  const [activeTab, setActiveTab] = useState<"all" | "approval" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [peekRun, setPeekRun] = useState<RunItem | null>(null);

  // Filter runs based on tab, query, and agent
  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (activeTab === "approval" && run.status !== "PAUSED_FOR_APPROVAL") return false;
      if (activeTab === "failed" && run.status !== "FAILED" && run.status !== "REJECTED") return false;

      if (selectedAgent !== "all" && run.agentId !== selectedAgent) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = run.title.toLowerCase().includes(q);
        const matchesId = run.id.toLowerCase().includes(q);
        const matchesVendor = run.counterparty.toLowerCase().includes(q);
        const matchesAgent = run.agentName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesId && !matchesVendor && !matchesAgent) return false;
      }

      return true;
    });
  }, [runs, activeTab, selectedAgent, searchQuery]);

  // Keyboard navigation: j/k down/up, Enter to open, Space to peek
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedRowIndex((prev) => Math.min(prev + 1, filteredRuns.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedRowIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        const item = filteredRuns[selectedRowIndex];
        if (item) {
          setSelectedRunId(item.id);
          router.push(`/runs/${item.id}`);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        const item = filteredRuns[selectedRowIndex];
        if (item) {
          setPeekRun((prev) => (prev?.id === item.id ? null : item));
        }
      } else if (e.key === "Escape") {
        setPeekRun(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredRuns, selectedRowIndex, router, setSelectedRunId]);

  const uniqueAgents = Array.from(new Set(runs.map((r) => r.agentName)));

  return (
    <div className="flex-1 flex flex-col min-h-0 relative select-none">
      {/* Header and Filter Bar per Section 7.1 */}
      <div className="border-b border-slate-5 bg-panel px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Saved View Tabs */}
        <div className="flex items-center gap-1 bg-slate-3 p-0.5 rounded-btn border border-slate-5">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1 text-ui rounded transition-colors font-medium",
              activeTab === "all" ? "bg-slate-5 text-slate-12" : "text-slate-10 hover:text-slate-12"
            )}
          >
            All runs ({runs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approval")}
            className={cn(
              "px-3 py-1 text-ui rounded transition-colors font-medium flex items-center gap-1.5",
              activeTab === "approval" ? "bg-amber-4 text-amber-12" : "text-slate-10 hover:text-slate-12"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-9" />
            Needs approval ({runs.filter((r) => r.status === "PAUSED_FOR_APPROVAL").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("failed")}
            className={cn(
              "px-3 py-1 text-ui rounded transition-colors font-medium",
              activeTab === "failed" ? "bg-red-4 text-red-12" : "text-slate-10 hover:text-slate-12"
            )}
          >
            Failed ({runs.filter((r) => r.status === "FAILED" || r.status === "REJECTED").length})
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-2">
          {/* Free text search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-10 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter runs, vendors, IDs..."
              className="h-8 pl-8 pr-3 bg-slate-3 border border-slate-5 rounded-btn text-ui text-slate-12 placeholder:text-slate-10 focus:outline-none focus:border-slate-7 w-48 sm:w-64"
            />
          </div>

          {/* Agent filter dropdown */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="h-8 px-2.5 bg-slate-3 border border-slate-5 rounded-btn text-ui text-slate-12 focus:outline-none focus:border-slate-7"
          >
            <option value="all">All agents</option>
            {uniqueAgents.map((ag) => (
              <option key={ag} value={ag}>
                {ag}
              </option>
            ))}
          </select>

          <Link href="/sandbox">
            <Button
              variant="primary"
              size="sm"
              className="h-8 font-semibold shadow-sm flex items-center gap-1.5"
              title="Launch Live Sandbox to trigger and stream a real agent run"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Open Live Sandbox</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto bg-app">
        <table className="w-full border-collapse text-left text-ui">
          {/* Sticky Table Header */}
          <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
            <tr>
              <th className="py-2 px-3 w-40">Status</th>
              <th className="py-2 px-3">Run & ID</th>
              <th className="py-2 px-3">Agent</th>
              <th className="py-2 px-3">Counterparty</th>
              <th className="py-2 px-3 text-right">Amount</th>
              <th className="py-2 px-3 text-right">Started</th>
              <th className="py-2 px-3 text-right">Duration</th>
              <th className="py-2 px-3 w-20 text-center">Env</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-5">
            {filteredRuns.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-10">
                  <div className="max-w-sm mx-auto space-y-2">
                    <p className="text-ui">No runs matching the current filters.</p>
                    <p className="text-ui-xs text-slate-9">
                      Run an agent from a test invoice or clear filters to view historical runs.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRuns.map((run, index) => {
                const isSelected = index === selectedRowIndex;
                const isWaiting = run.status === "PAUSED_FOR_APPROVAL";

                return (
                  <tr
                    key={run.id}
                    onClick={() => {
                      setSelectedRowIndex(index);
                      setSelectedRunId(run.id);
                      router.push(`/runs/${run.id}`);
                    }}
                    className={cn(
                      "h-9 cursor-pointer transition-colors group relative",
                      isSelected ? "bg-slate-4" : "hover:bg-slate-3",
                      isWaiting && !isSelected && "bg-amber-2/30"
                    )}
                  >
                    {/* Status badge */}
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <StatusBadge status={run.status} size="sm" />
                    </td>

                    {/* Run title and mono ID */}
                    <td className="py-1.5 px-3 max-w-[280px]">
                      <div className="font-medium text-slate-12 truncate flex items-center gap-1.5">
                        <span className="truncate">{run.title}</span>
                      </div>
                      <div className="font-mono text-ui-xs text-slate-10 truncate">
                        {run.id}
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="py-1.5 px-3 text-slate-11 whitespace-nowrap">
                      {run.agentName}
                    </td>

                    {/* Counterparty */}
                    <td className="py-1.5 px-3 text-slate-11 max-w-[180px] truncate">
                      <span>{run.counterparty}</span>
                      <span className="font-mono text-ui-xs text-slate-9 ml-1.5 block">
                        {run.counterpartyId}
                      </span>
                    </td>

                    {/* Amount - right-aligned, tabular-nums per Design.md */}
                    <td className="py-1.5 px-3 text-right whitespace-nowrap">
                      <Money cents={run.amountCents} currency={run.currency} align="right" />
                    </td>

                    {/* Started (relative with absolute tooltip) */}
                    <td className="py-1.5 px-3 text-right text-slate-10 whitespace-nowrap text-ui-xs" title={run.startedAt}>
                      {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    {/* Duration */}
                    <td className="py-1.5 px-3 text-right font-mono text-ui-xs text-slate-10 whitespace-nowrap">
                      {(run.durationMs / 1000).toFixed(2)}s
                    </td>

                    {/* Environment */}
                    <td className="py-1.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono",
                          run.environment === "sandbox"
                            ? "bg-amber-3 text-amber-11 border border-amber-6"
                            : "bg-red-3 text-red-11 border border-red-6"
                        )}
                      >
                        {run.environment === "sandbox" ? "SBOX" : "LIVE"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer shortcut bar */}
      <div className="h-7 border-t border-slate-5 bg-panel px-4 flex items-center justify-between text-ui-xs text-slate-10">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="px-1 rounded bg-slate-3 border border-slate-5 text-[10px] font-mono text-slate-12">j</kbd>
            <kbd className="ml-1 px-1 rounded bg-slate-3 border border-slate-5 text-[10px] font-mono text-slate-12">k</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 rounded bg-slate-3 border border-slate-5 text-[10px] font-mono text-slate-12">↵</kbd> open run
          </span>
          <span>
            <kbd className="px-1 rounded bg-slate-3 border border-slate-5 text-[10px] font-mono text-slate-12">space</kbd> quick peek
          </span>
        </div>
        <span className="font-mono text-ui-xs text-slate-9">
          Showing {filteredRuns.length} of {runs.length} runs
        </span>
      </div>

      {/* Right Side Peek Panel (Triggered by Space) */}
      {peekRun && (
        <div className="absolute top-0 right-0 bottom-0 w-[420px] bg-panel border-l border-slate-5 shadow-floating z-20 flex flex-col animate-in slide-in-from-right duration-sheet">
          <div className="p-4 border-b border-slate-5 flex items-center justify-between">
            <div>
              <div className="text-ui-xs text-slate-10">Quick Peek</div>
              <div className="text-title-section text-slate-12 truncate max-w-[320px]">
                {peekRun.title}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPeekRun(null)}
              className="p-1 rounded text-slate-10 hover:text-slate-12 hover:bg-slate-4"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={peekRun.status} showRawCode />
              <Money cents={peekRun.amountCents} currency={peekRun.currency} />
            </div>

            <div className="space-y-2 text-ui text-slate-11">
              <div className="flex justify-between py-1 border-b border-slate-5">
                <span className="text-slate-10">Run ID</span>
                <span className="font-mono text-ui-xs text-slate-12">{peekRun.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-5">
                <span className="text-slate-10">Agent</span>
                <span className="text-slate-12 font-medium">{peekRun.agentName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-5">
                <span className="text-slate-10">Counterparty</span>
                <span className="text-slate-12">{peekRun.counterparty}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-5">
                <span className="text-slate-10">PayPal Account</span>
                <span className="font-mono text-ui-xs text-slate-12">{peekRun.counterpartyId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-5">
                <span className="text-slate-10">Execution Time</span>
                <span className="font-mono text-ui-xs text-slate-12">{(peekRun.durationMs / 1000).toFixed(2)}s</span>
              </div>
            </div>

            {peekRun.approvalDetails && (
              <div className="p-3 bg-amber-3 border border-amber-6 rounded-btn text-amber-11 text-ui-xs space-y-1.5">
                <div className="font-medium text-amber-12 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-9" />
                  Requires Human Approval
                </div>
                <p>{peekRun.approvalDetails.reason}</p>
                <div className="font-mono text-[10px] text-amber-10">
                  {peekRun.approvalDetails.triggeredRule}
                </div>
              </div>
            )}

            {peekRun.failureReason && (
              <div className="p-3 bg-red-3 border border-red-6 rounded-btn text-red-11 text-ui-xs space-y-1">
                <div className="font-medium text-red-12">Failure Reason</div>
                <p>{peekRun.failureReason}</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-5 flex justify-end gap-2 bg-slate-3/30">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPeekRun(null)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedRunId(peekRun.id);
                router.push(`/runs/${peekRun.id}`);
              }}
            >
              Open Full Run Inspector
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

