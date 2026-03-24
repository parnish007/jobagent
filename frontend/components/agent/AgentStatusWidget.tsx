"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bot, Circle, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentStatus {
  status: string;
  current_step: string | null;
  jobs_scraped: number;
  jobs_scored: number;
  applications_submitted: number;
}

export function AgentStatusWidget() {
  const [wsStatus, setWsStatus] = useState<AgentStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fallback polling when WebSocket is not connected
  const { data: polledStatus } = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => api.get("/agent/status").then((r) => r.data),
    refetchInterval: wsConnected ? false : 5000, // Poll only if WS not connected
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) return;

    // Decode user ID from JWT (base64 decode the payload)
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
    } catch {
      return;
    }

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/api/v1/agent/ws/${userId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status_update" || data.type === "score_complete" || data.type === "paused") {
          setWsStatus({
            status: data.status || (data.type === "paused" ? "paused" : "running"),
            current_step: data.current_step || data.reason || null,
            jobs_scraped: data.jobs_scraped ?? 0,
            jobs_scored: data.jobs_scored ?? 0,
            applications_submitted: data.applications_submitted ?? 0,
          });
        }
        if (data.type === "complete" || data.type === "error") {
          setWsStatus((prev) => prev ? {
            ...prev,
            status: data.type === "error" ? "failed" : "completed",
          } : null);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const data = wsStatus || polledStatus;
  const status = data?.status || "idle";
  const isActive = status === "running";
  const isPaused = status === "paused";
  const isFailed = status === "failed";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Bot size={14} />
      <span className="hidden sm:inline">Agent:</span>
      <span
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full font-medium",
          isActive  && "bg-emerald-500/10 text-emerald-400",
          isPaused  && "bg-amber-500/10 text-amber-400",
          isFailed  && "bg-red-500/10 text-red-400",
          !isActive && !isPaused && !isFailed && "bg-secondary text-muted-foreground"
        )}
      >
        <Circle size={6} className={cn("fill-current", isActive && "animate-pulse")} />
        {isActive
          ? `Running · ${data?.current_step || "…"}`
          : isPaused
          ? `Paused · ${data?.current_step || "awaiting review"}`
          : isFailed
          ? "Failed"
          : "Idle"}
      </span>
      {data?.jobs_scraped > 0 && (
        <span className="hidden lg:inline text-muted-foreground/60">
          {data.jobs_scraped} scraped · {data.jobs_scored} scored · {data.applications_submitted} applied
        </span>
      )}
      {wsConnected && (
        <Wifi size={10} className="text-emerald-400/50" title="Real-time updates connected" />
      )}
    </div>
  );
}
