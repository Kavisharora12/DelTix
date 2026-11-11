"use client";

import React from "react";
import { AppShell } from "@/components/shell/app-shell";
import { SandboxClient } from "@/components/sandbox/sandbox-client";

export default function SandboxPage() {
  return (
    <AppShell>
      <SandboxClient />
    </AppShell>
  );
}
