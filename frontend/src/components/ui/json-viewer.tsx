"use client";

import React, { useState } from "react";
import { Check, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JsonViewerProps {
  data: any;
  defaultExpanded?: boolean;
  className?: string;
  maxHeight?: string;
}

export function JsonViewer({
  data,
  defaultExpanded = true,
  className,
  maxHeight = "400px",
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(!defaultExpanded);

  const formattedJson = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("relative font-mono text-ui-xs bg-slate-2 border border-slate-5 rounded-btn", className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-5 bg-slate-3/50 text-slate-10 select-none">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 hover:text-slate-12 text-ui-xs"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>JSON Payload ({typeof data === "object" && data !== null ? Object.keys(data).length : 1} keys)</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-12 text-ui-xs transition-colors"
          title="Copy JSON"
        >
          {copied ? <Check className="h-3 w-3 text-green-11" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {!collapsed && (
        <pre
          className="p-3 overflow-auto text-slate-11 leading-relaxed selection:bg-blue-3 selection:text-blue-11"
          style={{ maxHeight }}
        >
          <code>{formattedJson}</code>
        </pre>
      )}
    </div>
  );
}

