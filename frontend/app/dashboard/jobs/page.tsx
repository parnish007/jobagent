"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { JobFeed } from "@/components/jobs/JobFeed";
import { JobSearchBar } from "@/components/jobs/JobSearchBar";
import { cn } from "@/lib/utils";
import type { Job } from "@/components/jobs/JobCard";
import { BriefcaseBusiness } from "lucide-react";

/* ── Status tab definitions ──────────────────────────────────── */
const STATUS_TABS = [
  { key: "pending_review", label: "Pending" },
  { key: "approved",       label: "Approved" },
  { key: "rejected",       label: "Rejected" },
  { key: "all",            label: "All" },
] as const;
type StatusKey = (typeof STATUS_TABS)[number]["key"];

/* ── Skeleton cards ──────────────────────────────────────────── */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton rounded-xl border border-border h-44" />
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */
export default function JobsPage() {
  const [activeTab, setActiveTab]           = useState<StatusKey>("pending_review");
  const [search, setSearch]                 = useState("");
  const [minScore, setMinScore]             = useState(0);
  const [sourceFilter, setSourceFilter]     = useState("");

  /* Fetch all jobs for the active status (or all) */
  const statusParam = activeTab === "all" ? "" : `&status=${activeTab}`;
  const { data: jobs = [], isLoading, refetch } = useQuery<Job[]>({
    queryKey: ["jobs", activeTab],
    queryFn: () =>
      api.get(`/jobs?limit=200${statusParam}`).then((r) => r.data),
  });

  /* Counts per tab — derived from the "all" query for badge accuracy */
  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["jobs", "all"],
    queryFn: () => api.get("/jobs?limit=500").then((r) => r.data),
  });

  const counts = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = { all: allJobs.length };
    for (const j of allJobs) {
      map[j.status] = (map[j.status] ?? 0) + 1;
    }
    return map;
  }, [allJobs]);

  /* Client-side filtering on top of the API result */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter((j) => {
      if (j.score < minScore) return false;
      if (sourceFilter && !j.raw_job.source.toLowerCase().includes(sourceFilter)) return false;
      if (q) {
        const haystack = [
          j.raw_job.title,
          j.raw_job.company,
          j.raw_job.location ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, search, minScore, sourceFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <BriefcaseBusiness size={14} className="text-brand" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Job <span className="text-gradient">Intelligence</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground pl-0.5">
            AI-matched listings — review, approve, or reject each mission brief.
          </p>
        </div>

        {/* Total pill */}
        <span className="shrink-0 mt-1 text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-surface-2 border border-border text-muted-foreground">
          {allJobs.length} total
        </span>
      </div>

      {/* Search / filter bar */}
      <JobSearchBar
        search={search}
        onSearchChange={setSearch}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        onScraped={() => refetch()}
      />

      {/* Status pill tabs */}
      <div className="flex items-center gap-1 bg-surface-2 rounded-full p-1 w-fit border border-border">
        {STATUS_TABS.map((tab) => {
          const count = counts[tab.key] ?? 0;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                active
                  ? "bg-brand text-white shadow-brand-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-surface border border-border text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feed */}
      {isLoading ? (
        <SkeletonGrid />
      ) : (
        <JobFeed jobs={filtered} />
      )}
    </div>
  );
}
