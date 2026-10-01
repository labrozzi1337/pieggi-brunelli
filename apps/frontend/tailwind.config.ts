import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Oxanium", "system-ui", "sans-serif"],
        display: ["Oxanium", "system-ui", "sans-serif"]
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", glow: "hsl(var(--primary-glow))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        destructive: "hsl(var(--destructive))",
        hub: {
          blue: "hsl(var(--hub-blue))",
          "blue-soft": "hsl(var(--hub-blue-soft))",
          amber: "hsl(var(--hub-amber))",
          emerald: "hsl(var(--hub-emerald))",
          indigo: "hsl(var(--hub-indigo))",
          rose: "hsl(var(--hub-rose))"
        }
      },
      borderRadius: { sm: "4px", md: "5px", lg: "5px", xl: "5px", "2xl": "6px", "3xl": "8px" },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } }
      },
      animation: { "fade-in": "fade-in 300ms ease-out" },
      transitionTimingFunction: { hub: "cubic-bezier(0.32, 0.72, 0, 1)" }
    }
  },
  plugins: []
} satisfies Config;

