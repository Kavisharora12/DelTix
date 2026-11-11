"use client";

import React from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { SandboxClient } from "@/components/sandbox/sandbox-client";

export default function SandboxSpecPage() {
  const params = useParams();
  const specId = typeof params?.specId === "string" ? params.specId : undefined;

  return (
    <AppShell>
      <SandboxClient initialSpecId={specId} />
    </AppShell>
  );
}
