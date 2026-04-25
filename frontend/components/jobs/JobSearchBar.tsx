"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search,
  Loader2,
  ChevronDown,
  SlidersHorizontal,
  Play,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Constants ───────────────────────────────────────────────── */
const PRESETS = [
  { key: "internship",  label: "Internship" },
  { key: "entry_level", label: "Entry Level" },
  { key: "senior",      label: "Senior" },
  { key: "remote",      label: "Remote Only" },
  { key: "contract",    label: "Contract" },
  { key: "part_time",   label: "Part-time" },
] as const;

const SITES = [
  { key: "linkedin",     label: "LinkedIn" },
  { key: "indeed",       label: "Indeed" },
  { key: "glassdoor",    label: "Glassdoor" },
  { key: "zip_recruiter",label: "ZipRecruiter" },
  { key: "google",       label: "Google Jobs" },
] as const;

const STATUSES = ["pending_review", "approved", "rejected", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];

/* ── Props ───────────────────────────────────────────────────── */
interface JobSearchBarProps {
  /** Controlled text filter — passed up to page for client-side filtering */
  search: string;
  onSearchChange: (v: string) => void;
  /** Status filter (tab state lives in page but reflected here via prop) */
  statusFilter?: StatusFilter;
  /** Minimum score filter (0–100) */
  minScore: number;
  onMinScoreChange: (v: number) => void;
  /** Source filter */
  sourceFilter: string;
  onSourceFilterChange: (v: string) => void;
  /** Callback after a successful scrape so parent can refetch */
  onScraped?: () => void;
}

/* ── Mini checkbox ───────────────────────────────────────────── */
function Checkbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {checked ? (
        <CheckSquare size={13} className="text-brand" />
      ) : (
        <Square size={13} />
      )}
      {label}
    </button>
  );
}

/* ── JobSearchBar ────────────────────────────────────────────── */
export function JobSearchBar({
  search,
  onSearchChange,
  minScore,
  onMinScoreChange,
  sourceFilter,
  onSourceFilterChange,
  onScraped,
}: JobSearchBarProps) {
  const qc = useQueryClient();

  /* Filter panel toggle */
  const [showFilters, setShowFilters] = useState(false);

  /* Custom search form state */
  const [showCustom, setShowCustom] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [customLocation, setCustomLocation] = useState("Remote");
  const [customPreset, setCustomPreset] = useState<string | null>(null);
  const [customSites, setCustomSites] = useState<string[]>(["linkedin", "indeed"]);
  const [customResults, setCustomResults] = useState(20);

  const toggleSite = (site: string) =>
    setCustomSites((prev) =>
      prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site]
    );

  const scrape = useMutation({
    mutationFn: () =>
      api.post("/agent/run/custom", {
        search_query: customQuery || "software engineer",
        location: customLocation,
        sites: customSites,
        results_wanted: customResults,
        preset: customPreset || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      setShowCustom(false);
      onScraped?.();
    },
  });

  return (
    <div className="space-y-3">
      {/* ── Primary bar ──────────────────────────────────── */}
      <div className="flex gap-2 items-center">
        {/* Text search */}
        <div className="relative flex-1 min-w-0">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by title, company, location…"
            className={cn(
              "w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm",
              "text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40 transition"
            )}
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Source dropdown */}
        <div className="relative">
          <select
            value={sourceFilter}
            onChange={(e) => onSourceFilterChange(e.target.value)}
            className={cn(
              "appearance-none rounded-lg border border-border bg-surface px-3 pr-7 py-2 text-sm",
              "text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40",
              "cursor-pointer transition"
            )}
          >
            <option value="">All sources</option>
            {SITES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors",
            showFilters
              ? "border-brand/40 bg-brand/10 text-brand"
              : "border-border text-muted-foreground hover:text-foreground hover:border-brand/30"
          )}
        >
          <SlidersHorizontal size={13} />
          Filters
        </button>

        {/* Custom search trigger */}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
            showCustom
              ? "bg-brand-dim text-white"
              : "bg-brand hover:bg-brand-dim text-white"
          )}
        >
          <Play size={12} />
          Run Custom Search
        </button>
      </div>

      {/* ── Filter panel ─────────────────────────────────── */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 animate-slide-up">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-48">
              <label className="text-xs text-muted-foreground whitespace-nowrap w-20 shrink-0">
                Min score: <span className="text-foreground font-mono font-bold">{minScore}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minScore}
                onChange={(e) => onMinScoreChange(Number(e.target.value))}
                className="flex-1 accent-[hsl(var(--brand))]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Custom search form ────────────────────────────── */}
      {showCustom && (
        <div className="rounded-xl border border-brand/20 bg-surface shadow-brand-sm animate-slide-up p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-brand uppercase tracking-widest">
              Custom Scrape
            </p>
            <button
              onClick={() => setShowCustom(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          {/* Query + location */}
          <div className="flex gap-2">
            <input
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder='e.g. "React Developer"'
              className={cn(
                "flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
              )}
              onKeyDown={(e) => e.key === "Enter" && scrape.mutate()}
            />
            <input
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="Location"
              className={cn(
                "w-32 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
              )}
            />
          </div>

          {/* Preset chips */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-12 shrink-0">
              Preset
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setCustomPreset(customPreset === p.key ? null : p.key)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  customPreset === p.key
                    ? "bg-brand/15 border-brand/40 text-brand"
                    : "border-border text-muted-foreground hover:border-brand/30 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Sites */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-12 shrink-0">
              Sites
            </span>
            {SITES.map((s) => (
              <Checkbox
                key={s.key}
                checked={customSites.includes(s.key)}
                label={s.label}
                onChange={() => toggleSite(s.key)}
              />
            ))}
          </div>

          {/* Results count + submit */}
          <div className="flex items-center gap-4 pt-1 border-t border-border">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Results:{" "}
                <span className="text-foreground font-mono font-bold">{customResults}</span>
              </span>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={customResults}
                onChange={(e) => setCustomResults(Number(e.target.value))}
                className="flex-1 accent-[hsl(var(--brand))]"
              />
            </div>
            <button
              onClick={() => scrape.mutate()}
              disabled={scrape.isPending}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dim text-white text-sm font-semibold transition-colors disabled:opacity-60"
              )}
            >
              {scrape.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              {scrape.isPending ? "Launching…" : "Launch"}
            </button>
          </div>

          {scrape.isSuccess && (
            <p className="text-xs text-emerald-400">
              Scrape job queued. New listings will appear shortly.
            </p>
          )}
          {scrape.isError && (
            <p className="text-xs text-rose-400">
              Failed to start scrape — check the backend is running.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
