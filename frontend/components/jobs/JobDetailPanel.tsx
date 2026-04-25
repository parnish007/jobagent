"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  X,
  ExternalLink,
  MapPin,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Briefcase,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "./JobCard";

interface JobDetailPanelProps {
  job: Job;
  onClose: () => void;
  onAction?: (id: string, action: "approved" | "rejected") => void;
}

/* ── Large score ring (64 px) ──────────────────────────────── */
function ScoreRingLarge({ score }: { score: number }) {
  const size = 64;
  const r = (size - 8) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;

  const color =
    score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#fb7185";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={4} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
      <text
        x={cx}
        y={cx - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={15}
        fontWeight="700"
        fill={color}
        fontFamily="var(--font-mono), monospace"
      >
        {score}
      </text>
      <text
        x={cx}
        y={cx + 11}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={7}
        fill="hsl(var(--muted-foreground))"
        fontFamily="var(--font-mono), monospace"
      >
        /100
      </text>
    </svg>
  );
}

/* ── Truncated description ──────────────────────────────────── */
function TruncatedText({ text, limit = 400 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const short = text.length > limit;
  const displayed = expanded || !short ? text : text.slice(0, limit) + "…";

  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
        {displayed}
      </p>
      {short && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-brand/70 hover:text-brand transition-colors"
        >
          {expanded ? (
            <>Show less <ChevronUp size={11} /></>
          ) : (
            <>Show more <ChevronDown size={11} /></>
          )}
        </button>
      )}
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────── */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
      {children}
    </h4>
  );
}

/* ── JobDetailPanel ─────────────────────────────────────────── */
export function JobDetailPanel({ job: initialJob, onClose, onAction }: JobDetailPanelProps) {
  const qc = useQueryClient();

  // Fetch fresh data for the job; fall back to the prop while loading
  const { data: job = initialJob } = useQuery<Job>({
    queryKey: ["job", initialJob.id],
    queryFn: () => api.get(`/jobs/${initialJob.id}`).then((r) => r.data),
  });

  const approve = useMutation({
    mutationFn: () => api.put(`/jobs/${job.id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", job.id] });
      onAction?.(job.id, "approved");
      onClose();
    },
  });

  const reject = useMutation({
    mutationFn: () => api.put(`/jobs/${job.id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", job.id] });
      onAction?.(job.id, "rejected");
      onClose();
    },
  });

  const raw = job.raw_job;
  const isPending = approve.isPending || reject.isPending;

  const salaryText = (() => {
    const sym = raw.salary_currency === "USD" ? "$" : (raw.salary_currency ?? "$");
    if (raw.salary_min && raw.salary_max)
      return `${sym}${Math.round(raw.salary_min / 1000)}k – ${sym}${Math.round(raw.salary_max / 1000)}k`;
    if (raw.salary_min) return `${sym}${Math.round(raw.salary_min / 1000)}k+`;
    if (raw.salary_max) return `up to ${sym}${Math.round(raw.salary_max / 1000)}k`;
    return null;
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-[480px] bg-surface border-l border-border z-50 flex flex-col animate-slide-in-right shadow-brand-lg">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border px-5 py-4 flex items-start gap-4">
          <ScoreRingLarge score={job.score} />
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-base font-bold text-foreground leading-tight">
              {raw.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
              <Building2 size={12} />
              {raw.company}
            </p>
            {raw.location && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                <MapPin size={11} />
                {raw.location}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors mt-0.5"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {raw.employment_type && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface-2 border border-border text-muted-foreground capitalize">
                <Briefcase size={10} />
                {raw.employment_type.replace(/_/g, " ")}
              </span>
            )}
            {raw.remote && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                Remote
              </span>
            )}
            {salaryText && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface-2 border border-border text-muted-foreground font-mono">
                <DollarSign size={10} />
                {salaryText}
              </span>
            )}
            {raw.posted_date && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface-2 border border-border text-muted-foreground">
                <Calendar size={10} />
                {new Date(raw.posted_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {/* Score reasoning */}
          {job.score_reasoning && (
            <div className="space-y-1.5">
              <SectionHeader>AI Assessment</SectionHeader>
              <div className="border-l-2 border-brand/50 pl-4 py-1">
                <p className="text-sm text-foreground/80 leading-relaxed italic">
                  {job.score_reasoning}
                </p>
              </div>
            </div>
          )}

          {/* Matched skills */}
          {(job.matched_skills?.length ?? 0) > 0 && (
            <div>
              <SectionHeader>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} className="text-emerald-400" />
                  Matched Skills
                </span>
              </SectionHeader>
              <div className="flex flex-wrap gap-1.5">
                {job.matched_skills!.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing skills */}
          {(job.missing_skills?.length ?? 0) > 0 && (
            <div>
              <SectionHeader>
                <span className="flex items-center gap-1.5">
                  <XCircle size={10} className="text-rose-400" />
                  Missing Skills
                </span>
              </SectionHeader>
              <div className="flex flex-wrap gap-1.5">
                {job.missing_skills!.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Job description */}
          {(raw as any).description && (
            <div>
              <SectionHeader>Job Description</SectionHeader>
              <div className="rounded-lg border border-border bg-surface-2/50 p-4">
                <TruncatedText text={(raw as any).description} limit={400} />
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky footer ───────────────────────────────── */}
        <div className="shrink-0 border-t border-border px-5 py-4 flex gap-2.5">
          {/* Approve */}
          <button
            onClick={() => approve.mutate()}
            disabled={isPending}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              "bg-brand hover:bg-brand-dim text-white disabled:opacity-50"
            )}
          >
            <CheckCircle2 size={14} />
            {approve.isPending ? "Approving…" : "Approve"}
          </button>

          {/* Reject */}
          <button
            onClick={() => reject.mutate()}
            disabled={isPending}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              "border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
            )}
          >
            <XCircle size={14} />
            {reject.isPending ? "Rejecting…" : "Reject"}
          </button>

          {/* View original */}
          <a
            href={raw.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center px-3 py-2.5 rounded-xl text-sm transition-colors",
              "border border-border text-muted-foreground hover:text-foreground hover:border-brand/40"
            )}
            aria-label="View original listing"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </>
  );
}
