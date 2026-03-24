"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { key: "internship",  label: "Internship",   emoji: "🎓" },
  { key: "entry_level", label: "Entry Level",  emoji: "🌱" },
  { key: "senior",      label: "Senior",       emoji: "⚡" },
  { key: "remote",      label: "Remote Only",  emoji: "🌍" },
  { key: "contract",    label: "Contract",     emoji: "📋" },
  { key: "part_time",   label: "Part-time",    emoji: "🕐" },
] as const;

const SITES = ["linkedin", "indeed", "glassdoor", "zip_recruiter"] as const;

interface JobSearchBarProps {
  onScraped?: () => void;
}

export function JobSearchBar({ onScraped }: JobSearchBarProps) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Remote");
  const [preset, setPreset] = useState<string | null>(null);
  const [sites, setSites] = useState<string[]>(["linkedin", "indeed"]);
  const [results, setResults] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const scrape = useMutation({
    mutationFn: () =>
      api.post("/jobs/scrape", {
        search_query: query || "software engineer",
        location,
        sites,
        results_wanted: results,
        preset: preset || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onScraped?.();
    },
  });

  const toggleSite = (site: string) => {
    setSites((prev) =>
      prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site]
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Search row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            placeholder='Job title (e.g. "React Developer", "Data Scientist")'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scrape.mutate()}
          />
        </div>
        <input
          className="w-36 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <button
          onClick={() => scrape.mutate()}
          disabled={scrape.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          {scrape.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {scrape.isPending ? "Scraping…" : "Search"}
        </button>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center mr-1">Quick:</span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(preset === p.key ? null : p.key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              preset === p.key
                ? "bg-violet-600/15 border-violet-500/50 text-violet-300"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {p.emoji} {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs px-2 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Advanced
          <ChevronDown size={11} className={cn("transition-transform", showAdvanced && "rotate-180")} />
        </button>
      </div>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center w-14">Sources:</span>
            {SITES.map((s) => (
              <button
                key={s}
                onClick={() => toggleSite(s)}
                className={cn(
                  "text-xs px-3 py-1 rounded-full border capitalize transition-colors",
                  sites.includes(s)
                    ? "bg-blue-600/15 border-blue-500/50 text-blue-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-14">Results:</span>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={results}
              onChange={(e) => setResults(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-foreground w-8 text-right">{results}</span>
          </div>
        </div>
      )}

      {scrape.isSuccess && (
        <p className="text-xs text-emerald-400">
          ✓ Scrape job submitted. New listings will appear shortly.
        </p>
      )}
      {scrape.isError && (
        <p className="text-xs text-red-400">
          Failed to start scrape. Check that the backend is running.
        </p>
      )}
    </div>
  );
}
