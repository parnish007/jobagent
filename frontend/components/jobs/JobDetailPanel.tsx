"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X, ExternalLink, MapPin, Building2, DollarSign, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobDetailPanelProps {
  jobId: string;
  onClose: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    : score >= 55 ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : "text-red-400 bg-red-400/10 border-red-400/20";
  return (
    <span className={cn("text-sm font-bold px-3 py-1 rounded-full border tabular-nums", cls)}>
      {score} / 100
    </span>
  );
}

export function JobDetailPanel({ jobId, onClose }: JobDetailPanelProps) {
  const qc = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    },
  });

  const reject = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    },
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Job Details</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-secondary/50 rounded animate-pulse" />
            ))}
          </div>
        ) : !job ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Job not found.</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Title + score */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-foreground leading-tight">
                  {job.raw_job?.title}
                </h3>
                <ScoreBadge score={job.score} />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 size={13} />
                  {job.raw_job?.company}
                </span>
                {job.raw_job?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} />
                    {job.raw_job.location}
                  </span>
                )}
                {job.raw_job?.posted_date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    {new Date(job.raw_job.posted_date).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {job.raw_job?.remote && (
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    Remote
                  </span>
                )}
                {job.raw_job?.employment_type && (
                  <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                    {job.raw_job.employment_type}
                  </span>
                )}
                {(job.raw_job?.salary_min || job.raw_job?.salary_max) && (
                  <span className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                    <DollarSign size={10} />
                    {job.raw_job.salary_min
                      ? `$${Math.round(job.raw_job.salary_min / 1000)}k`
                      : ""}
                    {job.raw_job.salary_min && job.raw_job.salary_max ? " – " : ""}
                    {job.raw_job.salary_max
                      ? `$${Math.round(job.raw_job.salary_max / 1000)}k`
                      : ""}
                  </span>
                )}
                <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                  via {job.raw_job?.source}
                </span>
              </div>
            </div>

            {/* AI Score Reasoning */}
            {job.score_reasoning && (
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  AI Assessment
                </h4>
                <p className="text-sm text-foreground leading-relaxed">{job.score_reasoning}</p>
              </div>
            )}

            {/* Skills */}
            {(job.matched_skills?.length > 0 || job.missing_skills?.length > 0) && (
              <div className="space-y-3">
                {job.matched_skills?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      Matched Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {job.matched_skills.map((skill: string) => (
                        <span key={skill} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {job.missing_skills?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <XCircle size={12} className="text-red-400" />
                      Missing Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {job.missing_skills.map((skill: string) => (
                        <span key={skill} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {job.raw_job?.description && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Job Description
                </h4>
                <div className="rounded-xl border border-border bg-secondary/10 p-4 max-h-64 overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {job.raw_job.description}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            {job.status === "pending_review" && (
              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600/15 text-emerald-400 text-sm font-medium hover:bg-emerald-600/25 border border-emerald-600/20 transition-colors disabled:opacity-50"
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending || reject.isPending}
                >
                  <CheckCircle2 size={15} />
                  Approve
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600/15 text-red-400 text-sm font-medium hover:bg-red-600/25 border border-red-600/20 transition-colors disabled:opacity-50"
                  onClick={() => reject.mutate()}
                  disabled={approve.isPending || reject.isPending}
                >
                  <XCircle size={15} />
                  Reject
                </button>
              </div>
            )}

            {/* View original */}
            {job.raw_job?.url && (
              <a
                href={job.raw_job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <ExternalLink size={14} />
                View Original Listing
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
