"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Calculator,
  KeyRound,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function InteractiveSimulator() {
  const [amount, setAmount] = useState<number>(1250);
  const [budgetCap, setBudgetCap] = useState<number>(500);
  const [isSigned, setIsSigned] = useState<boolean>(false);
  const [signedToken, setSignedToken] = useState<string | null>(null);

  const exceedsCap = amount > budgetCap;

  const handleSign = () => {
    const token = `atok_live_${Math.random().toString(36).substring(2, 9)}_sig`;
    setSignedToken(token);
    setIsSigned(true);
  };

  const handleReset = () => {
    setIsSigned(false);
    setSignedToken(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl bg-panel border border-slate-5/80 shadow-2xl p-6 select-none space-y-6">
      {/* Simulator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-blue-3 border border-blue-6 text-blue-11">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-title-section text-slate-12 font-semibold">
              Live Policy & Zero-Math Playground
            </h3>
          </div>
          <p className="text-ui-xs text-slate-10 mt-0.5">
            Test how DelTix evaluates spend thresholds and generates cryptographic authorization tokens in real time.
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-ui-xs text-slate-10 self-start sm:self-auto">
          <RotateCcw className="h-3 w-3 mr-1" />
          <span>Reset Playground</span>
        </Button>
      </div>

      {/* Interactive Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Invoice Amount Input */}
        <div className="p-4 rounded-xl bg-slate-2 border border-slate-5 space-y-2">
          <label className="text-ui-xs text-slate-10 font-medium block">
            1. Invoice Disbursement Amount (USD)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-lg text-slate-10 font-mono font-bold">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(Number(e.target.value));
                handleReset();
              }}
              min={10}
              max={50000}
              step={50}
              className="w-full bg-slate-3 border border-slate-5 rounded-btn px-3 py-1.5 text-lg font-mono font-semibold text-slate-12 focus:outline-none focus:border-blue-9"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-10 font-mono pt-1">
            <span>Quick presets:</span>
            <div className="flex items-center gap-1.5">
              {[250, 500, 1250, 5000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setAmount(val);
                    handleReset();
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-3 border border-slate-5 hover:bg-slate-4 text-slate-11 hover:text-slate-12 text-[10px]"
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Company Policy Cap Slider */}
        <div className="p-4 rounded-xl bg-slate-2 border border-slate-5 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-ui-xs text-slate-10 font-medium">
              2. Company Auto-Approval Cap: <strong className="text-slate-12 font-mono">${budgetCap}.00</strong>
            </label>
          </div>
          <input
            type="range"
            min={100}
            max={2500}
            step={50}
            value={budgetCap}
            onChange={(e) => {
              setBudgetCap(Number(e.target.value));
              handleReset();
            }}
            className="w-full accent-blue-9 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-10">
            <span>$100.00 min</span>
            <span>$2,500.00 max</span>
          </div>
        </div>
      </div>

      {/* Live State Evaluation Board */}
      <div
        className={`p-4 rounded-xl border transition-all duration-300 ${
          exceedsCap && !isSigned
            ? "bg-amber-3/30 border-amber-6 text-amber-11"
            : "bg-green-3/30 border-green-6 text-green-11"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {exceedsCap && !isSigned ? (
                <>
                  <ShieldAlert className="h-5 w-5 text-amber-9 shrink-0" />
                  <span className="font-semibold text-title-section text-amber-12">
                    STATUS: PAUSED_FOR_APPROVAL
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-9 shrink-0" />
                  <span className="font-semibold text-title-section text-green-12">
                    STATUS: {isSigned ? "AUTHORIZED_BY_CONTROLLER" : "AUTO_POLICY_ALLOWED"}
                  </span>
                </>
              )}
            </div>

            <p className="text-ui-xs leading-relaxed max-w-xl">
              {exceedsCap && !isSigned
                ? `Invoice amount ($${amount}.00) exceeds policy cap ($${budgetCap}.00). The agent safely suspended mutation and requires dual-key cryptographic release.`
                : isSigned
                ? `Cryptographic HMAC token successfully minted and verified. Disbursement released to PayPal Payouts with idempotency lock.`
                : `Amount ($${amount}.00) is within auto-spend threshold ($${budgetCap}.00). Mathematical grounding verified with 0-cent error.`}
            </p>
          </div>

          {/* Action Trigger Button */}
          {exceedsCap && !isSigned && (
            <Button
              variant="primary"
              size="default"
              onClick={handleSign}
              className="bg-amber-9 text-slate-1 hover:bg-amber-10 shrink-0 flex items-center gap-2 font-medium"
            >
              <KeyRound className="h-4 w-4" />
              <span>Sign HMAC Token</span>
            </Button>
          )}

          {isSigned && (
            <div className="text-right shrink-0">
              <span className="px-2.5 py-1 rounded-badge bg-green-3 border border-green-6 text-green-11 font-mono text-ui-xs font-semibold">
                PAYMENT RELEASED
              </span>
            </div>
          )}
        </div>

        {/* Minted Token Pill */}
        {signedToken && (
          <div className="mt-3 pt-3 border-t border-green-6/40 flex items-center justify-between text-ui-xs font-mono text-slate-11">
            <span>Minted Dual-Key Signature:</span>
            <code className="text-green-11 font-semibold bg-slate-3 px-2 py-0.5 rounded border border-slate-5">
              {signedToken}
            </code>
          </div>
        )}
      </div>

      {/* Terminal Proof Inspection */}
      <div className="p-3 bg-slate-1 rounded-xl border border-slate-5 text-ui-xs font-mono text-slate-10 space-y-1">
        <div className="text-slate-11 font-sans font-medium flex items-center gap-1.5 mb-1">
          <Calculator className="h-3.5 w-3.5 text-blue-9" />
          <span>Execution Engine Proof Telemetry:</span>
        </div>
        <div>
          [AST_MATH] Python Decimal AST computed amount = {amount}.00 USD (tolerance: $0.00)
        </div>
        <div>
          [POLICY] Rule 'amount &lt;= cap' evaluated: {amount} &lt;= {budgetCap} →{" "}
          <span className={exceedsCap ? "text-amber-11 font-bold" : "text-green-11 font-bold"}>
            {exceedsCap ? "TRIGGER_APPROVAL" : "PASS"}
          </span>
        </div>
        <div>
          [IDEMPOTENCY] Pre-recorded intent key: idem_{amount}usd_run442 locked
        </div>
      </div>
    </div>
  );
}

