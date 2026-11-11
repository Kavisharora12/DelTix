import React from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { PolicyRuleEvaluation } from "@/types";
import { cn } from "@/lib/utils";

interface PolicyViewProps {
  evaluations: PolicyRuleEvaluation[];
}

export function PolicyView({ evaluations }: PolicyViewProps) {
  if (evaluations.length === 0) {
    return (
      <div className="flex-1 p-8 text-center text-slate-10 text-ui">
        No policy rule evaluations logged for this run.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-app select-none text-ui">
      <div className="p-3 bg-panel border-b border-slate-5 text-ui-sm text-slate-10 font-medium">
        Policy Gate Evaluation Matrix ({evaluations.length} rules checked)
      </div>

      <table className="w-full border-collapse text-left text-ui">
        <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
          <tr>
            <th className="py-2 px-3 w-48">Rule Name</th>
            <th className="py-2 px-3">Policy Expression</th>
            <th className="py-2 px-3 w-36">Input Value</th>
            <th className="py-2 px-3 w-40">Evaluation Result</th>
            <th className="py-2 px-3 w-32 text-right">Evaluated At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-5">
          {evaluations.map((ev) => {
            return (
              <tr key={ev.id} className="hover:bg-slate-3 transition-colors h-9">
                <td className="py-1.5 px-3 font-medium text-slate-12">
                  {ev.ruleName}
                </td>
                <td className="py-1.5 px-3 font-mono text-ui-xs text-slate-11">
                  {ev.expression}
                </td>
                <td className="py-1.5 px-3 font-mono text-ui-xs text-slate-12">
                  {ev.inputValue}
                </td>
                <td className="py-1.5 px-3">
                  {ev.result === "passed" && (
                    <span className="inline-flex items-center gap-1 text-green-11 text-ui-xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-9" />
                      Passed
                    </span>
                  )}
                  {ev.result === "needs_approval" && (
                    <span className="inline-flex items-center gap-1 text-amber-11 text-ui-xs font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-9" />
                      Needs Approval
                    </span>
                  )}
                  {ev.result === "blocked" && (
                    <span className="inline-flex items-center gap-1 text-red-11 text-ui-xs font-medium">
                      <XCircle className="h-3.5 w-3.5 text-red-9" />
                      Blocked
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-3 text-right font-mono text-ui-xs text-slate-10">
                  {new Date(ev.evaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

