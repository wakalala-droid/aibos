import type { Config } from "tailwindcss";

// AI-BOS design tokens live in ONE place: app/globals.css (:root / [data-theme]).
// Tailwind references those CSS variables, so utilities and hand-written CSS can
// never diverge (audit F-01). Do not add raw hex values here.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page:          "var(--bg-page)",
        card:          "var(--bg-card)",
        "card-hover":  "var(--bg-card-hover)",
        sidebar:       "var(--bg-sidebar)",
        input:         "var(--bg-input)",
        badge:         "var(--bg-badge)",
        line:          "var(--border)",
        "line-md":     "var(--border-md)",
        "line-strong": "var(--border-strong)",
        ink: {
          1: "var(--text-1)",
          2: "var(--text-2)",
          3: "var(--text-3)",
          4: "var(--text-4)",
        },
        accent: "var(--cyan)",
        e1:     "var(--e1)",
        e2:     "var(--e2)",
        e3:     "var(--e3)",
        good:   "var(--good)",
        warn:   "var(--warn)",
        crit:   "var(--crit)",
        info:   "var(--info)",
      },
      fontFamily: {
        // Geist is the one AI-BOS typeface — every text, every number.
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist", "system-ui", "sans-serif"],
      },
      fontSize: {
        label:   ["var(--fs-label)",   { lineHeight: "1rem" }],
        data:    ["var(--fs-data)",    { lineHeight: "1.125rem" }],
        body:    ["var(--fs-body)",    { lineHeight: "1.25rem" }],
        h3:      ["var(--fs-h3)",      { lineHeight: "1.5rem" }],
        h2:      ["var(--fs-h2)",      { lineHeight: "1.75rem" }],
        h1:      ["var(--fs-h1)",      { lineHeight: "2.25rem" }],
        display: ["var(--fs-display)", { lineHeight: "2.5rem" }],
      },
      borderRadius: {
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        card: "var(--radius-card)",
        lg:   "var(--radius-lg)",
        pill: "9999px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop:  "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
