"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { SandboxBanner } from "@/components/ui/env-pill";
import { HandsOnTourHUD } from "@/components/onboarding/hands-on-tour-hud";
import { ShortcutsModal } from "./shortcuts-modal";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import { useDelTixStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { environment } = useDelTixStore();
  const { shortcutsOpen, setShortcutsOpen } = useGlobalShortcuts();

  // If on public Landing Page (/), render clean full-page view without console shell
  if (pathname === "/") {
    return (
      <main className="w-screen h-screen overflow-y-auto bg-app">
        {children}
        <HandsOnTourHUD />
      </main>
    );
  }

  // Inside the Operations Console (/runs, /approvals, etc.)
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app">
      {/* 232px Console Sidebar */}
      <Sidebar />

      {/* Main Console Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <TopBar onOpenShortcuts={() => setShortcutsOpen(true)} />

        {/* Mandatory Sandbox Banner if in Sandbox Mode */}
        <SandboxBanner mode={environment} />

        {/* Scrollable Console Page Content */}
        <main className="flex-1 overflow-y-auto bg-app">
          {children}
        </main>

        {/* Global Hands-on Game Tour HUD */}
        <HandsOnTourHUD />

        {/* Global Keyboard Shortcuts Cheatsheet Modal */}
        <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </div>
    </div>
  );
}

