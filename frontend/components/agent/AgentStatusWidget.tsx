"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Bot,
  Check,
  Cpu,
  Loader2,
  Pause,
  Play,
  ThumbsDown,
  ThumbsUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentStatus = "idle" | "running" | "paused" | "completed" | "failed";

interface AgentState {
  status: AgentStatus;
  current_step: string | null;
  jobs_scraped: number;
  jobs_scored: number;
  applications_submitted: number;
}

// ─── Pipeline definition ─────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { id: "scraping",    label: "Scraping",   short: "Scrape" },
  { id: "scoring",     label: "Scoring",    short: "Score"  },
  { id: "gate_review", label: "Review",     short: "Gate",  isGate: true },
  { id: "resuming",    label: "Resuming",   short: "Resume" },
  { id: "gate_submit", label: "Approval",   short: "Gate",  isGate: true },
  { id: "submitting",  label: "Submitting", short: "Submit" },
] as const;

type StepId = (typeof PIPELINE_STEPS)[number]["id"];

// Map current_step strings from the backend to pipeline step IDs
function resolveStepId(currentStep: string | null): StepId | null {
  if (!currentStep) return null;
  const s = currentStep.toLowerCase();
  if (s.includes("scrap"))    return "scraping";
  if (s.includes("scor"))     return "scoring";
  if (s.includes("review") || s.includes("gate") && s.includes("review")) return "gate_review";
  if (s.includes("resum"))    return "resuming";
  if (s.includes("approv") || (s.includes("gate") && s.includes("submit"))) return "gate_submit";
  if (s.includes("submit"))   return "submitting";
  return null;
}

function getActiveIndex(currentStep: string | null, status: AgentStatus): number {
  if (status === "paused") {
    // Paused at a gate — find the gate step
    const s = currentStep?.toLowerCase() ?? "";
    if (s.includes("submit") || s.includes("approv")) return 4; // gate_submit
    return 2; // gate_review
  }
  const id = resolveStepId(currentStep);
  if (!id) return -1;
  return PIPELINE_STEPS.findIndex((p) => p.id === id);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase",
        status === "running"   && "bg-brand/15 text-brand border border-brand/25",
        status === "paused"    && "bg-amber-500/15 text-amber-400 border border-amber-500/25",
        status === "completed" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
        status === "failed"    && "bg-rose-500/15 text-rose-400 border border-rose-500/25",
        status === "idle"      && "bg-surface-2 text-muted-foreground border border-border",
      )}
    >
      {status === "running" && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand pulse-dot" />
      )}
      {status === "paused" && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}
      {status === "completed" && <Check size={10} />}
      {status === "failed"    && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
      {status === "idle"      && <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />}
      {status}
    </span>
  );
}

