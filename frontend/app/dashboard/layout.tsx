import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusWidget } from "@/components/agent/AgentStatusWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
          <div />
          <AgentStatusWidget />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
