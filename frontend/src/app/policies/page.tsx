"use client";

import React, { useState } from "react";
import { ShieldCheck, Plus, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PolicyRule {
  id: string;
  name: string;
  scope: string; // e.g. "payables-reconciler" or "global"
  expression: string;
  actionOnViolation: "REQUIRE_HUMAN_APPROVAL" | "REJECT_RUN" | "CIRCUIT_BREAK";
  currentLimit: string;
  status: "active" | "disabled";
}

const INITIAL_POLICIES: PolicyRule[] = [
  {
    id: "pol_01",
    name: "max_budget_usd",
    scope: "global",
    expression: "disbursement_amount_usd <= 500.00",
    actionOnViolation: "REQUIRE_HUMAN_APPROVAL",
    currentLimit: "$500.00 / txn",
    status: "active",
  },
  {
    id: "pol_02",
    name: "daily_tenant_spend_cap",
    scope: "global",
    expression: "sum(disbursements_24h_usd) <= 10000.00",
    actionOnViolation: "REQUIRE_HUMAN_APPROVAL",
    currentLimit: "$10,000.00 / day",
    status: "active",
  },
  {
    id: "pol_03",
    name: "approved_vendor_whitelist_only",
    scope: "payables-reconciler",
    expression: "recipient_paypal_id in tenant_approved_vendors",
    actionOnViolation: "REJECT_RUN",
    currentLimit: "Enforced",
    status: "active",
  },
  {
    id: "pol_04",
    name: "zero_tolerance_grounding",
    scope: "global",
    expression: "recomputed_math_variance_cents == 0",
    actionOnViolation: "REJECT_RUN",
    currentLimit: "$0.00 tolerance",
    status: "active",
  },
  {
    id: "pol_05",
    name: "idempotency_duplicate_guard",
    scope: "global",
    expression: "action_intents.exists(idempotency_key) == false",
    actionOnViolation: "REJECT_RUN",
    currentLimit: "Strict unique key",
    status: "active",
  },
  {
    id: "pol_06",
    name: "consecutive_failure_circuit_breaker",
    scope: "paypal.batch_payout",
    expression: "consecutive_upstream_timeouts < 5",
    actionOnViolation: "CIRCUIT_BREAK",
    currentLimit: "5 timeouts (60s reset)",
    status: "active",
  },
];

export default function PoliciesPage() {
  const [policies] = useState<PolicyRule[]>(INITIAL_POLICIES);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Header */}
      <div className="border-b border-slate-5 bg-panel p-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-title-page text-slate-12">Spend Policies & Capability Guards</h1>
          <p className="text-ui text-slate-10 mt-0.5">
            Deterministic security boundaries executed outside LLMs to safeguard treasury balances.
          </p>
        </div>

        <Button variant="primary" size="sm" className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>New Policy Rule</span>
        </Button>
      </div>

      {/* Policies Table */}
      <div className="flex-1 overflow-auto bg-app">
        <table className="w-full border-collapse text-left text-ui">
          <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
            <tr>
              <th className="py-2 px-3 w-48">Policy Rule</th>
              <th className="py-2 px-3 w-36">Scope</th>
              <th className="py-2 px-3">Deterministic Expression</th>
              <th className="py-2 px-3 w-40">Current Threshold</th>
              <th className="py-2 px-3 w-48">Action on Exceed</th>
              <th className="py-2 px-3 w-24 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-5">
            {policies.map((pol) => (
              <tr key={pol.id} className="hover:bg-slate-3 transition-colors h-10">
                <td className="py-2 px-3 font-medium text-slate-12">
                  {pol.name}
                </td>

                <td className="py-2 px-3 font-mono text-ui-xs text-slate-10">
                  {pol.scope}
                </td>

                <td className="py-2 px-3 font-mono text-ui-xs text-slate-11">
                  {pol.expression}
                </td>

                <td className="py-2 px-3 text-slate-12 font-medium">
                  {pol.currentLimit}
                </td>

                <td className="py-2 px-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${
                      pol.actionOnViolation === "REQUIRE_HUMAN_APPROVAL"
                        ? "bg-amber-3 border-amber-6 text-amber-11"
                        : "bg-red-3 border-red-6 text-red-11"
                    }`}
                  >
                    {pol.actionOnViolation}
                  </span>
                </td>

                <td className="py-2 px-3 text-center">
                  <span className="inline-flex items-center gap-1 text-green-11 text-ui-xs font-medium">
                    <CheckCircle2 className="h-3 w-3 text-green-9" />
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

