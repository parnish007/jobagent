"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

export default function AnalyticsPage() {
  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.get("/applications").then((r) => r.data),
  });

  const statusCounts = applications.reduce((acc: Record<string, number>, a: any) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your job search performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Applications by Status</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusData}>
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="value" fill="hsl(var(--brand, 262 80% 60%))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Total Applications", value: applications.length },
              { label: "Interviews", value: statusCounts["interview"] || 0 },
              { label: "Offers", value: statusCounts["offer"] || 0 },
              { label: "Interview Rate", value: applications.length ? `${Math.round(((statusCounts["interview"] || 0) / applications.length) * 100)}%` : "—" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
