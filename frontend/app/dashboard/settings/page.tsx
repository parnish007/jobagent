"use client";
import { useState, useEffect, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Save,
  Bot,
  Search,
  Cpu,
  Target,
  X,
  CheckCircle2,
  Settings2,
  Zap,
  ChevronRight,
} from "lucide-react";

// ── constants (unchanged from original) ──────────────────────────────────────

const LLM_OPTIONS = [
  {
    value: "claude",
    label: "Claude (Anthropic)",
    description: "claude-sonnet-4-6 — best quality, nuanced reasoning",
    badge: "Recommended",
    badgeCls: "bg-brand/15 border-brand/30 text-brand",
  },
  {
    value: "gemini",
    label: "Gemini (Google)",
    description: "gemini-2.0-flash — fast and cost-effective",
    badge: "Fast",
    badgeCls: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400",
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

// ── shared input style ────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand/40 focus:border-brand/50 outline-none transition";

// ── sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 space-y-5 card-hover animate-slide-up">
      <div className="flex items-start gap-3 pb-1 border-b border-border/60">
        <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function StyledInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      className={INPUT_CLS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-5 max-w-2xl">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton h-40 rounded-2xl" />
      ))}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get("/auth/profile").then((r) => r.data),
  });

  // ── state (identical to original) ────────────────────────────────────────
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [titles, setTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [skills, setSkills] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [threshold, setThreshold] = useState("85");
  const [dailyLimit, setDailyLimit] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocation, setSearchLocation] = useState("Remote");
  const [searchSites, setSearchSites] = useState<string[]>(["linkedin", "indeed"]);
  const [jobType, setJobType] = useState("");
  const [resultsWanted, setResultsWanted] = useState("20");
  const [llmProvider, setLlmProvider] = useState<"claude" | "gemini" | "">("claude");
  const [isDirty, setIsDirty] = useState(false);

  // ── populate from profile (identical logic) ───────────────────────────────
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
    setSearchSites(
      profile.default_search_sites?.length ? profile.default_search_sites : ["linkedin", "indeed"]
    );
    setJobType(profile.default_job_type || "");
    setResultsWanted(profile.default_results_wanted?.toString() || "20");
    setLlmProvider(profile.preferred_llm_provider || "claude");
    setIsDirty(false);
  }, [profile]);

  // mark dirty on any change
  const markDirty = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (value: T) => {
      setter(value);
      setIsDirty(true);
    };

  // ── save mutation (identical payload) ────────────────────────────────────
  const save = useMutation({
    mutationFn: () =>
      api.put("/auth/profile", {
        target_titles: targetRoles.length
          ? targetRoles
          : titles.split(",").map((s) => s.trim()).filter(Boolean),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setIsDirty(false);
    },
  });

  // ── chip helpers (identical logic) ───────────────────────────────────────
  const toggleSite = (site: string) => {
    setSearchSites((prev) =>
      prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site]
    );
    setIsDirty(true);
  };

  const addRole = (raw: string) => {
    const role = raw.trim();
    if (role && !targetRoles.includes(role)) {
      setTargetRoles((prev) => [...prev, role]);
      setIsDirty(true);
    }
    setRoleInput("");
  };

  const removeRole = (role: string) => {
    setTargetRoles((prev) => prev.filter((r) => r !== role));
    setIsDirty(true);
  };

  const onRoleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addRole(roleInput);
    }
    if (e.key === "Backspace" && !roleInput && targetRoles.length) {
      setTargetRoles((prev) => prev.slice(0, -1));
      setIsDirty(true);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-5 max-w-2xl pb-24">
      {/* ── header ── */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your job search preferences and automation
        </p>
      </div>

      {/* ── success toast ── */}
      {save.isSuccess && (
        <div className="animate-slide-up flex items-center gap-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 size={15} />
          Settings saved successfully
        </div>
      )}

      {/* ─────────────────────── Target Roles ─────────────────────── */}
      <SectionCard
        icon={<Target size={15} className="text-rose-400" />}
        title="Target Roles"
        subtitle="Roles used for relevance scoring and default search queries"
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono">
              Enter
            </kbd>{" "}
            or{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono">
              ,
            </kbd>{" "}
            after each role. Backspace removes the last chip.
          </p>

          {/* chip input */}
          <div
            className="flex flex-wrap gap-2 min-h-[44px] rounded-lg border border-border bg-surface-2 px-3 py-2 focus-within:ring-2 focus-within:ring-brand/40 focus-within:border-brand/50 cursor-text transition"
            onClick={() =>
              (document.getElementById("role-input") as HTMLInputElement)?.focus()
            }
          >
            {targetRoles.map((role) => (
              <span
                key={role}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-rose-500/12 border border-rose-500/25 text-rose-300"
              >
                {role}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRole(role);
                  }}
                  className="hover:text-rose-100 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              id="role-input"
              className="flex-1 min-w-[160px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              placeholder={
                targetRoles.length ? "Add another role…" : "e.g. Senior Backend Engineer, ML Engineer…"
              }
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={onRoleKeyDown}
              onBlur={() => roleInput.trim() && addRole(roleInput)}
            />
          </div>

          {targetRoles.length > 0 && (
            <p className="text-xs text-muted-foreground font-mono">
              {targetRoles.length} role{targetRoles.length !== 1 ? "s" : ""} targeted
            </p>
          )}
        </div>
      </SectionCard>

      {/* ─────────────────────── AI Model ─────────────────────────── */}
      <SectionCard
        icon={<Cpu size={15} className="text-brand" />}
        title="AI Model"
        subtitle="Choose the model for scoring and resume generation"
      >
        <div className="grid gap-3">
          {LLM_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                llmProvider === opt.value
                  ? "border-brand/50 bg-brand/5 shadow-[0_0_0_1px_hsl(var(--brand)/0.12)]"
                  : "border-border bg-surface-2/40 hover:border-border/80 hover:bg-surface-2"
              }`}
              onClick={() => { setLlmProvider(opt.value as "claude" | "gemini"); setIsDirty(true); }}
            >
              {/* custom radio */}
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  llmProvider === opt.value ? "border-brand" : "border-border"
                }`}
              >
                {llmProvider === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${opt.badgeCls}`}
                  >
                    {opt.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </SectionCard>

      {/* ─────────────────────── Default Search ───────────────────── */}
      <SectionCard
        icon={<Search size={15} className="text-blue-400" />}
        title="Default Job Search"
        subtitle='Used when you click "Run Agent" — always overridable'
      >
        <div className="space-y-4">
          <Field label="Default search query">
            <StyledInput
              value={searchQuery}
              onChange={markDirty(setSearchQuery)}
              placeholder="e.g. React Developer, Data Scientist"
            />
          </Field>

          <Field label="Default location">
            <StyledInput
              value={searchLocation}
              onChange={markDirty(setSearchLocation)}
              placeholder="Remote, New York, London"
            />
          </Field>

          <Field label="Default job type">
            <select
              className={INPUT_CLS}
              value={jobType}
              onChange={(e) => { setJobType(e.target.value); setIsDirty(true); }}
            >
              {JOB_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-surface">
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sources">
            <div className="flex flex-wrap gap-2 pt-0.5">
              {SITE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSite(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                    searchSites.includes(s)
                      ? "bg-blue-500/12 border-blue-500/40 text-blue-300"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label={`Results to fetch: ${resultsWanted}`}
            hint="More results = longer scrape time. 20–30 is a good balance."
          >
            <div className="relative pt-1">
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={resultsWanted}
                onChange={(e) => { setResultsWanted(e.target.value); setIsDirty(true); }}
                className="w-full h-1.5 rounded-full appearance-none bg-surface-2 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface accent-brand cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
                <span>5</span>
                <span>50</span>
              </div>
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* ─────────────────────── Job Preferences ──────────────────── */}
      <SectionCard
        icon={<Bot size={15} className="text-amber-400" />}
        title="Job Preferences"
        subtitle="Used by the AI to score and filter jobs for you"
      >
        <div className="space-y-4">
          <Field label="Preferred locations" hint="Comma-separated">
            <StyledInput
              value={locations}
              onChange={markDirty(setLocations)}
              placeholder="Remote, New York, London"
            />
          </Field>

          <Field label="Your skills" hint="Be comprehensive — used for scoring">
            <StyledInput
              value={skills}
              onChange={markDirty(setSkills)}
              placeholder="Python, React, PostgreSQL, AWS"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Min salary ($)">
              <StyledInput
                value={salaryMin}
                onChange={markDirty(setSalaryMin)}
                placeholder="80000"
                type="number"
              />
            </Field>
            <Field label="Max salary ($)">
              <StyledInput
                value={salaryMax}
                onChange={markDirty(setSalaryMax)}
                placeholder="200000"
                type="number"
              />
            </Field>
          </div>

          {/* remote checkbox */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => { setRemoteOnly((v) => !v); setIsDirty(true); }}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                remoteOnly
                  ? "bg-brand border-brand"
                  : "border-border bg-surface-2 group-hover:border-brand/50"
              }`}
            >
              {remoteOnly && (
                <svg
                  viewBox="0 0 10 8"
                  fill="none"
                  className="w-3 h-3"
                >
                  <path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div>
              <span className="text-sm text-foreground">Remote only</span>
              <p className="text-xs text-muted-foreground">Only score remote-eligible jobs highly</p>
            </div>
          </label>
        </div>
      </SectionCard>

      {/* ─────────────────────── Automation ───────────────────────── */}
      <SectionCard
        icon={<Zap size={15} className="text-amber-400" />}
        title="Automation"
        subtitle="Control when the agent acts automatically"
      >
        <div className="space-y-4">
          <Field
            label={`Auto-approve threshold: ${threshold}/100`}
            hint="Jobs scored above this are auto-approved for resume generation. Human review required before submission."
          >
            <div className="relative pt-1">
              <input
                type="range"
                min={50}
                max={100}
                value={threshold}
                onChange={(e) => { setThreshold(e.target.value); setIsDirty(true); }}
                className="w-full h-1.5 rounded-full appearance-none bg-surface-2 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface accent-brand cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
                <span>50</span>
                <span className="font-semibold text-brand">{threshold}</span>
                <span>100</span>
              </div>
            </div>
          </Field>

          <Field label="Daily application limit" hint="Maximum applications per day">
            <StyledInput
              value={dailyLimit}
              onChange={markDirty(setDailyLimit)}
              placeholder="10"
              type="number"
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── floating save button ── */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-brand text-white text-sm font-semibold shadow-lg shadow-brand/30 hover:bg-brand/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {save.isPending ? (
              <>
                <Settings2 size={15} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={15} />
                Save Changes
                <ChevronRight size={13} className="opacity-60" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
