"use client";
import { cn } from "@/lib/utils";
import { MapPin, Building2, DollarSign, ExternalLink } from "lucide-react";

interface Job {
  id: string;
  score: number;
  score_reasoning?: string;
  matched_skills?: string[];
  missing_skills?: string[];
  status: string;
  raw_job: {
    title: string;
    company: string;
    location?: string;
    url: string;
    salary_min?: number;
    salary_max?: number;
    remote?: boolean;
    source: string;
  };
}

interface JobCardProps {
  job: Job;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSelect?: (id: string) => void;
  isPending?: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? "text-emerald-400 bg-emerald-400/10" : score >= 55 ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10";
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full tabular-nums", cls)}>
      {score}
    </span>
  );
}

export function JobCard({ job, onApprove, onReject, onSelect, isPending }: JobCardProps) {
  const { raw_job } = job;

  const salary =
    raw_job.salary_min && raw_job.salary_max
      ? `$${Math.round(raw_job.salary_min / 1000)}k – $${Math.round(raw_job.salary_max / 1000)}k`
      : raw_job.salary_min
      ? `$${Math.round(raw_job.salary_min / 1000)}k+`
      : null;

  return (
    <div
      className="rounded-xl border border-border bg-card hover:border-violet-600/50 transition-colors p-4 space-y-3 cursor-pointer"
      onClick={() => onSelect?.(job.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm truncate">{raw_job.title}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Building2 size={11} />
            <span>{raw_job.company}</span>
            {raw_job.location && (
              <>
                <span className="text-border">·</span>
                <MapPin size={11} />
                <span>{raw_job.location}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ScoreBadge score={job.score} />
          <a href={raw_job.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {job.score_reasoning && (
        <p className="text-xs text-muted-foreground line-clamp-2">{job.score_reasoning}</p>
      )}

      {(salary || raw_job.remote) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {salary && (
            <span className="flex items-center gap-1">
              <DollarSign size={11} />
              {salary}
            </span>
          )}
          {raw_job.remote && (
            <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Remote</span>
          )}
        </div>
      )}

      {job.status === "pending_review" && (
        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex-1 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-400 text-xs font-medium hover:bg-emerald-600/25 transition-colors"
            onClick={() => onApprove(job.id)}
            disabled={isPending}
          >
            Approve
          </button>
          <button
            className="flex-1 py-1.5 rounded-lg bg-red-600/15 text-red-400 text-xs font-medium hover:bg-red-600/25 transition-colors"
            onClick={() => onReject(job.id)}
            disabled={isPending}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