function PipelineTrack({
  activeIndex,
  status,
}: {
  activeIndex: number;
  status: AgentStatus;
}) {
  return (
    <div className="flex items-center gap-0 w-full">
      {PIPELINE_STEPS.map((step, i) => {
        const isDone    = i < activeIndex;
        const isActive  = i === activeIndex;
        const isGate    = "isGate" in step && step.isGate;
        const isPausedHere = status === "paused" && isActive && isGate;

        return (
          <div key={step.id} className="flex items-center min-w-0 flex-1">
            {/* Node */}
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div
                className={cn(
                  "relative flex items-center justify-center rounded transition-all duration-300",
                  isGate ? "w-6 h-6 rounded-sm rotate-45" : "w-5 h-5 rounded-full",
                  isDone    && "bg-emerald-500/20 border border-emerald-500/40",
                  isActive  && !isPausedHere && "bg-brand/25 border border-brand/60 shadow-[0_0_8px_hsl(262_80%_60%/0.35)]",
                  isPausedHere && "bg-amber-500/20 border border-amber-500/50 shadow-[0_0_8px_hsl(38_92%_50%/0.3)]",
                  !isDone && !isActive && "bg-surface-2 border border-border/60",
                )}
              >
                <span className={cn("transition-all duration-200", isGate && "-rotate-45")}>
                  {isDone ? (
                    <Check size={9} className="text-emerald-400" />
                  ) : isActive && !isPausedHere ? (
                    <Loader2 size={9} className="text-brand animate-spin" />
                  ) : isPausedHere ? (
                    <Pause size={8} className="text-amber-400" />
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30 block" />
                  )}
                </span>
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-[9px] font-medium tracking-wide uppercase truncate",
                  isDone        && "text-emerald-400/70",
                  isActive && !isPausedHere && "text-brand",
                  isPausedHere  && "text-amber-400",
                  !isDone && !isActive && "text-muted-foreground/40",
                )}
              >
                {step.short}
              </span>
            </div>

            {/* Connector */}
            {i < PIPELINE_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-full max-w-[20px] mx-0.5 transition-all duration-500",
                  i < activeIndex ? "bg-emerald-500/40" : "bg-border/50",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface StatPillProps {
  label: string;
  value: number;
  accent?: string;
}

function StatPill({ label, value, accent = "text-foreground" }: StatPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-surface-2 border border-border/60 min-w-0 flex-1">
      <span className={cn("font-mono text-2xl font-semibold tabular-nums leading-none", accent)}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────

interface AgentStatusWidgetProps {
  /** compact=true renders only the badge + run button for use in header bars */
  compact?: boolean;
}

export function AgentStatusWidget({ compact = false }: AgentStatusWidgetProps) {
  const queryClient = useQueryClient();
  const wsRef       = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [wsStatus,    setWsStatus]    = useState<AgentState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Polling fallback ──────────────────────────────────────────────────────
  const { data: polledStatus, isLoading } = useQuery<AgentState>({
    queryKey: ["agent-status"],
    queryFn:  () => api.get("/agent/status").then((r) => r.data),
    refetchInterval: wsConnected ? false : 5000,
  });

  // ── WebSocket connection ──────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) return;

    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
    } catch {
      return;
    }

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/api/v1/agent/ws/${userId}`;
    const ws    = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);

    ws.onclose = () => {
      setWsConnected(false);
      // Reconnect after 4 s
      reconnectTimer.current = setTimeout(connectWs, 4000);
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type as string;

        if (["status_update", "score_complete", "paused", "running"].includes(type)) {
          setWsStatus({
            status:                 data.status || (type === "paused" ? "paused" : "running"),
            current_step:           data.current_step || data.reason || null,
            jobs_scraped:           data.jobs_scraped ?? 0,
            jobs_scored:            data.jobs_scored ?? 0,
            applications_submitted: data.applications_submitted ?? 0,
          });
          queryClient.invalidateQueries({ queryKey: ["agent-status"] });
        }

        if (type === "complete" || type === "error") {
          setWsStatus((prev) =>
            prev
              ? { ...prev, status: type === "error" ? "failed" : "completed" }
              : null
          );
          queryClient.invalidateQueries({ queryKey: ["agent-status"] });
        }
      } catch {
        // ignore malformed frames
      }
    };
  }, [queryClient]);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectWs]);

  // ── Resolved state ────────────────────────────────────────────────────────
  const data   = wsStatus ?? polledStatus ?? null;
  const status = (data?.status ?? "idle") as AgentStatus;

  const isRunning   = status === "running";
  const isPaused    = status === "paused";
  const isIdle      = status === "idle" || status === "completed" || status === "failed";
  const activeIndex = getActiveIndex(data?.current_step ?? null, status);

  // ── Actions ───────────────────────────────────────────────────────────────
  const runAgent = async () => {
    setActionLoading(true);
    try {
      await api.post("/agent/run");
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    } finally {
      setActionLoading(false);
    }
  };

  const pauseAgent = async () => {
    setActionLoading(true);
    try {
      await api.post("/agent/pause");
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    } finally {
      setActionLoading(false);
    }
  };

  const approveBatch = async () => {
    setActionLoading(true);
    try {
      await api.post("/agent/approve");
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    } finally {
      setActionLoading(false);
    }
  };

  const rejectAll = async () => {
    setActionLoading(true);
    try {
      await api.post("/agent/reject");
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Compact mode (header bar) ─────────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
        {isIdle && (
          <button
            onClick={runAgent}
            disabled={actionLoading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
              "bg-brand text-white hover:bg-brand-dim transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {actionLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Zap size={11} />
            )}
            Run
          </button>
        )}
        {wsConnected && (
          <Wifi size={11} className="text-emerald-400/60" title="Live" />
        )}
      </div>
    );
  }

  // ── Full widget ───────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface p-5 flex flex-col gap-4 transition-all duration-500 animate-slide-up",
        isRunning && "shadow-brand-md border-brand/30",
        isPaused  && "shadow-[0_0_0_1px_hsl(38_92%_50%/0.25),0_8px_32px_hsl(38_92%_50%/0.08)] border-amber-500/25",
        isIdle    && "border-border",
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              isRunning && "bg-brand/20",
              isPaused  && "bg-amber-500/15",
              isIdle    && "bg-surface-2",
            )}
          >
            <Bot size={16} className={cn(
              isRunning && "text-brand",
              isPaused  && "text-amber-400",
              isIdle    && "text-muted-foreground",
            )} />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground tracking-tight">
              AI Agent
            </span>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Cpu size={9} />
              <span>LangGraph · Claude Sonnet</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wsConnected ? (
            <span
              title="Real-time connected"
              className="flex items-center gap-1 text-[10px] text-emerald-400/70"
            >
              <Wifi size={10} />
              <span className="hidden sm:inline">Live</span>
            </span>
          ) : (
            <span
              title="Polling fallback"
              className="flex items-center gap-1 text-[10px] text-muted-foreground/50"
            >
              <WifiOff size={10} />
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* ── Pipeline (running or paused) ── */}
      {(isRunning || isPaused) && (
        <div className="bg-surface-2 rounded-lg border border-border/60 px-4 py-3 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Pipeline
            </span>
            {isPaused && (
              <span className="text-[10px] text-amber-400 font-medium">
                Awaiting human approval
              </span>
            )}
            {isRunning && data?.current_step && (
              <span className="text-[10px] text-brand/80 font-mono truncate max-w-[140px]">
                {data.current_step}
              </span>
            )}
          </div>
          <PipelineTrack activeIndex={activeIndex} status={status} />
        </div>
      )}

      {/* ── Stats ── */}
      {isLoading && !data ? (
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton flex-1 h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 stagger">
          <StatPill
            label="Scraped"
            value={data?.jobs_scraped ?? 0}
            accent="text-brand"
          />
          <StatPill
            label="Scored"
            value={data?.jobs_scored ?? 0}
            accent="text-cyan-400"
          />
          <StatPill
            label="Applied"
            value={data?.applications_submitted ?? 0}
            accent="text-emerald-400"
          />
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-2 pt-1 border-t border-border/50">
        {isIdle && (
          <button
            onClick={runAgent}
            disabled={actionLoading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg",
              "bg-brand text-white text-sm font-medium",
              "hover:bg-brand-dim active:scale-[0.98] transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {actionLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} className="fill-white" />
            )}
            Run Agent
          </button>
        )}

        {isRunning && (
          <button
            onClick={pauseAgent}
            disabled={actionLoading}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg",
              "border border-border bg-surface-2 text-sm font-medium text-foreground",
              "hover:border-brand/40 hover:text-brand active:scale-[0.98] transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {actionLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Pause size={14} />
            )}
            Pause
          </button>
        )}

        {isPaused && (
          <>
            <button
              onClick={approveBatch}
              disabled={actionLoading}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg",
                "bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium",
                "active:scale-[0.98] transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {actionLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ThumbsUp size={14} />
              )}
              Approve Batch
            </button>
            <button
              onClick={rejectAll}
              disabled={actionLoading}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg",
                "bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 text-sm font-medium",
                "active:scale-[0.98] transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {actionLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ThumbsDown size={14} />
              )}
              Reject All
            </button>
          </>
        )}
      </div>
    </div>
  );
}
