"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Play,
  CheckCircle2,
  Bot,
  ShieldCheck,
  BookOpen,
  FileText,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Building2,
  Sparkles,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDelTixStore } from "@/lib/store";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { runs, tenantId } = useDelTixStore();

  const pendingApprovalsCount = runs.filter((r) => r.status === "PAUSED_FOR_APPROVAL").length;

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      match: (p: string) => p === "/dashboard",
    },
    {
      label: "Compiler Studio",
      href: "/studio/new",
      icon: Sparkles,
      match: (p: string) => p.startsWith("/studio"),
    },
    {
      label: "Live Sandbox",
      href: "/sandbox",
      icon: Terminal,
      match: (p: string) => p.startsWith("/sandbox"),
    },
    {
      label: "Runs",
      href: "/runs",
      icon: Play,
      match: (p: string) => p.startsWith("/runs"),
    },
    {
      label: "Approvals",
      href: "/approvals",
      icon: CheckCircle2,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      match: (p: string) => p.startsWith("/approvals"),
    },
    {
      label: "Agents",
      href: "/agents",
      icon: Bot,
      match: (p: string) => p.startsWith("/agents"),
    },
    {
      label: "Policies",
      href: "/policies",
      icon: ShieldCheck,
      match: (p: string) => p.startsWith("/policies"),
    },
    {
      label: "Ledger",
      href: "/ledger",
      icon: BookOpen,
      match: (p: string) => p.startsWith("/ledger"),
    },
    {
      label: "Audit log",
      href: "/audit",
      icon: FileText,
      match: (p: string) => p.startsWith("/audit"),
    },
    {
      label: "Landing & Story",
      href: "/",
      icon: Home,
      match: (p: string) => p === "/",
    },
  ];

  return (
    <aside
      className={cn(
        "h-screen bg-panel border-r border-slate-5 flex flex-col shrink-0 transition-all duration-fast select-none relative",
        collapsed ? "w-14" : "w-[232px]"
      )}
    >
      {/* Workspace Switcher */}
      <div className="h-12 border-b border-slate-5 flex items-center justify-between px-3">
        {!collapsed ? (
          <div className="flex items-center gap-2 truncate">
            <div className="w-5 h-5 rounded bg-slate-12 text-slate-1 flex items-center justify-center font-bold text-xs">
              Δ
            </div>
            <div className="truncate">
              <div className="text-ui text-slate-12 font-medium leading-none truncate">
                DelTix Ops
              </div>
              <div className="text-[11px] font-mono text-slate-10 mt-0.5 truncate">
                {tenantId}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-6 h-6 rounded bg-slate-12 text-slate-1 flex items-center justify-center font-bold text-xs mx-auto">
            Δ
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-10 hover:text-slate-12 p-1 rounded hover:bg-slate-4"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "h-8 flex items-center gap-2.5 px-2.5 rounded-btn text-ui transition-colors relative group",
                active
                  ? "bg-slate-4 text-slate-12 font-medium"
                  : "text-slate-11 hover:text-slate-12 hover:bg-slate-3"
              )}
            >
              {/* Selected 2px left bar in blue9 */}
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-blue-9 rounded-r" />
              )}

              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-slate-12" : "text-slate-10 group-hover:text-slate-11"
                )}
              />

              {!collapsed && (
                <span className="truncate flex-1">{item.label}</span>
              )}

              {!collapsed && item.badge !== undefined && (
                <span className="h-4 min-w-[18px] px-1 rounded-badge bg-amber-3 border border-amber-6 text-amber-11 text-[11px] font-medium flex items-center justify-center tabular-nums">
                  {item.badge}
                </span>
              )}

              {collapsed && item.badge !== undefined && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-9" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-5 text-[11px] text-slate-10">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <span className="font-mono">DelTix v1.0</span>
            <span className="text-slate-9">PayPal Sandbox</span>
          </div>
        ) : (
          <div className="text-center font-mono">v1.0</div>
        )}
      </div>
    </aside>
  );
}

