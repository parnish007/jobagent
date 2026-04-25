import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-syne)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        surface:     "hsl(var(--surface))",
        "surface-2": "hsl(var(--surface-2))",
        brand: {
          DEFAULT: "hsl(var(--brand))",
          dim:     "hsl(var(--brand-dim))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg:  "var(--radius)",
        md:  "calc(var(--radius) - 2px)",
        sm:  "calc(var(--radius) - 4px)",
        xl:  "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        "brand-sm": "0 0 0 1px hsl(var(--brand) / 0.15), 0 4px 16px hsl(var(--brand) / 0.08)",
        "brand-md": "0 0 0 1px hsl(var(--brand) / 0.25), 0 8px 32px hsl(var(--brand) / 0.12)",
        "brand-lg": "0 0 0 1px hsl(var(--brand) / 0.35), 0 16px 48px hsl(var(--brand) / 0.16)",
        "inset-brand": "inset 0 1px 0 hsl(var(--brand) / 0.2)",
      },
      animation: {
        "slide-up":       "slide-up 0.35s ease both",
        "slide-in-right": "slide-in-right 0.3s ease both",
        "fade-in":        "fade-in 0.25s ease both",
        "pulse-dot":      "pulse-dot 1.8s ease-in-out infinite",
        shimmer:          "shimmer 1.8s ease-in-out infinite",
      },
      keyframes: {
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.5", transform: "scale(0.85)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to:   { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
