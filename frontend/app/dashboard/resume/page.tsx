"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { Save, RefreshCw, ThumbsUp, ThumbsDown, Brain, CheckCircle2 } from "lucide-react";

export default function ResumePage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"base" | "rl">("base");
  const [content, setContent] = useState("");
  const [view, setView] = useState<"edit" | "preview">("edit");

  // Base resume
  const { data, isLoading } = useQuery({
    queryKey: ["resume"],
    queryFn: () => api.get("/resume").then((r) => r.data),
  });

  // RL status
  const { data: rlStatus } = useQuery({
    queryKey: ["rl-status"],
    queryFn: () => api.get("/resume/rl/status").then((r) => r.data),
    refetchInterval: 30000,
  });

  const save = useMutation({
    mutationFn: (text: string) => api.put("/resume", { content: text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resume"] }),
  });

  const trainDpo = useMutation({
    mutationFn: () => api.post("/resume/rl/train"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rl-status"] }),
  });

  const resumeText = content || data?.content || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resume</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your resume template and AI training</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "base", label: "Base Resume" },
          { key: "rl", label: "AI Training (RL)" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as "base" | "rl")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Base resume editor */}
      {activeTab === "base" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              This is your base resume. The AI uses it to generate tailored versions for each job.
              Write it in Markdown format.
            </p>
            <div className="flex gap-2">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
                onClick={() => setView(view === "edit" ? "preview" : "edit")}
              >
                <RefreshCw size={13} />
                {view === "edit" ? "Preview" : "Edit"}
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm transition-colors disabled:opacity-60"
                onClick={() => save.mutate(content || resumeText)}
                disabled={save.isPending}
              >
                <Save size={13} />
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 h-[calc(100vh-320px)]">
            <div className={view === "preview" ? "hidden md:block" : ""}>
              <textarea
                className="w-full h-full rounded-xl border border-border bg-card p-4 text-sm text-foreground font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder={`# Jane Smith\njane@example.com | linkedin.com/in/jane\n\n## Summary\nFull-stack developer with 4 years of experience...\n\n## Experience\n### Senior Engineer — Acme Corp (2022–present)\n- Built X which improved Y by Z%\n\n## Skills\nPython, React, PostgreSQL, AWS\n\n## Education\nB.Sc. Computer Science — MIT, 2020`}
                value={content || data?.content || ""}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className={`rounded-xl border border-border bg-card p-6 overflow-y-auto prose prose-invert prose-sm max-w-none ${view === "edit" ? "hidden md:block" : ""}`}>
              {resumeText ? (
                <ReactMarkdown>{resumeText}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground text-sm">No resume content yet. Start typing on the left.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RL Training tab */}
      {activeTab === "rl" && (
        <div className="space-y-6 max-w-2xl">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Brain size={20} className="text-violet-400" />
              <div>
                <h3 className="font-semibold">AI Resume Training</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The AI learns your preferences through DPO (Direct Preference Optimization).
                  Rate resumes as you use the system to improve future generations.
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Preference pairs collected</span>
                <span className="font-medium text-foreground">
                  {rlStatus?.preference_pairs_collected ?? 0} / {rlStatus?.min_pairs_for_training ?? 50}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-violet-500 h-2 rounded-full transition-all"
                  style={{ width: `${rlStatus?.progress_pct ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {rlStatus?.ready_to_train
                  ? "Ready to train! Click the button below to start DPO fine-tuning."
                  : `Need ${(rlStatus?.min_pairs_for_training ?? 50) - (rlStatus?.preference_pairs_collected ?? 0)} more ratings before training can begin.`}
              </p>
            </div>

            {/* Model status */}
            {rlStatus?.model_trained && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg p-3">
                <CheckCircle2 size={15} />
                Fine-tuned model active — resumes are being optimized using your preferences
              </div>
            )}

            {/* Train button */}
            {rlStatus?.ready_to_train && !rlStatus?.model_trained && (
              <button
                onClick={() => trainDpo.mutate()}
                disabled={trainDpo.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Brain size={14} />
                {trainDpo.isPending ? "Starting training…" : "Start DPO Training"}
              </button>
            )}
          </div>

          {/* How it works */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-sm">How AI Training Works</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              {[
                {
                  icon: <ThumbsUp size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />,
                  text: "When you approve a job and the resume is generated, the system records that you preferred it",
                },
                {
                  icon: <RefreshCw size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />,
                  text: "When you edit a generated resume, the edited version is recorded as preferred over the original",
                },
                {
                  icon: <ThumbsDown size={14} className="text-red-400 flex-shrink-0 mt-0.5" />,
                  text: "You can explicitly rate resumes on job-specific pages to provide direct feedback",
                },
                {
                  icon: <Brain size={14} className="text-violet-400 flex-shrink-0 mt-0.5" />,
                  text: "After 50+ preference signals, DPO fine-tuning trains the AI to generate resumes more like your preferred ones",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  {item.icon}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
