"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#111113] text-[#edeef0] flex items-center justify-center min-h-screen p-6 font-sans">
        <div className="max-w-md w-full bg-[#18191b] border border-[#2e3135] rounded-lg p-6 text-center space-y-4 shadow-xl">
          <div className="w-10 h-10 rounded-full bg-[#3b1219] text-[#e5484d] flex items-center justify-center mx-auto font-bold text-lg">
            !
          </div>
          <h2 className="text-xl font-bold">System Error</h2>
          <p className="text-sm text-[#b0b4ba]">
            {error?.message || "An unhandled global exception occurred."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-white text-black font-semibold rounded text-sm hover:bg-neutral-200 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}

