"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { HandsOnTourHUD } from "@/components/onboarding/hands-on-tour-hud";
import { ShortcutsModal } from "./shortcuts-modal";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import { useDelTixStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { environment, init, session, authChecked } = useDelTixStore();
  const { shortcutsOpen, setShortcutsOpen } = useGlobalShortcuts();

  const isPublicRoute = pathname === "/" || pathname.startsWith("/login");

  useEffect(() => {
    if (!isPublicRoute) {
      init();
    }
  }, [init, isPublicRoute]);

  useEffect(() => {
    if (!isPublicRoute && authChecked && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPublicRoute, authChecked, session, pathname, router]);

  // Render clean full-page view without console shell on public landing and login pages
  if (isPublicRoute) {
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

