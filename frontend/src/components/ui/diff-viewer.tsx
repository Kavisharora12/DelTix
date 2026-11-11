import React from "react";
import { cn } from "@/lib/utils";

export interface DiffViewerProps {
  previous: Record<string, any> | null;
  current: Record<string, any>;
  className?: string;
}

export function DiffViewer({ previous, current, className }: DiffViewerProps) {
  const prevLines = previous ? JSON.stringify(previous, null, 2).split("\n") : [];
  const currLines = JSON.stringify(current, null, 2).split("\n");

  // Compute simple line-based diff
  const allKeys = Array.from(
    new Set([...(previous ? Object.keys(previous) : []), ...Object.keys(current)])
  );

  return (
    <div className={cn("font-mono text-[12px] bg-slate-2 border border-slate-5 rounded-btn overflow-hidden", className)}>
      <div className="px-3 py-1.5 border-b border-slate-5 bg-slate-3/60 text-slate-10 text-ui-xs select-none flex justify-between">
        <span>State Diff Inspection</span>
        <span className="flex items-center gap-3">
          <span className="text-green-11 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-9" />
            Added / Updated
          </span>
          <span className="text-red-11 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-9" />
            Removed
          </span>
        </span>
      </div>

      <div className="divide-y divide-slate-5 max-h-[360px] overflow-auto">
        {allKeys.map((key) => {
          const prevVal = previous ? previous[key] : undefined;
          const currVal = current[key];
          const isAdded = prevVal === undefined && currVal !== undefined;
          const isRemoved = prevVal !== undefined && currVal === undefined;
          const isChanged = prevVal !== undefined && currVal !== undefined && JSON.stringify(prevVal) !== JSON.stringify(currVal);
          const isUnchanged = !isAdded && !isRemoved && !isChanged;

          if (isUnchanged) {
            return (
              <div key={key} className="px-3 py-1 text-slate-10 hover:bg-slate-3 flex">
                <span className="w-6 shrink-0 text-slate-8 select-none"> </span>
                <span className="w-1/3 truncate text-slate-11 font-medium">{key}:</span>
                <span className="w-2/3 truncate text-slate-9">{JSON.stringify(currVal)}</span>
              </div>
            );
          }

          return (
            <div key={key} className="flex flex-col">
              {prevVal !== undefined && (isChanged || isRemoved) && (
                <div className="px-3 py-1 bg-red-3/40 text-red-11 hover:bg-red-3/60 flex">
                  <span className="w-6 shrink-0 text-red-9 select-none">-</span>
                  <span className="w-1/3 truncate font-medium">{key}:</span>
                  <span className="w-2/3 truncate text-red-11">{JSON.stringify(prevVal)}</span>
                </div>
              )}
              {currVal !== undefined && (isChanged || isAdded) && (
                <div className="px-3 py-1 bg-green-3/40 text-green-11 hover:bg-green-3/60 flex">
                  <span className="w-6 shrink-0 text-green-9 select-none">+</span>
                  <span className="w-1/3 truncate font-medium">{key}:</span>
                  <span className="w-2/3 truncate text-green-11">{JSON.stringify(currVal)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

