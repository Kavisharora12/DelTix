"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Keyboard, Command, ArrowRight } from "lucide-react";

interface ShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const sections = [
    {
      title: "Global Navigation",
      shortcuts: [
        { keys: ["G", "R"], desc: "Go to Runs table" },
        { keys: ["G", "A"], desc: "Go to Approvals queue" },
        { keys: ["G", "S"], desc: "Go to Agent Studio" },
        { keys: ["G", "P"], desc: "Go to Spend Policies" },
        { keys: ["G", "L"], desc: "Go to Settlement Ledger" },
        { keys: ["G", "U"], desc: "Go to Cryptographic Audit" },
        { keys: ["⌘", "K"], desc: "Open Command Palette" },
        { keys: ["?"], desc: "Show this shortcuts cheat-sheet" },
      ],
    },
    {
      title: "Runs Table (List View)",
      shortcuts: [
        { keys: ["J"], desc: "Navigate down one row" },
        { keys: ["K"], desc: "Navigate up one row" },
        { keys: ["Space"], desc: "Quick-peek drawer for selected run" },
        { keys: ["Enter"], desc: "Open full run details & DAG" },
        { keys: ["Esc"], desc: "Close drawer or clear selection" },
      ],
    },
    {
      title: "Approvals Inbox",
      shortcuts: [
        { keys: ["A"], desc: "Initiate dual-key approval sign flow" },
        { keys: ["R"], desc: "Reject execution with required reason" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 select-none animate-in fade-in-0 duration-fast"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl bg-slate-2 border border-slate-5 rounded-panel shadow-floating overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-5 bg-slate-3/40">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-slate-11" />
            <span className="text-ui font-semibold text-slate-12">Keyboard Shortcuts</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-btn hover:bg-slate-4 text-slate-10 hover:text-slate-12 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[75vh] overflow-y-auto">
          {sections.map((sec) => (
            <div key={sec.title}>
              <h4 className="text-ui-xs font-semibold text-slate-10 uppercase tracking-wider mb-2">
                {sec.title}
              </h4>
              <div className="space-y-1.5">
                {sec.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 px-2 rounded-btn bg-slate-3/30 border border-slate-5/40 text-ui-sm"
                  >
                    <span className="text-slate-11">{sc.desc}</span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-1.5 py-0.5 min-w-[20px] text-center rounded bg-slate-4 border border-slate-6 font-mono text-[11px] text-slate-12 font-medium"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 bg-slate-3/50 border-t border-slate-5 flex items-center justify-between text-ui-xs text-slate-10">
          <span>Linear-style keyboard-first operations</span>
          <span>Press <kbd className="font-mono text-slate-12">Esc</kbd> to dismiss</span>
        </div>
      </div>
    </div>
  );
}

