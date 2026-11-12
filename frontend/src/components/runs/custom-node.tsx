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
  Play,
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
  const { title, type, status, nodeId } = (data || {}) as NodeData;

  const isStartNode =
    nodeId?.toLowerCase().includes("start") ||
    title?.toLowerCase().includes("start");

  // 1. Icon & accent color by type (n8n style)
  const { TypeIcon, iconColor } = (() => {
    if (isStartNode) return { TypeIcon: Play, iconColor: "text-[#E8602E]" };
    switch (type) {
      case "DETERMINISTIC_MATH":
        return { TypeIcon: Calculator, iconColor: "text-emerald-400" };
      case "GROUNDING_VERIFIER":
        return { TypeIcon: ShieldCheck, iconColor: "text-emerald-400" };
      case "TOOL_CALL":
        return { TypeIcon: Zap, iconColor: "text-[#E8602E]" };
      case "APPROVAL":
        return { TypeIcon: UserCheck, iconColor: "text-amber-400" };
      case "POLICY_GATE":
        return { TypeIcon: Scale, iconColor: "text-amber-400" };
      default:
        return { TypeIcon: GitBranch, iconColor: "text-[#A1A1AA]" };
    }
  })();

  // 2. Bottom-right status badge
  const StatusBadge = (() => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-[#141417]" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-[#E8602E] animate-spin" />;
      case "waiting":
        return <PauseCircle className="h-4 w-4 text-amber-400 fill-[#141417]" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-400 fill-[#141417]" />;
      default:
        return <CircleDashed className="h-3.5 w-3.5 text-[#52525B]" />;
    }
  })();

  return (
    <div className="flex flex-col items-center w-[140px] select-none group">
      {/* n8n Square / Trigger-Pill Node Tile */}
      <div
        className={cn(
          "relative w-[86px] h-[86px] bg-[#1C1C20] border-[1.5px] flex items-center justify-center transition-all shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
          isStartNode ? "rounded-l-[38px] rounded-r-2xl" : "rounded-2xl",
          status === "pending" && "border-dashed border-[#3F3F46]",
          status === "succeeded" && "border-emerald-500/70",
          status === "running" && "border-[#E8602E] shadow-[0_0_22px_rgba(232,96,46,0.28)]",
          status === "waiting" && "border-amber-500/80 shadow-[0_0_22px_rgba(245,158,11,0.22)]",
          status === "failed" && "border-red-500/80 shadow-[0_0_22px_rgba(239,68,68,0.25)]",
          selected && "ring-4 ring-white/15 border-white/60"
        )}
      >
        {!isStartNode && (
          <Handle
            type="target"
            position={Position.Left}
            className="!w-2.5 !h-2.5 !bg-[#71717A] !border-2 !border-[#1C1C20] !-left-[6px]"
          />
        )}

        <TypeIcon className={cn("h-8 w-8 stroke-[1.75]", iconColor)} />

        {/* Status badge in bottom-right corner of tile */}
        <div className="absolute bottom-1.5 right-1.5 rounded-full bg-[#141417]">
          {StatusBadge}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-[#71717A] !border-2 !border-[#1C1C20] !-right-[6px]"
        />
      </div>

      {/* Node Title & Subtitle below tile (exact n8n style) */}
      <div className="mt-2.5 text-center w-full px-1">
        <div className="text-[12.5px] font-medium text-[#F4F4F5] leading-tight line-clamp-2">
          {title}
        </div>
        <div className="mt-0.5 text-[10.5px] font-mono text-[#71717A] truncate">
          {type ? type.toLowerCase() : "node"}
        </div>
      </div>
    </div>
  );
}
