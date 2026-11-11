"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sun, Moon, ChevronRight, User, HelpCircle, Gamepad2, Keyboard } from "lucide-react";
import { EnvPill } from "@/components/ui/env-pill";
import { useDelTixStore } from "@/lib/store";
import { useTourStore } from "@/lib/tour-store";
import { CommandPalette } from "./command-palette";
import { api } from "@/lib/api";

interface TopBarProps {
  onOpenShortcuts?: () => void;
}

export function TopBar({ onOpenShortcuts }: TopBarProps = {}) {
  const pathname = usePathname();
  const { environment, setEnvironment, runs } = useDelTixStore();
  const { startTour } = useTourStore();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    api.getCurrentSession()
      .then((sess) => {
        if (sess?.user) {
          setUser(sess.user);
        } else if (sess?.email) {
          setUser({ name: sess.name, email: sess.email });
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isLight) {
      root.classList.remove("light");
      setIsLight(false);
    } else {
      root.classList.add("light");
      setIsLight(true);
    }
  };

  // Generate breadcrumbs from route
  const pathSegments = pathname.split("/").filter(Boolean);
  let breadcrumbTitle = "Runs";
  if (pathSegments[0] === "approvals") breadcrumbTitle = "Approvals";
  if (pathSegments[0] === "agents") breadcrumbTitle = "Agents & Studio";
  if (pathSegments[0] === "policies") breadcrumbTitle = "Policies & Caps";
  if (pathSegments[0] === "ledger") breadcrumbTitle = "Settlement Ledger";
  if (pathSegments[0] === "audit") breadcrumbTitle = "Audit Trail";

  const runId = pathSegments[1];
  const activeRun = runId ? runs.find((r) => r.id === runId) : null;

  return (
    <>
      <header className="h-12 border-b border-slate-5 bg-panel flex items-center justify-between px-4 select-none shrink-0">
        {/* Breadcrumb Left */}
        <div className="flex items-center gap-1.5 text-ui">
          <Link href="/runs" className="text-slate-10 hover:text-slate-12 transition-colors">
            DelTix
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-8" />
          <span className="text-slate-11">{breadcrumbTitle}</span>

          {activeRun && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-8" />
              <span className="text-slate-12 font-medium truncate max-w-[240px]">
                {activeRun.title}
              </span>
            </>
          )}
        </div>

        {/* Controls Right */}
        <div className="flex items-center gap-3">
          {/* Interactive Game Tour Guide Button */}
          <button
            type="button"
            onClick={startTour}
            className="h-7 px-2.5 rounded-btn bg-slate-3 border border-slate-5 text-slate-10 hover:text-blue-11 hover:border-slate-7 flex items-center gap-1.5 transition-colors text-ui-sm"
            title="Start Interactive Tour Guide"
          >
            <Gamepad2 className="h-3.5 w-3.5 text-blue-9" />
            <span className="hidden md:inline">Tour Guide</span>
          </button>

          {/* Quick Search / Cmd+K Button */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="h-7 px-2.5 rounded-btn bg-slate-3 border border-slate-5 text-slate-10 hover:text-slate-12 hover:border-slate-7 flex items-center gap-2 transition-colors text-ui-sm"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden sm:inline-block px-1 rounded bg-slate-4 text-[10px] font-mono text-slate-11">
              ⌘K
            </kbd>
          </button>

          {/* Keyboard Shortcuts Cheatsheet Button */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="h-7 px-2 rounded-btn bg-slate-3 border border-slate-5 text-slate-10 hover:text-slate-12 hover:border-slate-7 flex items-center gap-1 transition-colors text-ui-sm"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <kbd className="hidden sm:inline-block px-1 rounded bg-slate-4 text-[10px] font-mono text-slate-11">
                ?
              </kbd>
            </button>
          )}

          {/* Environment Selector */}
          <EnvPill mode={environment} onChange={setEnvironment} />

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="h-7 w-7 rounded-btn border border-slate-5 text-slate-10 hover:text-slate-12 flex items-center justify-center transition-colors"
            title="Toggle color theme"
          >
            {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>

          {/* User Profile Avatar / Sign In */}
          <div className="flex items-center gap-2 pl-1 border-l border-slate-5">
            {user ? (
              <div
                className="w-6 h-6 rounded-full bg-blue-3 border border-blue-6 flex items-center justify-center text-blue-11 font-medium text-[11px] font-mono cursor-pointer"
                title={`Signed in as ${user.name || user.email}`}
              >
                {user.name
                  ? user.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()
                  : "OP"}
              </div>
            ) : (
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/v1/auth/google/login`}
                className="h-7 px-2 rounded-btn bg-slate-3 border border-slate-5 text-slate-11 hover:text-slate-12 text-ui-xs flex items-center gap-1 font-medium"
                title="Sign in with Google OAuth"
              >
                <User className="h-3 w-3" />
                <span>Sign In</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  );
}

