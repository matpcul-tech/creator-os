"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  Wand2,
  Calendar,
  BarChart3,
  Brain,
  DollarSign,
  GraduationCap,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  KanbanSquare,
  Users,
  Plug,
} from "lucide-react";

const navGroups = [
  {
    label: "Plan",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Ideas", href: "/ideas", icon: Lightbulb },
      { label: "Planner", href: "/planner", icon: KanbanSquare },
      { label: "Calendar", href: "/calendar", icon: Calendar },
    ],
  },
  {
    label: "Make",
    items: [
      { label: "Studio", href: "/studio", icon: Wand2 },
      { label: "Brand DNA", href: "/brand", icon: Brain },
    ],
  },
  {
    label: "Grow",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Audience", href: "/audience", icon: Users },
      { label: "Monetize", href: "/monetize", icon: DollarSign },
      { label: "Learn", href: "/learn", icon: GraduationCap },
    ],
  },
  {
    label: "Wire it up",
    items: [
      { label: "Integrations", href: "/integrations", icon: Plug },
    ],
  },
];

export function Sidebar({ creatorName }: { creatorName?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? "w-[72px]" : "w-64"} h-screen sticky top-0 flex flex-col transition-all duration-300 border-r border-dark-800/50 bg-dark-950`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-dark-800/50">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-lg font-bold text-white block leading-tight">
              CreatorAI
            </span>
            {creatorName ? (
              <span className="text-xs text-dark-500 truncate block">
                {creatorName}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-dark-600">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${active ? "bg-brand-500/15 text-brand-400" : "text-dark-400 hover:text-white hover:bg-dark-800/50"}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={20} className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-dark-800/50 space-y-1">
        <Link
          href="/onboarding"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-white hover:bg-dark-800/50 transition-all"
        >
          <Settings size={20} className="shrink-0" />
          {!collapsed && <span>Profile & Setup</span>}
        </Link>
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-white hover:bg-dark-800/50 transition-all"
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>Landing</span>}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-500 hover:text-white hover:bg-dark-800/50 transition-all w-full"
        >
          {collapsed ? (
            <ChevronRight size={20} />
          ) : (
            <>
              <ChevronLeft size={20} className="shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
