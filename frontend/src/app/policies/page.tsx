"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Plus, CheckCircle2, AlertTriangle, Lock, Server, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PolicyRule {
  id: string;
  name: string;
  scope: string; // e.g. "payables-reconciler" or "global"
  expression: string;
  actionOnViolation: "REQUIRE_HUMAN_APPROVAL" | "REJECT_RUN" | "CIRCUIT_BREAK";
  currentLimit: string;
  status: "active" | "disabled";
}

interface LiveCapability {
  capability_id: string;
  version: string;
  description: string;
  http_method: string;
  endpoint_path: string;
  is_mutation: boolean;
  idempotent: boolean;
  required_permissions?: string[];
  status: string;
}

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState<"policies" | "capabilities">("policies");
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [capabilities, setCapabilities] = useState<LiveCapability[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingCaps(true);
    setLoadingPolicies(true);

    // Fetch live capabilities from backend
    api.listCapabilities()
      .then((data) => {
        if (mounted && data.capabilities) {
          setCapabilities(data.capabilities);
        }
      })
      .catch((err) => {
        console.warn("Could not load remote capabilities registry:", err);
      })
      .finally(() => {
        if (mounted) setLoadingCaps(false);
      });

    // Derive active policies directly from compiled agent specifications
    api.listSpecs()
      .then((specs) => {
        if (!mounted) return;
        const derived: PolicyRule[] = [];
        specs.forEach((s) => {
          const ir = s.agent_ir || s.ir_payload;
          const pol = ir?.policies;
          if (pol?.max_budget_usd !== undefined && pol.max_budget_usd > 0) {
            derived.push({
              id: `pol_${s.spec_id}_budget`,
              name: "max_budget_usd",
              scope: s.name,
              expression: `disbursement_amount_usd <= ${pol.max_budget_usd.toFixed(2)}`,
              actionOnViolation: "REQUIRE_HUMAN_APPROVAL",
              currentLimit: `$${pol.max_budget_usd.toFixed(2)} / run`,
              status: "active",
            });
          }
          if (pol?.human_approval_threshold_usd !== undefined && pol.human_approval_threshold_usd > 0) {
            derived.push({
              id: `pol_${s.spec_id}_threshold`,
              name: "human_approval_threshold_usd",
              scope: s.name,
              expression: `amount_usd > ${pol.human_approval_threshold_usd.toFixed(2)}`,
              actionOnViolation: "REQUIRE_HUMAN_APPROVAL",
              currentLimit: `$${pol.human_approval_threshold_usd.toFixed(2)} gate`,
              status: "active",
            });
          } else if (pol?.require_human_approval) {
            derived.push({
              id: `pol_${s.spec_id}_human_gate`,
              name: "require_human_approval",
              scope: s.name,
              expression:
                pol.approval_triggers && pol.approval_triggers.length > 0
                  ? pol.approval_triggers.join(" OR ")
                  : "require_human_approval == true",
              actionOnViolation: "REQUIRE_HUMAN_APPROVAL",
              currentLimit: "Human Sign-Off Required",
              status: "active",
            });
          }
          const capIds =
            pol?.allowed_capabilities && pol.allowed_capabilities.length > 0
              ? pol.allowed_capabilities
              : (ir?.capabilities || []).map((c) => c.capability_id);
          if (capIds.length > 0) {
            derived.push({
              id: `pol_${s.spec_id}_caps`,
              name: "capability_whitelist",
              scope: s.name,
              expression: `dispatched_capability in [${capIds.join(", ")}]`,
              actionOnViolation: "REJECT_RUN",
              currentLimit: `${capIds.length} capabilities permitted`,
              status: "active",
            });
          }
          if (pol?.read_only) {
            derived.push({
              id: `pol_${s.spec_id}_readonly`,
              name: "read_only_enforcement",
              scope: s.name,
              expression: "is_mutation == false",
              actionOnViolation: "REJECT_RUN",
              currentLimit: "Mutations blocked",
              status: "active",
            });
          }
        });
        setPolicies(derived);
      })
      .catch((err) => {
        console.warn("Could not load agent specs for policy derivation:", err);
      })
      .finally(() => {
        if (mounted) setLoadingPolicies(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Header */}
      <div className="border-b border-slate-5 bg-panel px-6 md:px-8 py-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-display text-title-page text-slate-12">Spend Policies &amp; Capability Guards</h1>
          <p className="text-ui font-light text-slate-10 mt-1">
            Deterministic security boundaries executed outside LLMs to safeguard treasury balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-3 p-0.5 rounded-btn border border-slate-5">
            <button
              type="button"
              onClick={() => setActiveTab("policies")}
              className={cn(
                "px-3 py-1 text-ui rounded font-medium transition-colors",
                activeTab === "policies" ? "bg-slate-5 text-slate-12" : "text-slate-10 hover:text-slate-12"
              )}
            >
              Policy Rules ({policies.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("capabilities")}
              className={cn(
                "px-3 py-1 text-ui rounded font-medium transition-colors",
                activeTab === "capabilities" ? "bg-slate-5 text-slate-12" : "text-slate-10 hover:text-slate-12"
              )}
            >
              Capability Registry ({capabilities.length})
            </button>
          </div>

          <Link href="/studio/new">
            <Button
              variant="primary"
              size="sm"
              className="flex items-center gap-1.5 font-semibold shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Compile Policy in Studio</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-app">
        {activeTab === "policies" ? (
          policies.length === 0 ? (
            <div className="p-16 text-center text-slate-10 max-w-md mx-auto space-y-3">
              <ShieldCheck className="h-10 w-10 text-slate-8 mx-auto stroke-1" />
              <h3 className="text-title-section text-slate-12">No Policy Rules Configured Yet</h3>
              <p className="text-ui-xs text-slate-10">
                Compile an agent specification in the Studio to establish active spend limits, permitted capabilities, and human approval thresholds.
              </p>
              <div className="pt-2">
                <Link href="/studio/new">
                  <Button variant="primary" size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Compile First Agent
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
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
          )
        ) : (
          <div>
            {loadingCaps ? (
              <div className="p-16 text-center text-slate-10 space-y-2">
                <div className="w-5 h-5 border-2 border-blue-9 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-ui-xs">Querying PostgreSQL capability registry...</p>
              </div>
            ) : capabilities.length === 0 ? (
              <div className="p-16 text-center text-slate-10 max-w-md mx-auto space-y-2">
                <Server className="h-8 w-8 text-slate-8 mx-auto stroke-1" />
                <h3 className="text-title-section text-slate-12">No Capabilities Registered</h3>
                <p className="text-ui-xs">
                  Run the database migration <code className="font-mono">001_initial_schema.sql</code> to register official PayPal Sandbox adapters.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-ui">
                <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
                  <tr>
                    <th className="py-2 px-3 w-64">Capability ID</th>
                    <th className="py-2 px-3 w-24">Version</th>
                    <th className="py-2 px-3 w-28">Method & Path</th>
                    <th className="py-2 px-3">Contract Description</th>
                    <th className="py-2 px-3 w-32 text-center">Idempotent</th>
                    <th className="py-2 px-3 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-5">
                  {capabilities.map((c) => (
                    <tr key={c.capability_id} className="hover:bg-slate-3 transition-colors h-10">
                      <td className="py-2 px-3 font-mono text-ui-xs text-slate-12 font-medium">
                        {c.capability_id}
                      </td>
                      <td className="py-2 px-3 font-mono text-ui-xs text-slate-10">
                        {c.version}
                      </td>
                      <td className="py-2 px-3 font-mono text-ui-xs">
                        <span className="px-1 py-0.5 rounded bg-blue-3 text-blue-11 border border-blue-6 mr-1">
                          {c.http_method}
                        </span>
                        <span className="text-slate-10">{c.endpoint_path}</span>
                      </td>
                      <td className="py-2 px-3 text-ui-xs text-slate-11">
                        {c.description}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                            c.idempotent
                              ? "bg-green-3 border-green-6 text-green-11"
                              : "bg-amber-3 border-amber-6 text-amber-11"
                          )}
                        >
                          {c.idempotent ? "IDEMPOTENT" : "MUTATION"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-green-11 text-ui-xs font-medium">
                          <CheckCircle2 className="h-3 w-3 text-green-9" />
                          {c.status || "ACTIVE"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
