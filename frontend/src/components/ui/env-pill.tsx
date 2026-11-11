import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EnvPillProps {
  mode: "sandbox" | "live";
  onChange?: (mode: "sandbox" | "live") => void;
  className?: string;
}

export function EnvPill({ mode, onChange, className }: EnvPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-badge border text-ui-xs font-medium select-none overflow-hidden h-6",
        mode === "sandbox"
          ? "bg-amber-3 border-amber-6 text-amber-11"
          : "bg-red-3 border-red-6 text-red-11",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange?.("sandbox")}
        className={cn(
          "px-2 h-full inline-flex items-center gap-1 transition-colors",
          mode === "sandbox"
            ? "bg-amber-4 text-amber-12 font-semibold"
            : "text-slate-10 hover:text-slate-12"
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-9" />
        Sandbox
      </button>
      <span className="w-[1px] h-3 bg-slate-6" />
      <button
        type="button"
        onClick={() => onChange?.("live")}
        className={cn(
          "px-2 h-full inline-flex items-center gap-1 transition-colors",
          mode === "live"
            ? "bg-red-4 text-red-12 font-semibold"
            : "text-slate-10 hover:text-slate-12"
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-9" />
        Live
      </button>
    </div>
  );
}

export function SandboxBanner({ mode }: { mode: "sandbox" | "live" }) {
  if (mode !== "sandbox") return null;

  return (
    <div className="w-full h-7 bg-amber-3 border-b border-amber-6 px-4 flex items-center justify-between text-ui-xs text-amber-11 select-none">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-9 shrink-0" />
        <span className="font-medium text-amber-12">Sandbox mode active.</span>
        <span>No real money moves. Payouts and disbursements are simulated via PayPal Sandbox.</span>
      </div>
      <span className="text-[11px] text-amber-10 font-mono">env: sandbox-us-west</span>
    </div>
  );
}

