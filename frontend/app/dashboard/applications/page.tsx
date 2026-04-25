"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ChevronDown, Inbox } from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  company?: string;
  job_title?: string;
  score?: number;
  status: string;
  applied_at?: string;
  created_at?: string;
  days_to_response?: number;
  source?: string;
}

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
  { key: "no_response", label: "No Response" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["key"];

const OUTCOME_OPTIONS = [
  { value: "interview", label: "Scheduled Interview" },
  { value: "offer", label: "Received Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "no_response", label: "No Response" },
  { value: "withdrawn", label: "Withdrawn" },
];

// ── score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number }) {
  if (score == null)
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border text-xs font-mono text-muted-foreground">
        —
      </span>
    );
  const colorClass =
    score >= 80 ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/8" :
    score >= 65 ? "border-amber-500/40 text-amber-400 bg-amber-500/8" :
                  "border-rose-500/40 text-rose-400 bg-rose-500/8";
  return (
    <span
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border text-xs font-mono font-semibold ${colorClass}`}
    >
      {score}
    </span>
  );
}

// ── status chip ───────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  interview:   "bg-cyan-500/12 border-cyan-500/30 text-cyan-400",
  offer:       "bg-emerald-500/12 border-emerald-500/30 text-emerald-400",
  rejected:    "bg-rose-500/12 border-rose-500/30 text-rose-400",
  applied:     "bg-violet-500/12 border-violet-500/30 text-violet-400",
  submitted:   "bg-violet-500/12 border-violet-500/30 text-violet-400",
  no_response: "bg-zinc-500/12 border-zinc-500/30 text-zinc-400",
  withdrawn:   "bg-zinc-500/12 border-zinc-500/30 text-zinc-400",
  responded:   "bg-blue-500/12 border-blue-500/30 text-blue-400",
};

function StatusChip({ status }: { status: string }) {
  const cls = STATUS_CHIP[status] ?? "bg-zinc-500/12 border-zinc-500/30 text-zinc-400";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium capitalize ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

// ── outcome dropdown ──────────────────────────────────────────────────────────

function OutcomeDropdown({ appId }: { appId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const record = useMutation({
    mutationFn: (outcome: string) =>
      api.post(`/api/v1/applications/${appId}/outcome`, { outcome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      setOpen(false);
    },
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface-2 text-xs text-muted-foreground hover:text-foreground hover:border-brand/40 transition-colors"
      >
        Record Outcome
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-xl border border-border bg-surface shadow-lg shadow-black/40 overflow-hidden">
            {OUTCOME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => record.mutate(opt.value)}
                disabled={record.isPending}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      <td className="py-3 pr-4">
        <div className="skeleton h-4 w-32 rounded mb-1" />
        <div className="skeleton h-3 w-24 rounded" />
      </td>
      <td className="py-3 pr-4"><div className="skeleton w-9 h-9 rounded-full" /></td>
      <td className="py-3 pr-4"><div className="skeleton h-5 w-20 rounded-full" /></td>
      <td className="py-3 pr-4"><div className="skeleton h-3 w-16 rounded" /></td>
      <td className="py-3 pr-4"><div className="skeleton h-3 w-10 rounded" /></td>
      <td className="py-3"><div className="skeleton h-6 w-28 rounded-lg" /></td>
    </tr>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyState({ status }: { status: string }) {
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox size={32} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">No applications</p>
          <p className="text-xs mt-1 opacity-70">
            {status === "all"
              ? "Start applying to jobs to see them here"
              : `No ${status.replace("_", " ")} applications yet`}
          </p>
        </div>
      </td>
    </tr>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ["applications", activeTab],
    queryFn: () => {
      const url =
        activeTab === "all"
          ? "/api/v1/applications"
          : `/api/v1/applications?status=${activeTab}`;
      return api.get(url).then((r) => r.data);
    },
  });

  const displayed =
    activeTab === "all"
      ? applications
      : applications.filter((a) => a.status === activeTab);

  return (
    <div className="space-y-6">
      {/* ── header ── */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-foreground">Applications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track every application and record outcomes
        </p>
      </div>

      {/* ── tab strip ── */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto pb-px">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? applications.length
              : applications.filter((a) => a.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key
                      ? "bg-brand/20 text-brand"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── table ── */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 pr-4 uppercase tracking-widest">
                  Company / Role
                </th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 pr-4 uppercase tracking-widest">
                  Score
                </th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 pr-4 uppercase tracking-widest">
                  Status
                </th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 pr-4 uppercase tracking-widest">
                  Applied
                </th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 pr-4 uppercase tracking-widest">
                  Days
                </th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3 uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : displayed.length === 0 ? (
                <EmptyState status={activeTab} />
              ) : (
                displayed.map((app) => {
                  const dateStr = app.applied_at ?? app.created_at;
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })
                    : "—";

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-surface-2/60 transition-colors group"
                    >
                      {/* company + title */}
                      <td className="px-4 py-3 pr-4 max-w-[200px]">
                        <p className="font-semibold text-foreground truncate">
                          {app.company || "Unknown Company"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {app.job_title || "—"}
                        </p>
                      </td>

                      {/* score */}
                      <td className="px-4 py-3 pr-4">
                        <ScoreBadge score={app.score} />
                      </td>

                      {/* status */}
                      <td className="px-4 py-3 pr-4">
                        <StatusChip status={app.status} />
                      </td>

                      {/* applied date */}
                      <td className="px-4 py-3 pr-4">
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {formattedDate}
                        </span>
                      </td>

                      {/* days to response */}
                      <td className="px-4 py-3 pr-4">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {app.days_to_response != null ? app.days_to_response : "—"}
                        </span>
                      </td>

                      {/* actions */}
                      <td className="px-4 py-3 text-right">
                        <OutcomeDropdown appId={app.id} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* summary line */}
      {!isLoading && displayed.length > 0 && (
        <p className="text-xs text-muted-foreground text-right font-mono">
          {displayed.length} application{displayed.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
