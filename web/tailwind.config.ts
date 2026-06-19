import type { Config } from "tailwindcss";

// "Momentum" — clean light theme, emerald brand (growth / get-hired), amber spark.
// Token names kept (paper / ink / clay / sage / line) so every page re-skins.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",     // canvas
        paper2: "#F3F7F4",    // raised panel / input fill (faint green-gray)
        ink: "#111813",       // near-black, green undertone
        ink2: "#5B6B62",      // muted text
        clay: "#047857",      // emerald-700 — accent (text, buttons, eyebrow). AA on white.
        clayDark: "#065F46",  // hover
        sage: "#059669",      // brighter emerald — success / positive ticks
        amber: "#D97706",     // warm secondary spark
        line: "#E4E9E6",      // hairline borders
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(17,24,19,0.05), 0 6px 20px rgba(17,24,19,0.06)",
        lift: "0 2px 4px rgba(17,24,19,0.06), 0 20px 44px rgba(17,24,19,0.10)",
        glow: "0 0 0 1px rgba(4,120,87,0.18), 0 8px 24px rgba(4,120,87,0.22)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        rise: "rise 0.7s cubic-bezier(0.16,1,0.3,1) both",
        floaty: "floaty 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
