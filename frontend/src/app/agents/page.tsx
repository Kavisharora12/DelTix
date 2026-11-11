"use client";

import React, { useState } from "react";
import { Bot, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { AgentItem } from "@/types";
import { AgentStudio } from "@/components/studio/agent-studio";
import { Button } from "@/components/ui/button";
import { useDelTixStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const { agents, createAgent } = useDelTixStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agents[0]?.id || null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const handleCreateAgent = () => {
    const created = createAgent();
    setSelectedAgentId(created.id);
    setBannerMessage(`Created draft agent ${created.name} and loaded template into Studio`);
    setTimeout(() => setBannerMessage(null), 3500);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-app select-none">
      {/* Top Header */}
      <div className="border-b border-slate-5 bg-panel p-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-title-page text-slate-12">Agent Registry & Studio</h1>
          <p className="text-ui text-slate-10 mt-0.5">
            Compiled deterministic financial state graphs with verification gates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bannerMessage && (
            <span className="text-ui-xs text-green-11 bg-green-3 border border-green-6 px-2.5 py-1 rounded-btn animate-in fade-in-0 font-medium">
              {bannerMessage}
            </span>
          )}
          <Button variant="primary" size="sm" onClick={handleCreateAgent} className="font-semibold shadow-sm">
            + New Agent Graph
          </Button>
        </div>
      </div>

      {/* Main Layout: Left Agents Table (35%) + Right Agent Studio (65%) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Agents List (Section 7.4) */}
        <div className="w-[360px] border-r border-slate-5 bg-panel flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-slate-5 text-ui-xs font-semibold uppercase tracking-wider text-slate-10">
            Registered Agents ({agents.length})
          </div>

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
                    <span>{agent.owner}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Studio Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {selectedAgent ? (
            <AgentStudio agent={selectedAgent} />
          ) : (
            <div className="p-8 text-center text-slate-10 text-ui">
              Select an agent from the registry to inspect or modify its execution graph.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

