"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AgentStatusWidget } from "@/components/agent/AgentStatusWidget";
import {
  Briefcase,
  Check,
  SendHorizonal,
  Star,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentStats {
  status: string;
  jobs_scraped: number;
  jobs_scored: number;
  applications_submitted: number;
}

interface Job {
  id: string;
  title: string;
  company: string;
  score?: number;
  status: string;
}

// ─── Metric card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label:   string;
  value:   string | number;
  icon:    React.ReactNode;
  accent:  string; // Tailwind text color class
  sub?:    string;
  loading?: boolean;
}

function MetricCard({ label, value, icon, accent, sub, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="skeleton rounded-xl h-28 border border-border/40" />
    );
  }

  return (
    <div className="card-hover rounded-xl border border-border bg-surface p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          {label}
        </span>
        <span className={cn("p-1.5 rounded-lg bg-surface-2", accent)}>
          {icon}
        </span>
      </div>
      <div>
        <p className={cn("font-mono text-3xl font-semibold tabular-nums leading-none", accent)}>
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return null;
  return (
    <span
      className={cn(
        "font-mono text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums",
        score >= 75 && "bg-emerald-500/15 text-emerald-400",
        score >= 50 && score < 75 && "bg-amber-500/15 text-amber-400",
        score < 50  && "bg-rose-500/15 text-rose-400",
      )}
    >
      {score}
    </span>
  );
}

// ─── Recent activity list ─────────────────────────────────────────────────────

function RecentActivity({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Recent Activity</span>
        <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-surface-2 border border-border/60">
          Pending review
        </span>
      </div>

      {/* List */}
      <div className="flex flex-col gap-1 stagger">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <TrendingUp size={28} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No jobs awaiting review
            </p>
            <p className="text-xs text-muted-foreground/60">
              Run the agent to start scraping
            </p>
          </div>
        ) : (
          jobs.slice(0, 5).map((job) => (
            <div
              key={job.id}
              className="animate-slide-up flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 border border-transparent hover:border-border/60 transition-all group cursor-pointer"
            >
              <ScoreBadge score={job.score} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {job.title}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {job.company}
                </p>
              </div>
              <span className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors">
                <Check size={13} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const {
    data: agentStats,
    isLoading: statsLoading,
  } = useQuery<AgentStats>({
    queryKey: ["agent-status"],
    queryFn:  () => api.get("/agent/status").then((r) => r.data),
    refetchInterval: 10_000,
  });

  const {
    data: recentJobs = [],
    isLoading: jobsLoading,
  } = useQuery<Job[]>({
    queryKey: ["jobs", "pending_review", "recent"],
    queryFn:  () =>
      api.get("/jobs?limit=5&status=pending_review").then((r) => r.data),
    refetchInterval: 15_000,
  });

  // Derived metrics
  const scraped  = agentStats?.jobs_scraped          ?? 0;
  const scored   = agentStats?.jobs_scored           ?? 0;
  const applied  = agentStats?.applications_submitted ?? 0;
  const avgScore =
    recentJobs.length > 0
      ? Math.round(
          recentJobs.reduce((s, j) => s + (j.score ?? 0), 0) / recentJobs.length
        )
      : 0;

  const metricsLoading = statsLoading;

  return (
    <div className="space-y-6 animate-slide-up">

      {/* ── Page heading ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-gradient">Command Center</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time overview of your autonomous job search pipeline
        </p>
      </div>

      {/* ── Metric strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <MetricCard
          label="Jobs Scraped"
          value={scraped}
          icon={<Briefcase size={14} />}
          accent="text-brand"
          sub="across all boards"
          loading={metricsLoading}
        />
        <MetricCard
          label="Jobs Approved"
          value={scored}
          icon={<Check size={14} />}
          accent="text-emerald-400"
          sub="passed review gate"
          loading={metricsLoading}
        />
        <MetricCard
          label="Applications"
          value={applied}
          icon={<SendHorizonal size={14} />}
          accent="text-cyan-400"
          sub="submitted by agent"
          loading={metricsLoading}
        />
        <MetricCard
          label="Avg Score"
          value={avgScore > 0 ? `${avgScore}` : "—"}
          icon={<Star size={14} />}
          accent="text-amber-400"
          sub="pending review jobs"
          loading={metricsLoading}
        />
      </div>

      {/* ── Main body: 2-col grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — full agent widget */}
        <AgentStatusWidget />

        {/* Right — recent activity */}
        <RecentActivity jobs={recentJobs} loading={jobsLoading} />
      </div>
    </div>
  );
}
