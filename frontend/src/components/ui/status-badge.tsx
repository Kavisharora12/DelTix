import React from "react";
import { CheckCircle2, PauseCircle, XCircle, Ban, CircleDashed, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type RunStatusType =
  | "COMPLETED"
  | "RUNNING"
  | "PAUSED_FOR_APPROVAL"
  | "FAILED"
  | "REJECTED"
  | "QUEUED"
  | "CANCELLED";

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  containerClass: string;
  textClass: string;
  iconClass: string;
}

const statusMap: Record<string, StatusConfig> = {
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    containerClass: "bg-green-3 border-green-6",
    textClass: "text-green-11",
    iconClass: "text-green-11",
  },
  succeeded: {
    label: "Completed",
    icon: CheckCircle2,
    containerClass: "bg-green-3 border-green-6",
    textClass: "text-green-11",
    iconClass: "text-green-11",
  },
  RUNNING: {
    label: "Running",
    icon: Loader2,
    containerClass: "bg-blue-3 border-blue-6",
    textClass: "text-blue-11",
    iconClass: "text-blue-11 animate-spin",
  },
  running: {
    label: "Running",
    icon: Loader2,
    containerClass: "bg-blue-3 border-blue-6",
    textClass: "text-blue-11",
    iconClass: "text-blue-11 animate-spin",
  },
  PAUSED_FOR_APPROVAL: {
    label: "Waiting for approval",
    icon: PauseCircle,
    containerClass: "bg-amber-3 border-amber-6",
    textClass: "text-amber-11",
    iconClass: "text-amber-11",
  },
  waiting: {
    label: "Waiting for approval",
    icon: PauseCircle,
    containerClass: "bg-amber-3 border-amber-6",
    textClass: "text-amber-11",
    iconClass: "text-amber-11",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    containerClass: "bg-red-3 border-red-6",
    textClass: "text-red-11",
    iconClass: "text-red-11",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    containerClass: "bg-red-3 border-red-6",
    textClass: "text-red-11",
    iconClass: "text-red-11",
  },
  REJECTED: {
    label: "Rejected",
    icon: Ban,
    containerClass: "bg-red-3 border-red-6",
    textClass: "text-red-11",
    iconClass: "text-red-11",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: Ban,
    containerClass: "bg-slate-3 border-slate-6",
    textClass: "text-slate-11",
    iconClass: "text-slate-11",
  },
  QUEUED: {
    label: "Queued",
    icon: CircleDashed,
    containerClass: "bg-slate-3 border-slate-6",
    textClass: "text-slate-11",
    iconClass: "text-slate-10",
  },
  pending: {
    label: "Pending",
    icon: CircleDashed,
    containerClass: "bg-slate-3 border-slate-6",
    textClass: "text-slate-11",
    iconClass: "text-slate-10",
  },
};

export interface StatusBadgeProps {
  status: string;
  showRawCode?: boolean;
  size?: "default" | "sm";
  className?: string;
}

export function StatusBadge({
  status,
  showRawCode = false,
  size = "default",
  className,
}: StatusBadgeProps) {
  const config = statusMap[status] || {
    label: status,
    icon: CircleDashed,
    containerClass: "bg-slate-3 border-slate-6",
    textClass: "text-slate-11",
    iconClass: "text-slate-10",
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge border select-none font-medium",
        size === "default" && "h-6 px-2 text-ui-sm",
        size === "sm" && "h-5 px-1.5 text-ui-xs",
        config.containerClass,
        className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", config.iconClass)} />
      <span className={cn(config.textClass)}>{config.label}</span>
      {showRawCode && (
        <span className="font-mono text-[10px] text-slate-10 ml-0.5 opacity-80">
          {status}
        </span>
      )}
    </span>
  );
}

