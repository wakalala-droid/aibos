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
      colors: {
        // AI-BOS Design System
        bg: {
          base: "#03060d",
          surface1: "#090d1e",
          surface2: "#0d1530",
        },
        accent: {
          blue: "#3b82f6",
          cyan: "#06b6d4",
        },
        status: {
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#60a5fa",
        },
        text: {
          primary: "#e2eeff",
          secondary: "#d4ddf0",
          muted: "#4a6285",
          faint: "#2d4a70",
        },
      },
      fontFamily: {
        sans: ["Geist", "sans-serif"],
        outfit: ["Geist", "sans-serif"],
        mono: ["Geist", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        btn: "11px",
        pill: "9999px",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #60a5fa 0%, #06b6d4 100%)",
        "gradient-primary-hover": "linear-gradient(135deg, #3b82f6 0%, #0891b2 100%)",
        "glow-blue": "radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)",
        "glow-cyan": "radial-gradient(ellipse at center, rgba(6,182,212,0.15) 0%, transparent 70%)",
      },
      animation: {
        "gradient-shift": "gradientShift 12s ease infinite",
        "float-up": "floatUp 0.6s ease-out forwards",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "spin-slow": "spin 3s linear infinite",
        "count-up": "countUp 1s ease-out forwards",
        "particle-float": "particleFloat 20s linear infinite",
        "shake": "shake 0.5s ease-out",
      },
      keyframes: {
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        particleFloat: {
          "0%": { transform: "translateY(100vh) translateX(0px)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(-100px) translateX(50px)", opacity: "0" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-8px)" },
          "40%": { transform: "translateX(8px)" },
          "60%": { transform: "translateX(-6px)" },
          "80%": { transform: "translateX(6px)" },
        },
      },
      boxShadow: {
        "card": "0 0 0 1px rgba(99,179,237,0.12), 0 8px 32px rgba(0,0,0,0.4)",
        "card-hover": "0 0 0 1px rgba(99,179,237,0.35), 0 12px 40px rgba(0,0,0,0.5)",
        "glow-blue": "0 0 32px rgba(59,130,246,0.3)",
        "glow-cyan": "0 0 32px rgba(6,182,212,0.3)",
        "button-glow": "0 4px 24px rgba(96,165,250,0.4)",
        "inset-top": "inset 0 1px 0 rgba(99,179,237,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
