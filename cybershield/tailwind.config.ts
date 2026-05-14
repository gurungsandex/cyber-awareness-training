import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0D1117",
        surface: "#161B22",
        elevated: "#1C2128",
        border: "#30363D",
        "text-primary": "#E6EDF3",
        "text-secondary": "#8B949E",
        "text-muted": "#484F58",
        accent: {
          DEFAULT: "#00B4D8",
          hover: "#0096B7",
          muted: "rgba(0,180,216,0.1)",
        },
        success: { DEFAULT: "#3FB950", muted: "rgba(63,185,80,0.1)" },
        warning: { DEFAULT: "#D29922", muted: "rgba(210,153,34,0.1)" },
        danger: { DEFAULT: "#F85149", muted: "rgba(248,81,73,0.1)" },
        brand: {
          50: "#eef4ff", 100: "#d9e6ff", 200: "#bcd2ff", 300: "#8eb3ff",
          400: "#5a8bff", 500: "#3766f5", 600: "#1f47e0", 700: "#1a37b4",
          800: "#1a3091", 900: "#1c2c74",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-sora)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: { card: "12px", modal: "16px" },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4)",
        modal: "0 20px 60px rgba(0,0,0,0.6)",
        glow: "0 0 20px rgba(0,180,216,0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideIn: { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
