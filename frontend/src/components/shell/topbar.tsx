"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Sun, Moon, ChevronRight, ChevronDown, User, Gamepad2, Keyboard, Bell, LogOut } from "lucide-react";
import { EnvPill } from "@/components/ui/env-pill";
import { useDelTixStore } from "@/lib/store";
import { useTourStore } from "@/lib/tour-store";
import { CommandPalette } from "./command-palette";

interface TopBarProps {
  onOpenShortcuts?: () => void;
}

export function TopBar({ onOpenShortcuts }: TopBarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { environment, setEnvironment, runs, session, logout } = useDelTixStore();
  const { startTour } = useTourStore();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pendingApprovalsCount = runs.filter((r) => r.status === "PAUSED_FOR_APPROVAL").length;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

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
  let breadcrumbTitle = "Dashboard";
  if (pathSegments[0] === "dashboard") breadcrumbTitle = "Dashboard";
  if (pathSegments[0] === "studio") breadcrumbTitle = "Compiler Studio";
  if (pathSegments[0] === "sandbox") breadcrumbTitle = "Live Sandbox";
  if (pathSegments[0] === "runs") breadcrumbTitle = "Runs";
  if (pathSegments[0] === "approvals") breadcrumbTitle = "Approvals";
  if (pathSegments[0] === "agents") breadcrumbTitle = "Agent Registry";
  if (pathSegments[0] === "policies") breadcrumbTitle = "Policies & Caps";
  if (pathSegments[0] === "ledger") breadcrumbTitle = "Settlement Ledger";
  if (pathSegments[0] === "audit") breadcrumbTitle = "Audit Trail";

  const runId = pathSegments[1];
  const activeRun = runId ? runs.find((r) => r.id === runId) : null;

  return (
    <>
      <header className="h-14 border-b border-[#232323] bg-[#050505] flex items-center justify-between px-6 select-none shrink-0 font-sans">
        {/* Breadcrumb Left */}
        <div className="flex items-center gap-1.5 text-[13.5px]">
          <Link href="/dashboard" className="text-[#898989] hover:text-white transition-colors">
            DelTix
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-[#4E4A48]" />
          <span className="text-white font-medium">{breadcrumbTitle}</span>

          {activeRun && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-[#4E4A48]" />
              <span className="text-white font-medium truncate max-w-[240px]">
                {activeRun.title}
              </span>
            </>
          )}
        </div>

        {/* Controls Right */}
        <div className="flex items-center gap-3">
          {/* Pending Approvals Bell Alert */}
          {pendingApprovalsCount > 0 && (
            <Link
              href="/approvals"
              className="h-7 px-2.5 rounded-btn bg-amber-3 border border-amber-6 text-amber-11 hover:bg-amber-4 flex items-center gap-1.5 transition-colors text-ui-sm font-medium"
              title={`${pendingApprovalsCount} approval(s) waiting for operator decision`}
            >
              <Bell className="h-3.5 w-3.5 text-amber-11" />
              <span>{pendingApprovalsCount} Approvals</span>
            </Link>
          )}

          {/* Interactive Game Tour Guide Button */}
          <button
            type="button"
            onClick={startTour}
            className="h-7 px-2.5 rounded-btn bg-slate-3 border border-slate-5 text-slate-10 hover:text-[#E8602E] hover:border-[#E8602E]/40 flex items-center gap-1.5 transition-colors text-ui-sm"
            title="Start Interactive Tour Guide"
          >
            <Gamepad2 className="h-3.5 w-3.5 text-[#E8602E]" />
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

          {/* User Profile Menu (Top-Right Corner Section) */}
          <div ref={profileRef} className="relative pl-2 border-l border-[#232323]">
            {session ? (
              <>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="h-8 px-2 rounded-lg bg-[#0C0C0C] border border-[#232323] hover:border-[#4E4A48] flex items-center gap-2 transition-colors cursor-pointer"
                  title={`${session.name || session.email} (${session.tenant_id})`}
                >
                  <div className="w-6 h-6 rounded-full bg-[#E8602E]/15 border border-[#E8602E]/40 flex items-center justify-center text-[#E8602E] font-medium text-[11px] font-mono">
                    {session.name
                      ? session.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()
                      : (session.email?.[0] || "OP").toUpperCase()}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-[#898989] transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-11 w-64 rounded-md border border-white/10 bg-[#141519] shadow-2xl z-50 overflow-hidden">
                    {/* Top Username / Email Header */}
                    <div className="px-5 py-3.5 border-b border-white/10">
                      <div className="text-[14px] font-normal text-white truncate">
                        {session.name || session.email}
                      </div>
                      {session.email && session.name && (
                        <div className="text-[11px] font-mono text-[#898989] truncate mt-0.5">
                          {session.email}
                        </div>
                      )}
                    </div>

                    {/* Menu Links */}
                    <div className="px-5 py-3.5 flex flex-col gap-3 text-[14px] text-[#E5E5E5]">
                      <Link
                        href="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="hover:text-[#E8602E] transition-colors"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/studio/new"
                        onClick={() => setProfileOpen(false)}
                        className="hover:text-[#E8602E] transition-colors"
                      >
                        Compiler Studio
                      </Link>
                      <Link
                        href="/approvals"
                        onClick={() => setProfileOpen(false)}
                        className="hover:text-[#E8602E] transition-colors flex items-center gap-2"
                      >
                        <span>Approval Gates</span>
                        {pendingApprovalsCount > 0 && (
                          <span className="h-2 w-2 rounded-full bg-[#E8602E]" />
                        )}
                      </Link>
                      <Link
                        href="/policies"
                        onClick={() => setProfileOpen(false)}
                        className="hover:text-[#E8602E] transition-colors"
                      >
                        Policies &amp; Caps
                      </Link>
                      <Link
                        href="/runs"
                        onClick={() => setProfileOpen(false)}
                        className="hover:text-[#E8602E] transition-colors"
                      >
                        Execution Runs
                      </Link>
                      <Link
                        href="/audit"
                        onClick={() => setProfileOpen(false)}
                        className="hover:text-[#E8602E] transition-colors"
                      >
                        Audit Log
                      </Link>
                    </div>

                    {/* Divider + LOGOUT Button */}
                    <div className="mx-5 border-t border-white/10 pt-3.5 pb-4">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          handleLogout();
                        }}
                        className="px-5 py-2.5 bg-[#DCDCDC] hover:bg-white text-[#111111] text-[12px] font-medium tracking-[0.12em] uppercase rounded-[3px] transition-colors cursor-pointer"
                      >
                        LOGOUT
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/login"
                className="h-8 px-3 rounded-lg bg-[#0C0C0C] border border-[#232323] text-[#D4D4D4] hover:text-white hover:border-[#4E4A48] text-xs flex items-center gap-1.5 font-medium transition-colors"
                title="Sign in with Google OAuth"
              >
                <User className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  );
}

