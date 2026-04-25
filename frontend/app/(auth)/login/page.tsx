"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Decorative feature bullets ──────────────────────────────────────────── */
const FEATURES = [
  "Scrapes 50+ jobs across LinkedIn, Indeed & more",
  "AI scores every job against your profile",
  "Auto-generates tailored resumes",
] as const;

/* ─── Input field ─────────────────────────────────────────────────────────── */
interface FieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[12px] font-medium uppercase tracking-widest text-muted-foreground select-none"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required
        className={cn(
          "w-full rounded-md border border-border bg-surface px-3 py-2.5",
          "text-sm text-foreground placeholder:text-muted-foreground/50",
          "transition-colors duration-150",
          "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      />
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router  = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("access_token", data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.detail ??
          "Invalid email or password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════════
          LEFT PANEL — decorative, hidden below lg
      ═══════════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 relative overflow-hidden border-r border-border"
        style={{
          background:
            "linear-gradient(160deg, hsl(var(--surface)) 0%, hsl(var(--background)) 60%)",
        }}
      >
        {/* Background glow orb */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 w-[320px] h-[320px] rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)",
          }}
        />

        {/* ── Top: monogram + tagline ── */}
        <div className="relative z-10 animate-slide-up">
          {/* Large monogram */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-brand-md"
            style={{ background: "hsl(var(--brand))" }}
          >
            <span className="font-sans font-bold text-white text-2xl tracking-tight select-none">
              JA
            </span>
          </div>

          <h1 className="font-sans font-bold text-4xl leading-tight mb-3">
            <span className="text-gradient">Precision</span>
            <br />
            <span className="text-foreground">job hunting.</span>
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-xs">
            AI agents that source, score, and tailor applications — while you
            stay in control.
          </p>
        </div>

        {/* ── Feature list ── */}
        <ul className="relative z-10 space-y-4 stagger">
          {FEATURES.map((feat) => (
            <li
              key={feat}
              className="flex items-start gap-3 animate-slide-up"
            >
              {/* Violet dot with subtle glow */}
              <span
                className="mt-[5px] w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: "hsl(var(--brand))",
                  boxShadow: "0 0 6px hsl(var(--brand) / 0.7)",
                }}
              />
              <span className="text-sm text-foreground/80 leading-relaxed">
                {feat}
              </span>
            </li>
          ))}
        </ul>

        {/* ── Bottom stat strip ── */}
        <div
          className="relative z-10 border border-border rounded-lg px-5 py-3 animate-fade-in"
          style={{ background: "hsl(var(--surface-2))" }}
        >
          <p className="font-mono text-[11px] text-muted-foreground tracking-wide">
            50+ jobs per run
            <span className="mx-2 text-border">·</span>
            4 AI agents
            <span className="mx-2 text-border">·</span>
            2 approval gates
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT PANEL — login form
      ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px] animate-slide-up">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(var(--brand))" }}
            >
              <span className="font-sans font-bold text-white text-sm select-none">JA</span>
            </div>
            <span className="font-sans font-bold text-foreground text-lg">Job Agent</span>
          </div>

          {/* Card */}
          <div
            className="rounded-xl border border-border p-8 space-y-6 card-hover"
            style={{ background: "hsl(var(--surface))" }}
          >
            {/* Heading */}
            <div className="space-y-1">
              <h2 className="font-sans font-bold text-2xl text-foreground tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to your command center
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
              />

              <Field
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />

              {/* Error alert */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-3 animate-slide-up"
                >
                  <AlertCircle
                    size={15}
                    className="text-destructive flex-shrink-0 mt-[1px]"
                  />
                  <p className="text-sm text-destructive leading-snug">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full flex items-center justify-center gap-2",
                  "rounded-md py-2.5 text-sm font-semibold text-white",
                  "transition-all duration-150",
                  "bg-brand hover:bg-brand-dim active:scale-[0.99]",
                  "disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none",
                  "shadow-brand-sm"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Register link */}
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-brand hover:text-brand-dim font-medium transition-colors duration-100"
              >
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
