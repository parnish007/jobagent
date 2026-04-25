"use client";
import { useState } from "react";
import { Inbox } from "lucide-react";
import { JobCard, type Job } from "./JobCard";
import { JobDetailPanel } from "./JobDetailPanel";

interface JobFeedProps {
  jobs: Job[];
}

export function JobFeed({ jobs }: JobFeedProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 py-20 px-8 text-center animate-slide-up">
        <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center mb-4">
          <Inbox size={22} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">No jobs found</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
          Run a custom search or trigger the agent to scrape new listings.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onClick={(j) => setSelectedJob(j)}
          />
        ))}
      </div>

      {selectedJob && (
        <JobDetailPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onAction={() => setSelectedJob(null)}
        />
      )}
    </>
  );
}
