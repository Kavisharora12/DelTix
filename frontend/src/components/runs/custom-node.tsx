import React from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Calculator,
  ShieldCheck,
  Zap,
  UserCheck,
  Scale,
  Database,
  GitBranch,
  CheckCircle2,
  PauseCircle,
  XCircle,
  CircleDashed,
  Loader2,
} from "lucide-react";
import { NodeType, NodeStatus } from "@/types";
import { cn } from "@/lib/utils";

interface NodeData {
  title: string;
  type: NodeType;
  status: NodeStatus;
  nodeId: string;
}

export function CustomNode(props: any) {
  const { data, selected } = props;
  const { title, type, status } = (data || {}) as NodeData;

  // 1. Icon by type per Section 7.2
  const TypeIcon = (() => {
    switch (type) {
      case "DETERMINISTIC_MATH":
        return Calculator;
      case "GROUNDING_VERIFIER":
        return ShieldCheck;
      case "TOOL_CALL":
        return Zap;
      case "APPROVAL":
        return UserCheck;
      case "POLICY_GATE":
        return Scale;
      case "INGEST_DATA":
        return Database;
      default:
        return GitBranch;
    }
  })();

  // 2. Status icon per Section 7.2
  const StatusIcon = (() => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-11 shrink-0" />;
      case "running":
        return <Loader2 className="h-3.5 w-3.5 text-blue-11 animate-spin shrink-0" />;
      case "waiting":
        return <PauseCircle className="h-3.5 w-3.5 text-amber-11 shrink-0" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-11 shrink-0" />;
      default:
        return <CircleDashed className="h-3.5 w-3.5 text-slate-9 shrink-0" />;
    }
  })();

  return (
    <div
      className={cn(
        "w-[208px] h-[56px] rounded-btn bg-slate-2 px-3 py-2 flex items-center justify-between transition-colors select-none",
        "border border-slate-5",
        status === "pending" && "border-dashed border-slate-6 text-slate-10",
        status === "running" && "border-blue-9",
        status === "waiting" && "border-amber-9",
        status === "failed" && "border-red-9",
        status === "succeeded" && "border-slate-5",
        selected && "ring-2 ring-blue-9 ring-offset-1 ring-offset-app"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-7 !w-2 !h-2 !border-none" />

      {/* Left: 16px lucide icon by type */}
      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mr-2.5 text-slate-11">
        <TypeIcon className="h-4 w-4" />
      </div>

      {/* Middle: title 13px/500, subtitle 11px mono node type */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="text-ui font-medium text-slate-12 truncate leading-tight">
          {title}
        </div>
        <div className="font-mono text-ui-xs text-slate-10 truncate leading-tight mt-0.5">
          {type ? type.toLowerCase() : "node"}
        </div>
      </div>

      {/* Right: 14px status icon */}
      <div className="shrink-0 flex items-center justify-center">
        {StatusIcon}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-7 !w-2 !h-2 !border-none" />
    </div>
  );
}
