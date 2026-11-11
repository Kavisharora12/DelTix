"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RunsTable } from "@/components/runs/runs-table";
import { useDelTixStore } from "@/lib/store";
import { useTourStore } from "@/lib/tour-store";

function RunsContent() {
  const { runs } = useDelTixStore();
  const searchParams = useSearchParams();
  const { startTour } = useTourStore();

  useEffect(() => {
    if (searchParams.get("tour") === "true") {
      startTour();
    }
  }, [searchParams, startTour]);

  return (
    <div className="h-full flex flex-col min-h-0 bg-app">
      <RunsTable runs={runs} />
    </div>
  );
}

export default function RunsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-10 text-ui">Loading runs console...</div>}>
      <RunsContent />
    </Suspense>
  );
}
