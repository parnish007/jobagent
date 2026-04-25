"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { TrendingUp, Target, Send, MessageSquare } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function scoreBucket(score: number): string {
  if (score < 50) return "<50";
  if (score < 65) return "50-65";
  if (score < 80) return "65-80";
  return "80+";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return fmtDate(d.toISOString());
  });
}

// ── chart theme ───────────────────────────────────────────────────────────────

const AXIS_STYLE = { fill: "hsl(230 10% 50%)", fontSize: 11, fontFamily: "var(--font-mono)" };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: "hsl(240 13% 7%)",
    border: "1px solid hsl(240 14% 16%)",
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "var(--font-mono)",
  },
  labelStyle: { color: "hsl(230 20% 92%)" },
  itemStyle: { color: "hsl(230 20% 70%)" },
};

const SCORE_COLORS: Record<string, string> = {
  "<50": "#f43f5e",
  "50-65": "#f59e0b",
  "65-80": "#38bdf8",
  "80+": "#a78bfa",
};

const SOURCE_COLORS = ["#a78bfa", "#38bdf8", "#34d399", "#f59e0b", "#f87171"];

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 card-hover animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-muted-foreground opacity-60">{icon}</span>
      </div>
      <p className="text-3xl font-bold font-mono text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── skeleton block ─────────────────────────────────────────────────────────────

function Skeleton({ h = "h-64" }: { h?: string }) {
  return <div className={`skeleton rounded-2xl ${h}`} />;
}

