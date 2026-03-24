"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const COLUMNS = [
  { key: "draft", label: "Draft" },
  { key: "resume_ready", label: "Resume Ready" },
  { key: "submitted", label: "Submitted" },
  { key: "responded", label: "Responded" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "border-slate-600",
  resume_ready: "border-blue-600",
  submitted: "border-purple-600",
  responded: "border-amber-600",
  interview: "border-emerald-600",
  offer: "border-green-500",
  rejected: "border-red-700",
};

export default function ApplicationsPage() {
  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.get("/applications").then((r) => r.data),
  });

  const byStatus = COLUMNS.reduce<Record<string, any[]>>((acc, col) => {
    acc[col.key] = applications.filter((a: any) => a.status === col.key);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">{applications.length} total applications</p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map((col) => (
            <div key={col.key} className="w-64 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">{col.label}</span>
                <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
                  {byStatus[col.key]?.length || 0}
                </span>
              </div>
              <div className={`kanban-col border-t-2 pt-3 ${STATUS_COLORS[col.key]}`}>
                {byStatus[col.key]?.map((app: any) => (
                  <ApplicationCard key={app.id} app={app} />
                ))}
                {byStatus[col.key]?.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApplicationCard({ app }: { app: any }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors cursor-pointer">
      <p className="text-sm font-medium text-foreground truncate">{app.scored_job_id}</p>
      <p className="text-xs text-muted-foreground mt-1">{app.submission_method || "—"}</p>
    </div>
  );
}
