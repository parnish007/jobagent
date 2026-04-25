"use client";
import { cn } from "@/lib/utils";
import { ArrowRight, MapPin } from "lucide-react";

export interface Job {
  id: string;
  score: number;
  status: string;
  raw_job: {
    title: string;
    company: string;
    location?: string;
    employment_type?: string;
    remote?: boolean;
    salary_min?: number;
    salary_max?: number;
    salary_currency?: string;
    source: string;
    posted_date?: string;
    url: string;
  };
  score_reasoning?: string;
  matched_skills?: string[];
  missing_skills?: string[];
}

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
}

/* ── Score ring SVG ──────────────────────────────────────────── */
function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;

  const color =
    score >= 75
      ? "#34d399" // emerald-400
      : score >= 50
      ? "#fbbf24" // amber-400
      : "#fb7185"; // rose-400

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {/* track */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={3}
      />
      {/* arc — starts at top (rotate -90deg) */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
      <text
        x={cx}
        y={cx + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size === 44 ? 11 : 14}
        fontWeight="700"
        fill={color}
        fontFamily="var(--font-mono), monospace"
      >
        {score}
      </text>
    </svg>
  );
}

/* ── Source badge colours ─────────────────────────────────────── */
function sourceBadgeClass(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("linkedin"))    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (s.includes("indeed"))      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (s.includes("glassdoor"))   return "bg-green-500/10 text-green-400 border-green-500/20";
  if (s.includes("google"))      return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  if (s.includes("zip"))         return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  return "bg-surface-2 text-muted-foreground border-border";
}

/* ── Relative date helper ─────────────────────────────────────── */
function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30)  return `${days}d ago`;
  const wks = Math.floor(days / 7);
  if (wks < 8)    return `${wks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Salary formatter ─────────────────────────────────────────── */
function formatSalary(min?: number, max?: number, currency = "USD"): string | null {
  const sym = currency === "USD" ? "$" : currency;
  if (min && max) return `${sym}${Math.round(min / 1000)}k – ${sym}${Math.round(max / 1000)}k`;
  if (min)        return `${sym}${Math.round(min / 1000)}k+`;
  if (max)        return `up to ${sym}${Math.round(max / 1000)}k`;
  return null;
}

/* ── JobCard ──────────────────────────────────────────────────── */
export function JobCard({ job, onClick }: JobCardProps) {
  const { raw_job, score, status } = job;
  const salary = formatSalary(raw_job.salary_min, raw_job.salary_max, raw_job.salary_currency);
  const isRejected = status === "rejected";
  const isApproved = status === "approved";

  return (
    <div
      onClick={() => onClick(job)}
      className={cn(
        "relative bg-surface border border-border rounded-xl p-4 card-hover cursor-pointer animate-slide-up",
        "flex flex-col gap-3",
        isRejected && "opacity-40 grayscale"
      )}
    >
      {/* Approved dot */}
      {isApproved && (
        <span
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 pulse-dot"
          aria-label="Approved"
        />
      )}

      {/* Top row: score ring + title / company / location */}
      <div className="flex items-start gap-3">
        <ScoreRing score={score} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-tight truncate pr-4">
            {raw_job.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate font-medium">
            {raw_job.company}
          </p>
          {raw_job.location && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
              <MapPin size={10} className="shrink-0" />
              {raw_job.location}
            </p>
          )}
        </div>
      </div>

      {/* Middle: tag chips */}
      <div className="flex flex-wrap gap-1.5">
        {raw_job.employment_type && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-2 border border-border text-muted-foreground capitalize">
            {raw_job.employment_type.replace(/_/g, " ")}
          </span>
        )}
        {raw_job.remote && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            Remote
          </span>
        )}
        {salary && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-2 border border-border text-muted-foreground font-mono">
            {salary}
          </span>
        )}
      </div>

      {/* Bottom row: source + date + review arrow */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/60">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded border capitalize",
              sourceBadgeClass(raw_job.source)
            )}
          >
            {raw_job.source.replace(/_/g, " ")}
          </span>
          {raw_job.posted_date && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {relativeDate(raw_job.posted_date)}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-brand/70 group-hover:text-brand tracking-wide uppercase">
          Review
          <ArrowRight size={10} />
        </span>
      </div>
    </div>
  );
}
