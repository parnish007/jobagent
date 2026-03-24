import { create } from "zustand";

// ─── Auth Store ──────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
  setToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) localStorage.setItem("access_token", token);
      else localStorage.removeItem("access_token");
    }
    set({ token });
  },
  logout: () => {
    if (typeof window !== "undefined") localStorage.removeItem("access_token");
    set({ token: null });
    window.location.href = "/login";
  },
}));

// ─── Agent Store ─────────────────────────────────────────────────────────────

interface AgentStatus {
  status: "idle" | "running" | "paused" | "completed" | "failed";
  current_step: string | null;
  jobs_scraped: number;
  jobs_scored: number;
  applications_submitted: number;
}

interface AgentState {
  agentStatus: AgentStatus;
  setAgentStatus: (status: AgentStatus) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agentStatus: {
    status: "idle",
    current_step: null,
    jobs_scraped: 0,
    jobs_scored: 0,
    applications_submitted: 0,
  },
  setAgentStatus: (agentStatus) => set({ agentStatus }),
}));

// ─── Job Detail Store ─────────────────────────────────────────────────────────

interface JobDetailState {
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
}

export const useJobDetailStore = create<JobDetailState>((set) => ({
  selectedJobId: null,
  setSelectedJobId: (selectedJobId) => set({ selectedJobId }),
}));
