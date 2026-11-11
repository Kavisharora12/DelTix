"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useDelTixStore } from "@/lib/store";
import { RunDetailView } from "@/components/runs/run-detail-view";
import { Button } from "@/components/ui/button";

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { runs } = useDelTixStore();

  const runId = params.id as string;
  const run = runs.find((r) => r.id === runId);

  if (!run) {
    return (
      <div className="flex-1 p-12 text-center space-y-4">
        <h2 className="text-title-section text-slate-12">Run Not Found</h2>
        <p className="text-ui text-slate-10">
          No execution run matching identifier <code className="font-mono text-ui-xs">{runId}</code> was located.
        </p>
        <Button variant="secondary" onClick={() => router.push("/runs")}>
          Return to Runs List
        </Button>
      </div>
    );
  }

  return <RunDetailView run={run} />;
}

