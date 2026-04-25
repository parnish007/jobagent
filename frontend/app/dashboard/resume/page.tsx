"use client";
import { useState, useRef, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import {
  Save,
  Copy,
  RefreshCw,
  Upload,
  FileText,
  X,
  Sparkles,
  Eye,
  Code2,
  Brain,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  LayoutTemplate,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

interface ResumeVersion {
  id: string;
  version_number: number;
  job_title?: string;
  company?: string;
  score?: number;
  content?: string;
  created_at?: string;
}

interface RlStatus {
  preference_pairs_collected: number;
  min_pairs_for_training: number;
  progress_pct: number;
  ready_to_train: boolean;
  model_trained: boolean;
}

// ── score chip ────────────────────────────────────────────────────────────────

function ScoreChip({ score }: { score?: number }) {
  if (score == null) return null;
  const cls =
    score >= 80 ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-400" :
    score >= 65 ? "bg-amber-500/12 border-amber-500/30 text-amber-400" :
                  "bg-rose-500/12 border-rose-500/30 text-rose-400";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold ${cls}`}>
      {score}
    </span>
  );
}

// ── toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({
  onClick,
  disabled,
  active,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
        active
          ? "bg-brand/20 border border-brand/40 text-brand"
          : "bg-surface-2 border border-border text-muted-foreground hover:text-foreground hover:border-brand/30"
      }`}
    >
      {children}
    </button>
  );
}

