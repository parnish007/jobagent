"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { JobFeed } from "@/components/jobs/JobFeed";

const STATUS_TABS = [
  { key: "pending_review", label: "Pending Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function JobsPage() {
  const [status, setStatus] = useState("pending_review");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", status],
    queryFn: () => api.get(`/jobs?status=${status}&limit=100`).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and manage AI-matched job listings</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              status === tab.key
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setStatus(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <JobFeed jobs={jobs} />
      )}
    </div>
  );
}
