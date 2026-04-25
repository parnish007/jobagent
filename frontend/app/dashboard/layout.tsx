"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusWidget } from "@/components/agent/AgentStatusWidget";
import { api } from "@/lib/api";

// ─── Page title derivation ────────────────────────────────────────────────────

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard":              "Command Center",
  "/dashboard/jobs":         "Jobs",
  "/dashboard/applications": "Applications",
  "/dashboard/resume":       "Resume",
  "/dashboard/analytics":    "Analytics",
  "/dashboard/settings":     "Settings",
};

function deriveTitle(pathname: string): string {
  // Exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  // Prefix match for nested routes
  const match = Object.keys(ROUTE_TITLES)
    .filter((k) => k !== "/dashboard" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_TITLES[match] : "Dashboard";
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface UserProfile {
  email: string;
  full_name?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title    = deriveTitle(pathname);

  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    api
      .get<UserProfile>("/users/me")
      .then((r) => setProfile(r.data))
      .catch(() => {
        // Profile fetch is non-critical — keep null
      });
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ── */}
      <Sidebar userEmail={profile?.email} userName={profile?.full_name} />

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Top header bar ── */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between px-6 border-b border-border"
          style={{
            height: "56px",
            background: "hsl(var(--surface) / 0.80)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Left — page title */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {title}
            </h1>
            {/* Subtle breadcrumb slash for non-root pages */}
            {pathname !== "/dashboard" && (
              <span className="text-muted-foreground/30 text-xs select-none hidden sm:block">
                /
              </span>
            )}
          </div>

          {/* Right — compact agent widget */}
          <AgentStatusWidget compact />
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
