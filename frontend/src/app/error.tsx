"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("DelTix App Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-app select-none">
      <div className="max-w-md w-full bg-panel border border-slate-5 rounded-panel p-6 shadow-floating text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-3 border border-red-6 text-red-11 flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-title-page text-slate-12 font-semibold">
            Something went wrong
          </h2>
          <p className="text-ui text-slate-10 leading-relaxed">
            {error?.message || "An unexpected error occurred in the DelTix console."}
          </p>
          {error?.digest && (
            <p className="font-mono text-ui-xs text-slate-9 mt-1">
              digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            size="default"
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-1.5"
          >
            <Home className="h-4 w-4" />
            <span>Go Home</span>
          </Button>

          <Button
            variant="primary"
            size="default"
            onClick={() => reset()}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Try Again</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

