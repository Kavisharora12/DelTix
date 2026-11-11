"use client";

import React, { useState } from "react";
import { RotateCcw, CheckCircle2, History } from "lucide-react";
import { RunCheckpoint } from "@/types";
import { DiffViewer } from "@/components/ui/diff-viewer";
import { Button } from "@/components/ui/button";

interface CheckpointsViewProps {
  checkpoints: RunCheckpoint[];
  onRetryFromCheckpoint?: (checkpointId: string) => void;
}

export function CheckpointsView({
  checkpoints,
  onRetryFromCheckpoint,
}: CheckpointsViewProps) {
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number>(
    checkpoints.length - 1
  );

  if (checkpoints.length === 0) {
    return (
      <div className="flex-1 p-8 text-center text-slate-10 text-ui">
        No state checkpoints recorded for this execution run.
      </div>
    );
  }

  const currentCheckpoint = checkpoints[selectedCheckpointIndex] || checkpoints[0];
  const previousCheckpoint =
    selectedCheckpointIndex > 0 ? checkpoints[selectedCheckpointIndex - 1] : null;

  return (
    <div className="flex-1 flex min-h-0 h-full overflow-hidden bg-app select-none">
      {/* Checkpoints List (Left, 35%) */}
      <div className="w-[320px] border-r border-slate-5 bg-panel flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-5 text-ui-xs text-slate-10 font-semibold uppercase tracking-wider">
          Checkpoints ({checkpoints.length})
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-5">
          {checkpoints.map((cp, idx) => {
            const isSelected = idx === selectedCheckpointIndex;

            return (
              <button
                key={cp.id}
                type="button"
                onClick={() => setSelectedCheckpointIndex(idx)}
                className={`w-full text-left p-3 transition-colors ${
                  isSelected ? "bg-slate-4" : "hover:bg-slate-3"
                }`}
              >
                <div className="flex items-center justify-between text-ui-sm">
                  <span className="font-mono text-slate-12 font-medium">Step {cp.stepIndex}</span>
                  <span className="text-ui-xs text-slate-10 font-mono">
                    {new Date(cp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="text-ui-xs text-slate-11 mt-1 truncate">
                  node: {cp.nodeId}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Checkpoint Detail & State Diff (Right, 65%) */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-5">
          <div>
            <div className="text-title-section text-slate-12">
              Checkpoint at Step {currentCheckpoint.stepIndex} ({currentCheckpoint.nodeId})
            </div>
            <div className="font-mono text-ui-xs text-slate-10 mt-0.5">
              id: {currentCheckpoint.id}
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRetryFromCheckpoint?.(currentCheckpoint.id)}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry from here</span>
          </Button>
        </div>

        {/* State Diff Viewer */}
        <div className="space-y-2">
          <div className="text-ui-xs text-slate-10 font-semibold uppercase tracking-wider">
            State Delta Diff (vs Step {previousCheckpoint ? previousCheckpoint.stepIndex : "Initial"})
          </div>
          <DiffViewer
            previous={previousCheckpoint ? previousCheckpoint.fullState : null}
            current={currentCheckpoint.fullState}
          />
        </div>
      </div>
    </div>
  );
}

