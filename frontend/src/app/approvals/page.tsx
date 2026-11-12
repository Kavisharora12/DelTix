"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, ShieldCheck, UserCheck } from "lucide-react";
import { RunItem } from "@/types";
import { Money } from "@/components/ui/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApprovalDecisionPanel } from "@/components/runs/approval-decision-panel";
import { useDelTixStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function ApprovalsPage() {
  const { runs } = useDelTixStore();

  const pendingRuns = runs.filter((r) => r.status === "PAUSED_FOR_APPROVAL");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    pendingRuns[0]?.id || null
  );

  const selectedRun = pendingRuns.find((r) => r.id === selectedRunId) || pendingRuns[0] || null;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Header */}
      <div className="border-b border-slate-5 bg-panel px-6 md:px-8 py-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-display text-title-page text-slate-12">Human Approval Queue</h1>
          <p className="text-ui font-light text-slate-10 mt-1">
            Non-blocking financial policy gates requiring dual-key cryptographic authorization before disbursement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-badge bg-amber-3 border border-amber-6 text-amber-11 text-ui-xs font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-9" />
            {pendingRuns.length} pending review
          </span>
        </div>
      </div>

      {/* Main Split Layout: Left Table (60%) + Right Decision Sheet (40%) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Table of pending items (Section 7.3) */}
        <div className="flex-[60] border-r border-slate-5 overflow-auto bg-app">
          {pendingRuns.length === 0 ? (
            <div className="p-12 text-center text-slate-10">
              <CheckCircle2 className="h-8 w-8 text-green-9 mx-auto mb-2" />
              <p className="text-title-section text-slate-12">All Approvals Clear</p>
              <p className="text-ui text-slate-10 mt-1">
                No agents are currently blocked awaiting human controller sign-off.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-ui">
              <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
                <tr>
                  <th className="py-2 px-3">Run & Recipient</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3">Rule Triggered</th>
                  <th className="py-2 px-3">Waiting For</th>
                  <th className="py-2 px-3">Requested By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-5">
                {pendingRuns.map((run) => {
                  const isSelected = run.id === selectedRun?.id;
                  const details = run.approvalDetails;

                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={cn(
                        "cursor-pointer transition-colors h-11",
                        isSelected ? "bg-slate-4" : "hover:bg-slate-3"
                      )}
                    >
                      <td className="py-2 px-3">
                        <div className="font-medium text-slate-12 truncate max-w-[200px]">
                          {run.counterparty}
                        </div>
                        <div className="font-mono text-ui-xs text-slate-10 truncate">
                          {run.title}
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <Money cents={run.amountCents} currency={run.currency} align="right" />
                      </td>

                      <td className="py-2 px-3 font-mono text-ui-xs text-amber-11 truncate max-w-[180px]">
                        {details?.triggeredRule || "max_budget_usd"}
                      </td>

                      <td className="py-2 px-3 text-ui-xs text-slate-10 whitespace-nowrap">
                        {details?.waitingSince || "Just now"}
                      </td>

                      <td className="py-2 px-3 text-ui-xs text-slate-11 whitespace-nowrap">
                        {details?.requestedBy || run.agentName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right Sheet Decision Panel */}
        <div className="flex-[40] overflow-y-auto bg-panel p-4">
          {selectedRun ? (
            <div className="space-y-4">
              <div className="border-b border-slate-5 pb-3">
                <div className="text-ui-xs text-slate-10 uppercase tracking-wider font-semibold">
                  Selected Run Review
                </div>
                <div className="text-title-section text-slate-12 mt-1">
                  {selectedRun.title}
                </div>
                <div className="font-mono text-ui-xs text-slate-10 mt-0.5">
                  run_id: {selectedRun.id}
                </div>
              </div>

              <ApprovalDecisionPanel run={selectedRun} />
            </div>
          ) : (
            <div className="p-8 text-center text-slate-10 text-ui-sm">
              Select an item from the approval queue to inspect and authorize payment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

