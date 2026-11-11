"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDelTixStore } from "@/lib/store";
import { RunDetailView } from "@/components/runs/run-detail-view";
import { Button } from "@/components/ui/button";

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { runs, fetchRunDetails, startRunSimulation } = useDelTixStore();
  const [loading, setLoading] = useState(true);

  const runId = params.id as string;
  const run = runs.find((r) => r.id === runId);

  useEffect(() => {
    let isMounted = true;
    if (!run && runId) {
      setLoading(true);
      fetchRunDetails(runId).finally(() => {
        if (isMounted) setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [runId, run, fetchRunDetails]);

  useEffect(() => {
    if (run && (run.status === "RUNNING" || run.status === "PAUSED_FOR_APPROVAL")) {
      startRunSimulation(run.id);
    }
  }, [run?.id, run?.status, startRunSimulation]);

  if (loading) {
    return (
      <div className="flex-1 p-16 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-blue-9 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-ui text-slate-10 font-medium">Loading execution run {runId}...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex-1 p-12 text-center space-y-4">
        <h2 className="text-title-section text-slate-12">Run Not Found</h2>
        <p className="text-ui text-slate-10">
          No execution run matching identifier <code className="font-mono text-ui-xs">{runId}</code> was located in the runtime database.
        </p>
        <Button variant="secondary" onClick={() => router.push("/runs")}>
          Return to Runs List
        </Button>
      </div>
    );
  }

  return <RunDetailView run={run} />;
}
