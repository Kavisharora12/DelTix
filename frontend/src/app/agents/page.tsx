"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AgentStudio } from "@/components/studio/agent-studio";
import { Button } from "@/components/ui/button";
import { useDelTixStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const { agents } = useDelTixStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agents[0]?.id || null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Top Header */}
      <div className="border-b border-slate-5 bg-panel px-6 md:px-8 py-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-display text-title-page text-slate-12">Agent Registry</h1>
          <p className="text-ui font-light text-slate-10 mt-1">
            Compiled, HMAC-sealed deterministic financial agents saved under your workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/studio/new">
            <Button variant="primary" size="sm" className="font-medium shadow-sm gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Compile New Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Layout: Left Agents List + Right Spec Inspector */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Agents List */}
        <div className="w-[310px] border-r border-[#232323] bg-[#050505] flex flex-col shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-[#232323] text-[11px] font-mono uppercase tracking-wider text-[#898989]">
            Registered Agents ({agents.length})
          </div>

          {agents.length === 0 ? (
            <div className="p-6 text-center text-[#898989] text-xs space-y-3">
              <div>No compiled agents in this workspace yet.</div>
              <Link href="/studio/new" className="inline-block text-[#E8602E] hover:underline font-medium">
                Compile your first agent in Compiler Studio &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#1A1A1A]">
              {agents.map((agent) => {
                const isSelected = agent.id === selectedAgent?.id;

                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "px-4 py-3.5 cursor-pointer transition-colors relative",
                      isSelected
                        ? "bg-[#0E0E0E] border-l-2 border-l-[#E8602E]"
                        : "hover:bg-[#0A0A0A] border-l-2 border-l-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-medium text-white truncate">
                        {agent.name}
                      </span>
                      <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-[#141414] border border-[#232323] text-[#979797] shrink-0">
                        {agent.version}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11.5px] text-[#898989] mt-2 font-mono">
                      <span className="text-emerald-400 font-medium">
                        {agent.successRate}% success
                      </span>
                      <span>{agent.totalRuns} runs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Compiled Agent Spec Inspector */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {selectedAgent ? (
            <AgentStudio agent={selectedAgent} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-10 text-ui">
              Select a compiled agent from the registry to inspect its sealed IR and launch it in Live Sandbox.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

