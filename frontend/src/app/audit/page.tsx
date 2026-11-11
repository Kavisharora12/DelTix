"use client";

import React, { useState } from "react";
import { Check, Copy, Shield, ShieldCheck, Download } from "lucide-react";
import { MOCK_AUDIT_LOGS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export default function AuditPage() {
  const [logs] = useState(MOCK_AUDIT_LOGS);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Header */}
      <div className="border-b border-slate-5 bg-panel p-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-title-page text-slate-12">Cryptographic Audit Trail</h1>
          <p className="text-ui text-slate-10 mt-0.5">
            Append-only, SHA-256 chained transaction logs and HMAC token generation proofs.
          </p>
        </div>

        <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" />
          <span>Export Audit Log</span>
        </Button>
      </div>

      {/* Audit Table */}
      <div className="flex-1 overflow-auto bg-app">
        <table className="w-full border-collapse text-left text-ui">
          <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
            <tr>
              <th className="py-2 px-3 w-28">Log ID</th>
              <th className="py-2 px-3 w-48">Actor</th>
              <th className="py-2 px-3 w-44">Action</th>
              <th className="py-2 px-3">Target & ID</th>
              <th className="py-2 px-3 w-44">SHA-256 Hash</th>
              <th className="py-2 px-3 w-28 text-center">Status</th>
              <th className="py-2 px-3 text-right w-44">Timestamp (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-5">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-3 transition-colors h-10">
                <td className="py-2 px-3 font-mono text-ui-xs text-slate-10">
                  {log.id}
                </td>
                <td className="py-2 px-3 font-mono text-ui-xs text-slate-12">
                  {log.actor}
                </td>
                <td className="py-2 px-3">
                  <span className="font-mono text-ui-xs px-1.5 py-0.5 rounded bg-slate-3 border border-slate-5 text-slate-11">
                    {log.action}
                  </span>
                </td>
                <td className="py-2 px-3 text-ui-xs text-slate-11 truncate max-w-[280px]">
                  <span>{log.target}</span>
                  <span className="font-mono text-slate-9 ml-1">({log.targetId})</span>
                </td>
                <td className="py-2 px-3 font-mono text-ui-xs text-slate-10">
                  <button
                    type="button"
                    onClick={() => handleCopyHash(log.hash)}
                    className="inline-flex items-center gap-1.5 hover:text-slate-12 px-1 py-0.5 rounded hover:bg-slate-4 transition-colors"
                    title="Click to copy SHA-256 hash"
                  >
                    <span>{log.hash.slice(0, 10)}…{log.hash.slice(-6)}</span>
                    {copiedHash === log.hash ? (
                      <Check className="h-3 w-3 text-green-11" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-9" />
                    )}
                  </button>
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${
                      log.status === "success"
                        ? "bg-green-3 border-green-6 text-green-11"
                        : "bg-red-3 border-red-6 text-red-11"
                    }`}
                  >
                    {log.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-ui-xs text-slate-10">
                  {new Date(log.timestamp).toISOString().replace("T", " ").substring(0, 19)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

