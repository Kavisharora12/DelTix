"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Play,
  CheckCircle2,
  Bot,
  ShieldCheck,
  FileText,
  PanelLeftClose,
  PanelLeft,
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
      label: "Audit log",
      href: "/audit",
      icon: FileText,
      match: (p: string) => p.startsWith("/audit"),
    },
  ];

  return (
    <aside
      className={cn(
        "h-screen bg-[#050505] border-r border-[#232323] flex flex-col shrink-0 transition-all duration-fast select-none relative font-sans",
        collapsed ? "w-14" : "w-[236px]"
      )}
    >
      {/* Workspace Switcher */}
      <div className="h-14 border-b border-[#232323] flex items-center justify-between px-4">
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2 truncate" title={tenantId || "DelTix"}>
            <img src="/deltix-logo.svg" alt="DelTix" className="h-6 w-auto object-contain" />
          </Link>
        ) : (
          <Link href="/" className="mx-auto" title={tenantId || "DelTix"}>
            <img src="/deltix-logo.svg" alt="DelTix" className="h-5 w-5 object-contain object-left" />
          </Link>
        )}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#898989] hover:text-white p-1.5 rounded-md hover:bg-[#121212] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "h-9 flex items-center gap-2.5 px-3 rounded-lg text-[13.5px] transition-colors relative group",
                active
                  ? "bg-[#0E0E0E] border border-[#232323] text-white font-medium"
                  : "text-[#898989] hover:text-white hover:bg-[#0A0A0A] border border-transparent"
              )}
            >
              {/* Selected 2px left bar in DelTix orange */}
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#E8602E] rounded-r" />
              )}

              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-[#E8602E]" : "text-[#898989] group-hover:text-white"
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
    </aside>
  );
}

