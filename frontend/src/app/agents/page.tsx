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
      <div className="border-b border-slate-5 bg-panel p-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-title-page text-slate-12">Agent Registry</h1>
          <p className="text-ui text-slate-10 mt-0.5">
            Compiled, HMAC-sealed deterministic financial agents saved under your workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/studio/new">
            <Button variant="primary" size="sm" className="font-semibold shadow-sm gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              + Compile New Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Layout: Left Agents List (35%) + Right Spec Inspector (65%) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Agents List */}
        <div className="w-[360px] border-r border-slate-5 bg-panel flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-slate-5 text-ui-xs font-semibold uppercase tracking-wider text-slate-10">
            Registered Agents ({agents.length})
          </div>

          {agents.length === 0 ? (
            <div className="p-6 text-center text-slate-10 text-ui-xs space-y-3">
              <div>No compiled agents in this workspace yet.</div>
              <Link href="/studio/new" className="inline-block text-blue-11 hover:underline font-medium">
                Compile your first agent in Compiler Studio &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-5">
              {agents.map((agent) => {
                const isSelected = agent.id === selectedAgent?.id;

                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "p-3.5 cursor-pointer transition-colors text-ui",
                      isSelected ? "bg-slate-4" : "hover:bg-slate-3"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-12">{agent.name}</span>
                      <span className="font-mono text-ui-xs px-1.5 py-0.5 rounded bg-slate-3 border border-slate-5 text-slate-11">
                        {agent.version}
                      </span>
                    </div>

                    <p className="text-ui-xs text-slate-10 mt-1 line-clamp-2">
                      {agent.description}
                    </p>

                    <div className="flex items-center justify-between text-ui-xs text-slate-10 mt-2.5 pt-2 border-t border-slate-5/50 font-mono">
                      <span className="text-green-11 font-medium">
                        {agent.successRate}% success
                      </span>
                      <span>{agent.totalRuns} runs</span>
                      <span className="truncate max-w-[120px]">{agent.owner}</span>
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

