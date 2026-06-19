import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#0B1020",     // near-black navy canvas
        paper2: "#141D33",    // raised panel / input surface
        ink: "#E8ECF5",       // soft white text
        ink2: "#93A1BF",      // muted text
        clay: "#6EE7F0",      // cyan accent (keeps the `clay` token name)
        clayDark: "#3FD3DE",
        sage: "#7CE7B0",      // positive / success mint
        line: "#26314B",      // subtle border
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        soft: "0 1px 1px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.35)",
        lift: "0 2px 4px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px rgba(110,231,240,0.25), 0 8px 30px rgba(110,231,240,0.35)",
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
        floaty: "floaty 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
