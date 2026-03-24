"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { JobCard } from "./JobCard";
import { JobDetailPanel } from "./JobDetailPanel";

interface JobFeedProps {
  jobs: any[];
}

export function JobFeed({ jobs }: JobFeedProps) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/jobs/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/jobs/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground text-sm">No jobs to review. Run the agent to scrape new listings.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {jobs.map((job: any) => (
          <JobCard
            key={job.id}
            job={job}
            onApprove={(id) => approve.mutate(id)}
            onReject={(id) => reject.mutate(id)}
            onSelect={setSelectedId}
            isPending={approve.isPending || reject.isPending}
          />
        ))}
      </div>

      {selectedId && (
        <JobDetailPanel
          jobId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
