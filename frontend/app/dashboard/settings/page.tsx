"use client";
import { useState, useEffect, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Save, Bot, Search, Cpu, Target, X } from "lucide-react";

const LLM_OPTIONS = [
  {
    value: "claude",
    label: "Claude (Anthropic)",
    description: "claude-sonnet-4-6 — best quality, nuanced reasoning",
    badge: "Recommended",
  },
  {
    value: "gemini",
    label: "Gemini (Google)",
    description: "gemini-2.0-flash — fast and cost-effective",
    badge: "Fast",
  },
];

const JOB_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "contract", label: "Contract" },
  { value: "remote", label: "Remote" },
];

const SITE_OPTIONS = ["linkedin", "indeed", "glassdoor", "zip_recruiter", "google"];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get("/auth/profile").then((r) => r.data),
  });

  // Target roles (chip-based)
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");

  // Job preferences
  const [titles, setTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [skills, setSkills] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [threshold, setThreshold] = useState("85");
  const [dailyLimit, setDailyLimit] = useState("10");

  // Search defaults
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("Remote");
  const [searchSites, setSearchSites] = useState<string[]>(["linkedin", "indeed"]);
  const [jobType, setJobType] = useState("");
  const [resultsWanted, setResultsWanted] = useState("20");

  // LLM provider
  const [llmProvider, setLlmProvider] = useState<"claude" | "gemini" | "">("claude");

  // Populate from loaded profile
  useEffect(() => {
    if (!profile) return;
    setTargetRoles(profile.target_titles || []);
    setTitles((profile.target_titles || []).join(", "));
    setLocations((profile.target_locations || []).join(", "));
    setSkills((profile.skills || []).join(", "));
    setSalaryMin(profile.salary_min?.toString() || "");
    setSalaryMax(profile.salary_max?.toString() || "");
    setRemoteOnly(profile.remote_only || false);
    setThreshold(profile.auto_approve_score_threshold?.toString() || "85");
    setDailyLimit(profile.daily_application_limit?.toString() || "10");
    setSearchQuery(profile.default_search_query || "");
    setSearchLocation(profile.default_search_location || "Remote");
    setSearchSites(profile.default_search_sites?.length ? profile.default_search_sites : ["linkedin", "indeed"]);
    setJobType(profile.default_job_type || "");
    setResultsWanted(profile.default_results_wanted?.toString() || "20");
    setLlmProvider(profile.preferred_llm_provider || "claude");
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      api.put("/auth/profile", {
        target_titles: targetRoles.length ? targetRoles : titles.split(",").map((s) => s.trim()).filter(Boolean),
        target_locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        salary_min: salaryMin ? parseInt(salaryMin) : null,
        salary_max: salaryMax ? parseInt(salaryMax) : null,
        remote_only: remoteOnly,
        auto_approve_score_threshold: parseInt(threshold),
        daily_application_limit: parseInt(dailyLimit),
        preferred_llm_provider: llmProvider || null,
        default_search_query: searchQuery || null,
        default_search_location: searchLocation || null,
        default_search_sites: searchSites,
        default_job_type: jobType || null,
        default_results_wanted: parseInt(resultsWanted),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const toggleSite = (site: string) => {
    setSearchSites((prev) =>
      prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site]
    );
  };

  const addRole = (raw: string) => {
    const role = raw.trim();
    if (role && !targetRoles.includes(role)) setTargetRoles((prev) => [...prev, role]);
    setRoleInput("");
  };

  const removeRole = (role: string) => setTargetRoles((prev) => prev.filter((r) => r !== role));

  const onRoleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addRole(roleInput); }
    if (e.key === "Backspace" && !roleInput && targetRoles.length) {
      setTargetRoles((prev) => prev.slice(0, -1));
    }
  };

  const section = (title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <h2 className="text-base font-semibold flex items-center gap-2">{icon}{title}</h2>
      {children}
    </div>
  );

  const field = (label: string, children: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  const input = (value: string, onChange: (v: string) => void, placeholder?: string, type = "text") => (
    <input
      type={type}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );

  if (isLoading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-card animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your job search preferences</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          <Save size={14} />
          {save.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {save.isSuccess && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-400">
          ✓ Settings saved successfully
        </div>
      )}

      {/* Target Roles */}
      {section("Target Roles", <Target size={16} className="text-rose-400" />,
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Specify the exact roles you&apos;re targeting. The AI uses these for scoring relevance and for the default search.
            Press <kbd className="px-1 py-0.5 rounded bg-secondary text-xs">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-secondary text-xs">,</kbd> after each role.
          </p>
          {/* Chip input */}
          <div className="flex flex-wrap gap-2 min-h-[42px] rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500/40 cursor-text"
            onClick={() => (document.getElementById("role-input") as HTMLInputElement)?.focus()}>
            {targetRoles.map((role) => (
              <span key={role} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300">
                {role}
                <button type="button" onClick={(e) => { e.stopPropagation(); removeRole(role); }} className="hover:text-rose-100">
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              id="role-input"
              className="flex-1 min-w-[160px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder={targetRoles.length ? "Add another role…" : "e.g. Senior Backend Engineer, ML Engineer…"}
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={onRoleKeyDown}
              onBlur={() => roleInput.trim() && addRole(roleInput)}
            />
          </div>
          {targetRoles.length > 0 && (
            <p className="text-xs text-muted-foreground">{targetRoles.length} role{targetRoles.length !== 1 ? "s" : ""} targeted</p>
          )}
        </div>
      )}

      {/* AI Model */}
      {section("AI Model", <Cpu size={16} className="text-violet-400" />,
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Choose which AI model scores your jobs and generates your tailored resumes.
            Both providers produce excellent results — Claude tends to be more nuanced, Gemini is faster.
          </p>
          <div className="grid gap-3">
            {LLM_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  llmProvider === opt.value
                    ? "border-violet-500/50 bg-violet-500/5"
                    : "border-border hover:border-border/80"
                }`}
              >
                <input
                  type="radio"
                  name="llm_provider"
                  value={opt.value}
                  checked={llmProvider === opt.value}
                  onChange={() => setLlmProvider(opt.value as "claude" | "gemini")}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Default search */}
      {section("Default Job Search", <Search size={16} className="text-blue-400" />,
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Used when you click <strong>Run Agent</strong> from the sidebar. You can always override in the search bar.
          </p>
          {field("Default search query", input(searchQuery, setSearchQuery, "e.g. React Developer, Data Scientist"))}
          {field("Default location", input(searchLocation, setSearchLocation, "Remote, New York, London"))}
          {field("Default job type",
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            >
              {JOB_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Sources</label>
            <div className="flex flex-wrap gap-2">
              {SITE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSite(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                    searchSites.includes(s)
                      ? "bg-blue-600/15 border-blue-500/50 text-blue-300"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          {field(`Results to fetch: ${resultsWanted}`,
            <input
              type="range" min={5} max={50} step={5} value={resultsWanted}
              onChange={(e) => setResultsWanted(e.target.value)} className="w-full"
            />,
            "More results = longer scrape time. 20-30 is usually a good balance."
          )}
        </div>
      )}

      {/* Job preferences */}
      {section("Job Preferences", <Bot size={16} className="text-amber-400" />,
        <div className="space-y-4">
          {field("Preferred locations", input(locations, setLocations, "Remote, New York, London"), "Comma-separated")}
          {field("Your skills", input(skills, setSkills, "Python, React, PostgreSQL"), "Used for scoring — be comprehensive")}
          <div className="grid grid-cols-2 gap-4">
            {field("Min salary ($)", input(salaryMin, setSalaryMin, "80000", "number"))}
            {field("Max salary ($)", input(salaryMax, setSalaryMax, "200000", "number"))}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
            />
            <div>
              <span className="text-sm text-foreground">Remote only</span>
              <p className="text-xs text-muted-foreground">Only score remote jobs highly</p>
            </div>
          </label>
        </div>
      )}

      {/* Automation */}
      {section("Automation",
        <span className="text-base">⚙️</span>,
        <div className="space-y-4">
          {field(
            `Auto-approve threshold: ${threshold}/100`,
            <input type="range" min={50} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full" />,
            "Jobs scored above this are auto-approved for resume generation. Requires human review before submission."
          )}
          {field("Daily application limit", input(dailyLimit, setDailyLimit, "10", "number"), "Maximum applications per day")}
        </div>
      )}
    </div>
  );
}