// ── custom tooltip for pie ────────────────────────────────────────────────────

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div
      style={TOOLTIP_STYLE.contentStyle}
      className="px-3 py-2 text-xs"
    >
      <p style={{ color: d.payload.fill }} className="font-medium">{d.name}</p>
      <p className="text-muted-foreground mt-0.5">
        <span className="font-mono text-foreground">{d.value}</span> applications
      </p>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs", "analytics"],
    queryFn: () => api.get("/jobs?limit=200").then((r) => r.data),
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["applications", "analytics"],
    queryFn: () => api.get("/applications").then((r) => r.data),
  });

  const isLoading = jobsLoading || appsLoading;

  // ── derived stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalScraped = jobs.length;
    const avgScore =
      jobs.length > 0
        ? Math.round(jobs.reduce((s: number, j: any) => s + (j.score ?? 0), 0) / jobs.length)
        : 0;
    const applied = applications.length;
    const applyRate = totalScraped > 0 ? Math.round((applied / totalScraped) * 100) : 0;
    const responded = applications.filter(
      (a: any) => a.status === "interview" || a.status === "offer" || a.status === "responded"
    ).length;
    const responseRate = applied > 0 ? Math.round((responded / applied) * 100) : 0;
    return { totalScraped, avgScore, applyRate, responseRate };
  }, [jobs, applications]);

  // ── 7-day scrape timeline ────────────────────────────────────────────────
  const timelineData = useMemo(() => {
    const days = last7Days();
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d] = 0));
    jobs.forEach((j: any) => {
      if (j.scraped_at || j.created_at) {
        const day = fmtDate(j.scraped_at ?? j.created_at);
        if (day in counts) counts[day]++;
      }
    });
    return days.map((d) => ({ date: d, jobs: counts[d] }));
  }, [jobs]);

  // ── score distribution ───────────────────────────────────────────────────
  const scoreDistData = useMemo(() => {
    const buckets: Record<string, number> = { "<50": 0, "50-65": 0, "65-80": 0, "80+": 0 };
    jobs.forEach((j: any) => {
      if (j.score != null) buckets[scoreBucket(j.score)]++;
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [jobs]);

  // ── source breakdown ─────────────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    applications.forEach((a: any) => {
      const src = a.source || a.site || "Unknown";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [applications]);

  // ── top companies ────────────────────────────────────────────────────────
  const companyData = useMemo(() => {
    const counts: Record<string, { applied: number; avg: number; scores: number[] }> = {};
    applications.forEach((a: any) => {
      const co = a.company || "Unknown";
      if (!counts[co]) counts[co] = { applied: 0, avg: 0, scores: [] };
      counts[co].applied++;
      if (a.score != null) counts[co].scores.push(a.score);
    });
    return Object.entries(counts)
      .map(([company, d]) => ({
        company,
        applied: d.applied,
        avgScore:
          d.scores.length > 0
            ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length)
            : null,
      }))
      .sort((a, b) => b.applied - a.applied)
      .slice(0, 10);
  }, [applications]);

  return (
    <div className="space-y-8">
      {/* ── header ── */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-foreground">
          Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your job search pipeline performance
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {isLoading ? (
          <>
            <Skeleton h="h-28" />
            <Skeleton h="h-28" />
            <Skeleton h="h-28" />
            <Skeleton h="h-28" />
          </>
        ) : (
          <>
            <KpiCard
              label="Total Scraped"
              value={stats.totalScraped}
              icon={<TrendingUp size={16} />}
              sub="jobs discovered"
            />
            <KpiCard
              label="Avg Score"
              value={`${stats.avgScore}/100`}
              icon={<Target size={16} />}
              sub="AI relevance score"
            />
            <KpiCard
              label="Apply Rate"
              value={`${stats.applyRate}%`}
              icon={<Send size={16} />}
              sub="scraped → applied"
            />
            <KpiCard
              label="Response Rate"
              value={`${stats.responseRate}%`}
              icon={<MessageSquare size={16} />}
              sub="applied → responded"
            />
          </>
        )}
      </div>

      {/* ── charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* area — scrape timeline */}
        <div className="rounded-2xl border border-border bg-surface p-6 card-hover animate-slide-up">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground">Jobs Scraped Over Time</h2>
            <p className="text-xs text-muted-foreground mt-0.5">7-day rolling count</p>
          </div>
          {isLoading ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(240 14% 16%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={AXIS_STYLE}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={AXIS_STYLE}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="jobs"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fill="url(#areaFill)"
                  dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#a78bfa" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* bar — score distribution */}
        <div className="rounded-2xl border border-border bg-surface p-6 card-hover animate-slide-up">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground">Score Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Jobs bucketed by AI relevance score</p>
          </div>
          {isLoading ? (
            <Skeleton />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={scoreDistData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(240 14% 16%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={AXIS_STYLE}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={AXIS_STYLE}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {scoreDistData.map((entry) => (
                    <Cell key={entry.name} fill={SCORE_COLORS[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* pie — applications by source */}
        <div className="rounded-2xl border border-border bg-surface p-6 card-hover animate-slide-up">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground">Applications by Source</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Where your applications come from</p>
          </div>
          {isLoading ? (
            <Skeleton />
          ) : sourceData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No application data yet
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {sourceData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-shrink-0 space-y-2 min-w-[120px]">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                    />
                    <span className="text-muted-foreground capitalize truncate">{s.name}</span>
                    <span className="font-mono text-foreground ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* table — top companies */}
        <div className="rounded-2xl border border-border bg-surface p-6 card-hover animate-slide-up">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground">Top Companies</h2>
            <p className="text-xs text-muted-foreground mt-0.5">By number of applications submitted</p>
          </div>
          {isLoading ? (
            <Skeleton />
          ) : companyData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No application data yet
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground font-medium pb-2 pr-4">Company</th>
                    <th className="text-right text-muted-foreground font-medium pb-2 pr-4">Applied</th>
                    <th className="text-right text-muted-foreground font-medium pb-2">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {companyData.map((row) => {
                    const scoreClass =
                      row.avgScore == null
                        ? "text-muted-foreground"
                        : row.avgScore >= 80
                        ? "score-high"
                        : row.avgScore >= 65
                        ? "score-mid"
                        : "score-low";
                    return (
                      <tr key={row.company} className="hover:bg-surface-2 transition-colors">
                        <td className="py-2 pr-4 font-medium text-foreground truncate max-w-[160px]">
                          {row.company}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-foreground">
                          {row.applied}
                        </td>
                        <td className={`py-2 text-right font-mono ${scoreClass}`}>
                          {row.avgScore != null ? row.avgScore : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
