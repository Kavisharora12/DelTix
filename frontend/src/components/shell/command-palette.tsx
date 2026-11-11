"use client";

import React, { useEffect } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Play,
  CheckCircle2,
  Bot,
  ShieldCheck,
  BookOpen,
  FileText,
  Search,
  ArrowRight,
} from "lucide-react";
import { useDelTixStore } from "@/lib/store";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { runs, agents, setSelectedRunId } = useDelTixStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4 select-none animate-in fade-in-0 duration-fast"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl bg-slate-2 border border-slate-5 rounded-panel shadow-floating overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global Command Palette">
          <div className="flex items-center px-3 border-b border-slate-5 bg-slate-3/40">
            <Search className="h-4 w-4 text-slate-10 shrink-0 mr-2" />
            <Command.Input
              autoFocus
              placeholder="Search runs, agents, policies, or type a command... (Cmd+K)"
              className="w-full h-11 bg-transparent text-ui text-slate-12 placeholder:text-slate-10 focus:outline-none"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-1.5 divide-y divide-slate-5/50 text-ui">
            <Command.Empty className="py-6 text-center text-ui-sm text-slate-10">
              No matching runs, agents, or commands found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="p-1 text-ui-xs text-slate-10 font-medium">
              <Command.Item
                onSelect={() => {
                  router.push("/runs");
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-slate-12 hover:bg-slate-4 cursor-pointer"
              >
                <Play className="h-4 w-4 text-slate-10" />
                <span className="flex-1">Go to Runs</span>
                <span className="font-mono text-ui-xs text-slate-9">G R</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push("/approvals");
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-slate-12 hover:bg-slate-4 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4 text-amber-11" />
                <span className="flex-1">Go to Approvals Queue</span>
                <span className="font-mono text-ui-xs text-slate-9">G A</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push("/agents");
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-slate-12 hover:bg-slate-4 cursor-pointer"
              >
                <Bot className="h-4 w-4 text-slate-10" />
                <span className="flex-1">Go to Agent Studio</span>
                <span className="font-mono text-ui-xs text-slate-9">G S</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push("/policies");
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-slate-12 hover:bg-slate-4 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-slate-10" />
                <span className="flex-1">Go to Policies & Caps</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push("/ledger");
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-slate-12 hover:bg-slate-4 cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-slate-10" />
                <span className="flex-1">Go to Settlement Ledger</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  router.push("/audit");
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-slate-12 hover:bg-slate-4 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-slate-10" />
                <span className="flex-1">Go to Audit Trail</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Recent Runs" className="p-1 text-ui-xs text-slate-10 font-medium">
              {runs.slice(0, 5).map((run) => (
                <Command.Item
                  key={run.id}
                  onSelect={() => {
                    setSelectedRunId(run.id);
                    router.push(`/runs/${run.id}`);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-btn text-slate-12 hover:bg-slate-4 cursor-pointer"
                >
                  <ArrowRight className="h-3.5 w-3.5 text-slate-10" />
                  <span className="flex-1 truncate">{run.title}</span>
                  <span className="font-mono text-ui-xs text-slate-10">{run.id.slice(0, 12)}…</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-5 bg-slate-3/30 text-ui-xs text-slate-10 select-none">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-4 border border-slate-6 text-slate-12 text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-4 border border-slate-6 text-slate-12 text-[10px] font-mono">↓</kbd>
              <span>navigate</span>
              <kbd className="ml-2 px-1.5 py-0.5 rounded bg-slate-4 border border-slate-6 text-slate-12 text-[10px] font-mono">↵</kbd>
              <span>select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-4 border border-slate-6 text-slate-12 text-[10px] font-mono">esc</kbd>
              <span>close</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}

