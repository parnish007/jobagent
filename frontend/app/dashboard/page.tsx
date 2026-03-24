"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { JobFeed } from "@/components/jobs/JobFeed";
import { JobSearchBar } from "@/components/jobs/JobSearchBar";
import { Briefcase, SendHorizonal, TrendingUp, Clock } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}

function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: jobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ["jobs", "pending_review"],
    queryFn: () => api.get("/jobs?status=pending_review").then((r) => r.data),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.get("/applications").then((r) => r.data),
  });

  const submitted = applications.filter((a: any) => a.status === "submitted").length;
  const interviews = applications.filter((a: any) => a.status === "interview").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your job search at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Review" value={jobs.length} icon={<Clock size={18} />} sub="jobs to review" />
        <StatCard label="Applied" value={submitted} icon={<SendHorizonal size={18} />} sub="total applications" />
        <StatCard label="Interviews" value={interviews} icon={<Briefcase size={18} />} sub="responses received" />
        <StatCard
          label="Match Rate"
          value={jobs.length ? `${Math.round((jobs.filter((j: any) => j.score >= 70).length / jobs.length) * 100)}%` : "—"}
          icon={<TrendingUp size={18} />}
          sub="score ≥ 70"
        />
      </div>

      {/* Search */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-foreground">Find Jobs</h2>
        <JobSearchBar onScraped={() => setTimeout(() => refetchJobs(), 3000)} />
      </div>

      {/* Job feed */}
      {jobs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            Jobs to Review
            <span className="ml-2 text-sm font-normal text-muted-foreground">({jobs.length})</span>
          </h2>
          <JobFeed jobs={jobs} />
        </div>
      )}
    </div>
  );
}