// ── left panel skeleton ───────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-2 px-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton h-16 rounded-xl" />
      ))}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ResumePage() {
  const qc = useQueryClient();

  const [selected, setSelected] = useState<ResumeVersion | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── queries ──────────────────────────────────────────────────────────────
  const { data: baseResume, isLoading: baseLoading } = useQuery({
    queryKey: ["resume"],
    queryFn: () => api.get("/resume").then((r) => r.data),
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery<ResumeVersion[]>({
    queryKey: ["resume-versions"],
    queryFn: () => api.get("/api/v1/resume/versions").then((r) => r.data),
  });

  const { data: rlStatus } = useQuery<RlStatus>({
    queryKey: ["rl-status"],
    queryFn: () => api.get("/resume/rl/status").then((r) => r.data),
    refetchInterval: 30_000,
  });

  // ── mutations ─────────────────────────────────────────────────────────────
  const uploadBase = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/api/v1/resume/upload?save=true", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as { content: string; filename: string };
    },
    onSuccess: (data) => {
      setUploadedFile(data.filename);
      setEditContent(data.content);
      qc.invalidateQueries({ queryKey: ["resume"] });
      qc.invalidateQueries({ queryKey: ["resume-versions"] });
    },
  });

  const saveContent = useMutation({
    mutationFn: (text: string) => {
      if (selected?.id) {
        return api.put(`/api/v1/resume/${selected.id}/content`, { content: text });
      }
      return api.put("/resume", { content: text });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resume"] });
      qc.invalidateQueries({ queryKey: ["resume-versions"] });
    },
  });

  const trainDpo = useMutation({
    mutationFn: () => api.post("/resume/rl/train"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rl-status"] }),
  });

  // ── handlers ─────────────────────────────────────────────────────────────
  const handleSelect = (v: ResumeVersion) => {
    setSelected(v);
    setEditContent(v.content ?? "");
    setViewMode("edit");
  };

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadBase.mutate(file);
  };

  const handleCopy = async () => {
    const text = editContent || (selected?.content ?? baseResume?.content ?? "");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeText = editContent || (selected?.content ?? baseResume?.content ?? "");

  // group versions by company/job
  const grouped = versions.reduce<Record<string, ResumeVersion[]>>((acc, v) => {
    const key = [v.company, v.job_title].filter(Boolean).join(" — ") || "Base Resume";
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {});

  const rlPairs = rlStatus?.preference_pairs_collected ?? 0;
  const rlTarget = rlStatus?.min_pairs_for_training ?? 50;
  const rlPct = Math.min(100, rlStatus?.progress_pct ?? 0);

  return (
    <div className="flex h-[calc(100vh-112px)] gap-0 overflow-hidden rounded-2xl border border-border bg-surface">
      {/* ═══════════════════════ LEFT PANEL ═══════════════════════ */}
      <div className="w-[40%] flex-shrink-0 flex flex-col border-r border-border overflow-hidden">
        {/* panel header */}
        <div className="px-4 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-semibold text-foreground">Resume Versions</h1>
            <span className="text-xs font-mono text-muted-foreground">{versions.length}</span>
          </div>

          {/* upload button */}
          <div
            className={`relative rounded-xl border-2 border-dashed transition-colors ${
              dragOver ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadBase.mutate(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadBase.isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {uploadBase.isPending ? (
                <RefreshCw size={12} className="animate-spin text-brand" />
              ) : (
                <Upload size={12} />
              )}
              {uploadBase.isPending ? "Extracting…" : "Upload Base Resume"}
            </button>
            {uploadedFile && !uploadBase.isPending && (
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <FileText size={9} />
                {uploadedFile}
                <button onClick={() => setUploadedFile(null)}>
                  <X size={9} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RL training bar */}
        {rlStatus && (
          <div className="px-4 py-3 border-b border-border flex-shrink-0 bg-surface-2/40">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
              <span className="flex items-center gap-1">
                <Brain size={10} className="text-brand" />
                RL Training
              </span>
              <span className="font-mono">
                {rlPairs}/{rlTarget} pairs
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${rlPct}%` }}
              />
            </div>
            {rlStatus.model_trained && (
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 size={9} /> Fine-tuned model active
              </p>
            )}
            {rlStatus.ready_to_train && !rlStatus.model_trained && (
              <button
                onClick={() => trainDpo.mutate()}
                disabled={trainDpo.isPending}
                className="mt-1.5 w-full text-[10px] text-center text-brand hover:text-foreground transition-colors disabled:opacity-50"
              >
                {trainDpo.isPending ? "Starting…" : "Start DPO Training →"}
              </button>
            )}
          </div>
        )}

        {/* version list */}
        <div className="flex-1 overflow-y-auto py-3">
          {versionsLoading || baseLoading ? (
            <ListSkeleton />
          ) : (
            <>
              {/* base resume entry */}
              {baseResume?.content && (
                <div className="px-3 mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-1 mb-1">
                    Base
                  </p>
                  <button
                    onClick={() =>
                      handleSelect({ id: "base", version_number: 0, content: baseResume.content })
                    }
                    className={`w-full text-left rounded-xl px-3 py-3 border transition-colors ${
                      selected?.id === "base"
                        ? "border-l-2 border-l-brand border-brand/30 bg-brand/5"
                        : "border-border bg-surface-2/50 hover:border-brand/20 hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutTemplate size={13} className="text-brand flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">Base Resume</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-5">
                      Master template used for all generations
                    </p>
                  </button>
                </div>
              )}

              {/* grouped versions */}
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="px-3 mb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-1 mb-1 truncate">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {items.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleSelect(v)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                          selected?.id === v.id
                            ? "border-l-2 border-l-brand border-brand/30 bg-brand/5"
                            : "border-border bg-surface-2/50 hover:border-brand/20 hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground truncate">
                            {v.job_title || "Resume"}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <ScoreChip score={v.score} />
                            <span className="text-[10px] font-mono text-muted-foreground bg-surface px-1.5 py-0.5 rounded border border-border">
                              v{v.version_number}
                            </span>
                          </div>
                        </div>
                        {v.company && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {v.company}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {versions.length === 0 && !baseResume?.content && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center px-4">
                  <FileText size={24} className="mb-2 opacity-30" />
                  <p className="text-xs">Upload a base resume to get started</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════ RIGHT PANEL ══════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground truncate max-w-[240px]">
                  {selected.job_title
                    ? `${selected.job_title}${selected.company ? ` — ${selected.company}` : ""}`
                    : "Base Resume"}
                </span>
                {selected.version_number > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                    v{selected.version_number}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ToolBtn
                  onClick={() => setViewMode("edit")}
                  active={viewMode === "edit"}
                  title="Edit markdown"
                >
                  <Code2 size={12} />
                  Edit
                </ToolBtn>
                <ToolBtn
                  onClick={() => setViewMode("preview")}
                  active={viewMode === "preview"}
                  title="Preview rendered"
                >
                  <Eye size={12} />
                  Preview
                </ToolBtn>
                <div className="w-px h-5 bg-border mx-1" />
                <ToolBtn onClick={handleCopy}>
                  {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </ToolBtn>
                <ToolBtn
                  onClick={() => saveContent.mutate(activeText)}
                  disabled={saveContent.isPending}
                >
                  {saveContent.isPending ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  {saveContent.isPending ? "Saving…" : "Save"}
                </ToolBtn>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand/20 border border-brand/40 text-brand hover:bg-brand/30 transition-colors">
                  <Sparkles size={12} />
                  Generate New
                </button>
              </div>
            </div>

            {/* editor / preview */}
            <div className="flex-1 overflow-hidden">
              {viewMode === "edit" ? (
                <textarea
                  className="w-full h-full resize-none bg-transparent px-5 py-4 text-sm font-mono text-foreground focus:outline-none placeholder:text-muted-foreground/50 leading-relaxed"
                  value={editContent || selected.content || ""}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="# Your Name&#10;your@email.com&#10;&#10;## Summary&#10;..."
                  spellCheck={false}
                />
              ) : (
                <div className="h-full overflow-y-auto px-8 py-6 prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-base prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-brand">
                  {activeText ? (
                    <ReactMarkdown>{activeText}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground text-sm">No content yet. Switch to Edit to start writing.</p>
                  )}
                </div>
              )}
            </div>

            {/* status bar */}
            {saveContent.isSuccess && (
              <div className="px-5 py-2 border-t border-border flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/5 flex-shrink-0">
                <CheckCircle2 size={11} />
                Saved successfully
              </div>
            )}
          </>
        ) : (
          /* placeholder */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl border border-border bg-surface-2 flex items-center justify-center mb-4">
              <FileText size={28} className="opacity-30" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Select a resume version to view and edit
            </p>
            <p className="text-xs opacity-70 max-w-[280px]">
              Choose a version from the left panel, or upload a base resume to get started.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs opacity-50">
              <div className="flex items-center gap-2">
                <ThumbsUp size={12} className="text-emerald-400" />
                Rate generated resumes to train AI
              </div>
              <div className="flex items-center gap-2">
                <ThumbsDown size={12} className="text-rose-400" />
                Edits auto-record as preferences
              </div>
              <div className="flex items-center gap-2">
                <Brain size={12} className="text-brand" />
                DPO trains after 50 preference pairs
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-amber-400" />
                Generate tailored versions per job
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
