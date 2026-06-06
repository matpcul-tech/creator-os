"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Home,
  Menu,
  X,
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
    items: [{ label: "Integrations", href: "/integrations", icon: Plug }],
  },
];

export function Sidebar({ creatorName }: { creatorName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  // Shared nav renderer. iconOnly is for the collapsed desktop rail.
  // onNavigate lets the mobile drawer close itself when a link is tapped.
  function NavGroups({
    iconOnly = false,
    onNavigate,
  }: {
    iconOnly?: boolean;
    onNavigate?: () => void;
  }) {
    return (
      <>
        {navGroups.map((group) => (
          <div key={group.label}>
            {!iconOnly && (
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
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${active ? "bg-brand-500/15 text-brand-400" : "text-dark-400 hover:text-white hover:bg-dark-800/50"}`}
                    title={iconOnly ? item.label : undefined}
                  >
                    <item.icon size={20} className="shrink-0" />
                    {!iconOnly && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </>
    );
  }

  function BottomActions({
    iconOnly = false,
    onNavigate,
  }: {
    iconOnly?: boolean;
    onNavigate?: () => void;
  }) {
    return (
      <>
        <Link
          href="/onboarding"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-white hover:bg-dark-800/50 transition-all"
        >
          <Settings size={20} className="shrink-0" />
          {!iconOnly && <span>Profile &amp; Setup</span>}
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-white hover:bg-dark-800/50 transition-all"
        >
          <Home size={20} className="shrink-0" />
          {!iconOnly && <span>Landing</span>}
        </Link>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-white hover:bg-dark-800/50 transition-all w-full disabled:opacity-50"
          title={iconOnly ? "Sign out" : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!iconOnly && <span>{signingOut ? "Signing out..." : "Sign out"}</span>}
        </button>
      </>
    );
  }

  return (
    <>
      {/* Mobile top bar (below md). Holds the hamburger + brand. */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-4 border-b border-dark-800/50 bg-dark-950">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1.5 rounded-lg text-dark-300 hover:text-white hover:bg-dark-800/50 transition-all"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-white truncate">CreatorAI</span>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[82%] flex flex-col border-r border-dark-800/50 bg-dark-950 shadow-2xl">
            <div className="flex items-center justify-between px-4 h-14 border-b border-dark-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-bold text-white block leading-tight">
                    CreatorAI
                  </span>
                  {creatorName ? (
                    <span className="text-xs text-dark-500 truncate block">
                      {creatorName}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800/50 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
              <NavGroups onNavigate={() => setMobileOpen(false)} />
            </nav>

            <div className="p-3 border-t border-dark-800/50 space-y-1">
              <BottomActions onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar (md and up). Collapsible rail. */}
      <aside
        className={`${collapsed ? "w-[72px]" : "w-64"} hidden md:flex h-screen sticky top-0 flex-col transition-all duration-300 border-r border-dark-800/50 bg-dark-950`}
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
          <NavGroups iconOnly={collapsed} />
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-dark-800/50 space-y-1">
          <BottomActions iconOnly={collapsed} />
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
    </>
  );
}
