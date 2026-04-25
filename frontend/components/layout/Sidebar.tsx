"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FileCheck,
  BarChart3,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",              label: "Dashboard",    icon: LayoutDashboard },
  { href: "/dashboard/jobs",         label: "Jobs",         icon: Briefcase       },
  { href: "/dashboard/applications", label: "Applications", icon: FileCheck       },
  { href: "/dashboard/analytics",    label: "Analytics",    icon: BarChart3       },
  { href: "/dashboard/resume",       label: "Resume",       icon: FileText        },
  { href: "/dashboard/settings",     label: "Settings",     icon: Settings        },
];

interface SidebarProps {
  agentStatus?: "idle" | "running" | "paused";
  userEmail?: string;
  userName?: string;
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "JA";
}

const STATUS_CONFIG = {
  idle:    { label: "Agent Ready",   dotClass: "bg-emerald-400",              textClass: "text-emerald-400" },
  running: { label: "Agent Running", dotClass: "bg-brand pulse-dot",          textClass: "text-brand"       },
  paused:  { label: "Agent Paused",  dotClass: "bg-amber-400",                textClass: "text-amber-400"   },
} as const;

export function Sidebar({
  agentStatus = "idle",
  userEmail,
  userName,
}: SidebarProps) {
  const pathname = usePathname();
  const status   = STATUS_CONFIG[agentStatus];
  const initials = getInitials(userName, userEmail);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
  };

  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col h-full border-r border-border bg-surface"
      style={{ minWidth: 220 }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        {/* "JA" monogram block */}
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(var(--brand))" }}
        >
          <span className="font-sans font-bold text-white text-[13px] tracking-tight leading-none select-none">
            JA
          </span>
        </div>
        <span className="font-sans font-bold text-foreground text-[15px] tracking-tight leading-none">
          Job Agent
        </span>
      </div>

      {/* ── Agent status badge ── */}
      <div className="px-5 py-3 border-b border-border">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{ background: "hsl(var(--brand) / 0.07)" }}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full flex-shrink-0",
              status.dotClass
            )}
          />
          <span className={cn("text-[11px] font-mono font-medium tracking-wide uppercase", status.textClass)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          /* Exact match for dashboard root, prefix match for sub-routes */
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150",
                isActive
                  ? "nav-active font-medium"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon
                size={15}
                className={cn(
                  "flex-shrink-0 transition-colors duration-150",
                  isActive
                    ? "text-brand"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── User area ── */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-surface-2 transition-colors duration-150 group">
          {/* Avatar circle */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold font-sans text-white select-none"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--brand)) 0%, hsl(var(--brand-dim)) 100%)",
            }}
          >
            {initials}
          </div>

          {/* Email */}
          <div className="flex-1 min-w-0">
            {userName && (
              <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                {userName}
              </p>
            )}
            <p
              className={cn(
                "text-[11px] text-muted-foreground truncate leading-tight",
                !userName && "text-[12px]"
              )}
            >
              {userEmail ?? "user@jobagent.ai"}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground hover:text-foreground p-0.5"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
