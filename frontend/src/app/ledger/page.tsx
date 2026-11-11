"use client";

import React, { useState } from "react";
import { Download, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { MOCK_LEDGER_ENTRIES } from "@/lib/mock-data";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";

export default function LedgerPage() {
  const [entries] = useState(MOCK_LEDGER_ENTRIES);

  const handleExportCSV = () => {
    const headers = "Reference,Counterparty,Amount_USD,Currency,Disbursement_Method,Idempotency_Key,Status,Timestamp\n";
    const rows = entries
      .map(
        (e) =>
          `"${e.referenceId}","${e.counterparty}",${(e.amountCents / 100).toFixed(2)},"${e.currency}","${e.disbursementMethod}","${e.idempotencyKey}","${e.reconciliationStatus}","${e.timestamp}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `deltix-reconciliation-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Header */}
      <div className="border-b border-slate-5 bg-panel p-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-title-page text-slate-12">Settlement Ledger & Reconciliation</h1>
          <p className="text-ui text-slate-10 mt-0.5">
            Idempotent ledger recording all initiated payouts, upstream transaction hashes, and bank reconciliations.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 hover:border-slate-7 text-slate-12"
          title="Export CSV reconciliation ledger"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Reconciliation CSV</span>
        </Button>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 overflow-auto bg-app">
        <table className="w-full border-collapse text-left text-ui">
          <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
            <tr>
              <th className="py-2 px-3 w-32">Reference</th>
              <th className="py-2 px-3">Counterparty</th>
              <th className="py-2 px-3 text-right">Disbursed Amount</th>
              <th className="py-2 px-3">Payment Method</th>
              <th className="py-2 px-3">Idempotency Key</th>
              <th className="py-2 px-3 w-32">Status</th>
              <th className="py-2 px-3 text-right w-44">Settled At (UTC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-5">
            {entries.map((item) => (
              <tr key={item.id} className="hover:bg-slate-3 transition-colors h-10">
                <td className="py-2 px-3 font-mono text-ui-xs text-slate-12 font-medium">
                  {item.referenceId}
                </td>
                <td className="py-2 px-3 text-slate-11 font-medium">
                  {item.counterparty}
                </td>
                <td className="py-2 px-3 text-right">
                  <Money cents={item.amountCents} currency={item.currency} align="right" />
                </td>
                <td className="py-2 px-3 text-slate-11 text-ui-xs">
                  {item.disbursementMethod}
                </td>
                <td className="py-2 px-3 font-mono text-ui-xs text-slate-10 truncate max-w-[200px]">
                  {item.idempotencyKey}
                </td>
                <td className="py-2 px-3">
                  {item.reconciliationStatus === "reconciled" ? (
                    <span className="inline-flex items-center gap-1 text-green-11 text-ui-xs font-medium">
                      <CheckCircle2 className="h-3 w-3 text-green-9" />
                      Reconciled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-11 text-ui-xs font-medium">
                      <Clock className="h-3 w-3 text-amber-9" />
                      Pending Match
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono text-ui-xs text-slate-10">
                  {new Date(item.timestamp).toISOString().replace("T", " ").substring(0, 19)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

