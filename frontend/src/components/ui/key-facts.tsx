import React from "react";
import { cn } from "@/lib/utils";

export interface KeyFactItem {
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
}

export interface KeyFactsProps {
  items: KeyFactItem[];
  className?: string;
}

/**
 * KeyFacts strip per DelTix Design Spec (Section 7.2):
 * Single row, items separated by hairline borders.
 * Plain text, 12px label above 14px value. Not a rounded stat-card grid.
 */
export function KeyFacts({ items, className }: KeyFactsProps) {
  return (
    <div
      className={cn(
        "w-full bg-slate-2 border border-slate-5 rounded-btn flex items-center divide-x divide-slate-5 overflow-x-auto",
        className
      )}
    >
      {items.map((item, idx) => (
        <div key={idx} className="flex-1 min-w-[140px] px-4 py-2.5">
          <div className="text-ui-sm text-slate-10 font-normal select-none">
            {item.label}
          </div>
          <div className="text-[14px] font-medium text-slate-12 mt-0.5 flex items-baseline gap-1.5 truncate">
            {item.value}
            {item.secondary && (
              <span className="text-ui-xs text-slate-10 font-normal">
                {item.secondary}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

