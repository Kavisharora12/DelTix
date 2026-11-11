"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  Ban,
  GitBranch,
  ListOrdered,
  Layers,
  ShieldCheck,
  FileCode2,
} from "lucide-react";
import { RunItem } from "@/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Money } from "@/components/ui/money";
import { KeyFacts } from "@/components/ui/key-facts";
import { Button } from "@/components/ui/button";
import { GraphView } from "./graph-view";
import { TimelineView } from "./timeline-view";
import { CheckpointsView } from "./checkpoints-view";
import { PolicyView } from "./policy-view";
import { RawView } from "./raw-view";
import { useDelTixStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface RunDetailViewProps {
  run: RunItem;
}

export function RunDetailView({ run }: RunDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"graph" | "timeline" | "checkpoints" | "policy" | "raw">("graph");
  const [copiedId, setCopiedId] = useState(false);
  const { rejectRun, retryRunFromCheckpoint } = useDelTixStore();

  const handleCopyId = () => {
    navigator.clipboard.writeText(run.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  // Key facts items per Section 7.2
  const keyFactsItems = [
    {
      label: "Disbursement Amount",
      value: <Money cents={run.amountCents} currency={run.currency} align="left" />,
    },
    {
      label: "Verified Recipient",
      value: run.counterparty,
      secondary: run.counterpartyId,
    },
    {
      label: "Policy Result",
      value: (
        <span
          className={cn(
            run.status === "PAUSED_FOR_APPROVAL"
              ? "text-amber-11"
              : run.status === "FAILED" || run.status === "REJECTED"
              ? "text-red-11"
              : "text-green-11"
          )}
        >
          {run.status === "PAUSED_FOR_APPROVAL"
            ? "Requires Approval"
            : run.status === "FAILED"
            ? "Policy / Tool Blocked"
            : "All Rules Passed"}
        </span>
      ),
    },
    {
      label: "Spend Cap Used (Daily)",
      value: `$${(run.amountCents / 100).toFixed(2)}`,
      secondary: "of $10,000.00",
    },
    {
      label: "Execution Duration",
      value: `${(run.durationMs / 1000).toFixed(2)}s`,
      secondary: run.environment === "sandbox" ? "Sandbox" : "Live",
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Header per Section 7.2 */}
      <div className="border-b border-slate-5 bg-panel p-4 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Back button and title */}
          <div className="flex items-center gap-3">
            <Link
              href="/runs"
              className="p-1.5 rounded text-slate-10 hover:text-slate-12 hover:bg-slate-3 transition-colors"
              title="Back to runs list"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <StatusBadge status={run.status} />

            <div>
              <h1 className="text-title-page text-slate-12 leading-tight">
                {run.title}
              </h1>
              <div className="flex items-center gap-2 text-ui-xs text-slate-10 mt-0.5">
                <span className="font-mono">{run.id}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="hover:text-slate-12 p-0.5"
                  title="Copy run ID"
                >
                  {copiedId ? <Check className="h-3 w-3 text-green-11" /> : <Copy className="h-3 w-3" />}
                </button>
                <span>•</span>
                <span>Agent: <strong className="text-slate-11 font-medium">{run.agentName}</strong></span>
                <span>•</span>
                <span>Started: {new Date(run.startedAt).toUTCString()}</span>
              </div>
            </div>
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-2">
            {run.status === "RUNNING" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectRun(run.id, "Manually cancelled by operator")}
                className="flex items-center gap-1.5"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Cancel run</span>
              </Button>
            )}

            {run.status === "FAILED" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => retryRunFromCheckpoint(run.id)}
                className="flex items-center gap-1.5 hover:border-slate-7 text-slate-12"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry from checkpoint</span>
              </Button>
            )}
          </div>
        </div>

        {/* Key Facts Strip (Hairline borders, not stat cards) */}
        <KeyFacts items={keyFactsItems} />
      </div>

      {/* Navigation Tabs */}
      <div className="h-9 border-b border-slate-5 bg-panel px-4 flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("graph")}
          className={cn(
            "h-full px-3 flex items-center gap-1.5 text-ui font-medium border-b-2 transition-colors",
            activeTab === "graph"
              ? "border-blue-9 text-slate-12"
              : "border-transparent text-slate-10 hover:text-slate-12"
          )}
        >
          <GitBranch className="h-3.5 w-3.5" />
          <span>Graph DAG</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={cn(
            "h-full px-3 flex items-center gap-1.5 text-ui font-medium border-b-2 transition-colors",
            activeTab === "timeline"
              ? "border-blue-9 text-slate-12"
              : "border-transparent text-slate-10 hover:text-slate-12"
          )}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          <span>Event Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("checkpoints")}
          className={cn(
            "h-full px-3 flex items-center gap-1.5 text-ui font-medium border-b-2 transition-colors",
            activeTab === "checkpoints"
              ? "border-blue-9 text-slate-12"
              : "border-transparent text-slate-10 hover:text-slate-12"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Checkpoints</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("policy")}
          className={cn(
            "h-full px-3 flex items-center gap-1.5 text-ui font-medium border-b-2 transition-colors",
            activeTab === "policy"
              ? "border-blue-9 text-slate-12"
              : "border-transparent text-slate-10 hover:text-slate-12"
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Policy Evaluations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("raw")}
          className={cn(
            "h-full px-3 flex items-center gap-1.5 text-ui font-medium border-b-2 transition-colors",
            activeTab === "raw"
              ? "border-blue-9 text-slate-12"
              : "border-transparent text-slate-10 hover:text-slate-12"
          )}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          <span>Raw Snapshot</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === "graph" && <GraphView run={run} />}
        {activeTab === "timeline" && <TimelineView timeline={run.timeline} />}
        {activeTab === "checkpoints" && (
          <CheckpointsView
            checkpoints={run.checkpoints}
            onRetryFromCheckpoint={() => retryRunFromCheckpoint(run.id)}
          />
        )}
        {activeTab === "policy" && <PolicyView evaluations={run.policyEvaluations} />}
        {activeTab === "raw" && <RawView run={run} />}
      </div>
    </div>
  );
}

