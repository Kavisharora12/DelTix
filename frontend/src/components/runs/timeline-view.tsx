"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Clock, ArrowDown } from "lucide-react";
import { RunTimelineEvent } from "@/types";
import { JsonViewer } from "@/components/ui/json-viewer";
import { cn } from "@/lib/utils";

interface TimelineViewProps {
  timeline: RunTimelineEvent[];
}

export function TimelineView({ timeline }: TimelineViewProps) {
  const [compact, setCompact] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-app text-ui select-none">
      {/* Top Filter & Compact Toggle Bar */}
      <div className="p-3 bg-panel border-b border-slate-5 flex items-center justify-between">
        <div className="text-ui-sm text-slate-10">
          Showing {timeline.length} execution events (Chronological order)
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-ui-xs text-slate-11 cursor-pointer">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
              className="rounded bg-slate-3 border-slate-5 text-blue-9 focus:ring-blue-9"
            />
            <span>Compact view</span>
          </label>
        </div>
      </div>

      {/* Temporal-Style Event History Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-ui">
          <thead className="sticky top-0 bg-panel border-b border-slate-5 text-ui-xs text-slate-10 font-medium z-10">
            <tr>
              <th className="py-2 px-3 w-24">Offset</th>
              <th className="py-2 px-3 w-44">Event</th>
              <th className="py-2 px-3 w-48">Node</th>
              <th className="py-2 px-3">Summary</th>
              <th className="py-2 px-3 w-28 text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-5">
            {timeline.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-10">
                  No timeline events recorded yet.
                </td>
              </tr>
            ) : (
              timeline.map((event) => {
                const isExpanded = expandedRow === event.id;

                return (
                  <React.Fragment key={event.id}>
                    <tr
                      onClick={() => toggleRow(event.id)}
                      className={cn(
                        "cursor-pointer hover:bg-slate-3 transition-colors",
                        compact ? "h-7 text-ui-xs" : "h-9",
                        isExpanded && "bg-slate-4"
                      )}
                    >
                      {/* Offset (+0.42s) in monospace */}
                      <td className="py-1.5 px-3 font-mono text-ui-xs text-slate-10 whitespace-nowrap">
                        +{event.offsetSeconds.toFixed(2)}s
                      </td>

                      {/* Event Type */}
                      <td className="py-1.5 px-3 font-medium text-slate-12 whitespace-nowrap flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-slate-10 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-10 shrink-0" />
                        )}
                        <span>{event.eventType}</span>
                      </td>

                      {/* Node Title */}
                      <td className="py-1.5 px-3 text-slate-11 whitespace-nowrap font-mono text-ui-xs truncate">
                        {event.nodeTitle}
                      </td>

                      {/* Summary */}
                      <td className="py-1.5 px-3 text-slate-11 truncate max-w-[340px]">
                        {event.summary}
                      </td>

                      {/* Duration */}
                      <td className="py-1.5 px-3 text-right font-mono text-ui-xs text-slate-10 whitespace-nowrap">
                        {event.durationMs !== undefined ? `${event.durationMs}ms` : "—"}
                      </td>
                    </tr>

                    {/* Expandable Payload Viewer */}
                    {isExpanded && (
                      <tr className="bg-slate-2">
                        <td colSpan={5} className="p-3 border-b border-slate-5">
                          <div className="space-y-2">
                            <div className="text-ui-xs text-slate-10 font-semibold">
                              Event Payload Details
                            </div>
                            <JsonViewer
                              data={
                                event.payload || {
                                  event_id: event.id,
                                  node_id: event.nodeId,
                                  node_title: event.nodeTitle,
                                  summary: event.summary,
                                  timestamp: event.timestamp,
                                }
                              }
                              defaultExpanded={true}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

