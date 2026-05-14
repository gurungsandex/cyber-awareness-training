import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#EFECE6",
        surface: "#FFFFFF",
        elevated: "#F7F5F1",
        border: "#E3DDD5",
        "sidebar-bg": "#1E3228",
        "sidebar-active": "#2C4A37",
        "sidebar-border": "rgba(255,255,255,0.08)",
        "text-primary": "#1A1917",
        "text-secondary": "#5C5954",
        "text-muted": "#9C9890",
        "text-sidebar": "#CBD5CC",
        "text-sidebar-active": "#FFFFFF",
        accent: {
          DEFAULT: "#2E5E3E",
          hover: "#254E34",
          muted: "rgba(46,94,62,0.08)",
        },
        success: { DEFAULT: "#2D7A3C", muted: "rgba(45,122,60,0.1)" },
        warning: { DEFAULT: "#B45309", muted: "rgba(180,83,9,0.1)" },
        danger: { DEFAULT: "#C0392B", muted: "rgba(192,57,43,0.1)" },
        brand: {
          50: "#f0f7f2", 100: "#d6ead9", 200: "#aed4b6", 300: "#7ab98a",
          400: "#4d9e63", 500: "#2e5e3e", 600: "#254e34", 700: "#1d3e2a",
          800: "#162e1f", 900: "#0e1e14",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-sora)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      borderRadius: { card: "10px", modal: "14px" },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        modal: "0 20px 60px rgba(0,0,0,0.15)",
        glow: "0 0 20px rgba(46,94,62,0.12)",
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
