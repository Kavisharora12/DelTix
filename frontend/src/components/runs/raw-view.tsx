"use client";

import React, { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RawViewProps {
  run: any;
}

export function RawView({ run }: RawViewProps) {
  const [copied, setCopied] = useState(false);
  const formattedJson = JSON.stringify(run, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([formattedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${run.id}_full_state.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-app">
      <div className="p-3 bg-panel border-b border-slate-5 flex items-center justify-between select-none">
        <div className="text-ui-xs text-slate-10 font-mono">
          Full execution snapshot payload ({formattedJson.length} bytes)
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy} className="flex items-center gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-green-11" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy JSON"}</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownload} className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-slate-2 font-mono text-ui-xs text-slate-11">
        <pre>
          <code>{formattedJson}</code>
        </pre>
      </div>
    </div>
  );
}

