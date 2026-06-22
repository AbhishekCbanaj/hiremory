// A "logo wall" of the places our users source recruiters/HRs from — rendered as
// real app-icon tiles (brand-accurate SVGs for the big platforms, branded
// monograms for the job boards) scrolling behind a glass card. Honest framing:
// Hiremory doesn't "integrate" with these — you bring the contacts, we do the
// outreach. All marks are inline SVG/text (no external assets, crisp on retina).

type Brand =
  | { name: string; bg?: string; mono: string; fg: string }
  | { name: string; svg: "linkedin" | "github" | "google" };

const BRANDS: Brand[] = [
  { name: "LinkedIn", svg: "linkedin" },
  { name: "Naukri", mono: "n", fg: "#1B3FAA" },
  { name: "Indeed", mono: "i", fg: "#2164F3" },
  { name: "Glassdoor", mono: "g", fg: "#0CAA41" },
  { name: "Wellfound", mono: "w", fg: "#111111" },
  { name: "GitHub", svg: "github" },
  { name: "AngelList", mono: "a", fg: "#000000" },
  { name: "Instahyre", mono: "ih", fg: "#3F51B5" },
  { name: "Hirist", mono: "h", fg: "#0E8A7D" },
  { name: "Foundit", mono: "f", fg: "#6F2DBD" },
  { name: "Google", svg: "google" },
  { name: "Cutshort", mono: "c", fg: "#5D5FEF" },
  { name: "Internshala", mono: "is", fg: "#00A5EC" },
  { name: "Shine", mono: "s", fg: "#F7941E" },
  { name: "Monster", mono: "m", fg: "#6E46AE" },
  { name: "TimesJobs", mono: "tj", fg: "#E03A3C" },
];

function Glyph({ b }: { b: Brand }) {
  if ("svg" in b) {
    if (b.svg === "linkedin")
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    if (b.svg === "github")
      return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
          <path fill="#181717" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      );
    return (
      <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
        <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
        <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
      </svg>
    );
  }
  return (
    <span className="text-2xl font-bold lowercase tracking-tight" style={{ color: b.fg }}>
      {b.mono}
    </span>
  );
}

function Tile({ b }: { b: Brand }) {
  return (
    <div
      title={b.name}
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-line bg-white shadow-soft transition-transform duration-200 hover:-translate-y-1"
    >
      <Glyph b={b} />
    </div>
  );
}

function Row({ items, reverse }: { items: Brand[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div
        className="flex w-max gap-4 animate-marquee motion-reduce:animate-none"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {doubled.map((b, i) => (
          <Tile key={`${b.name}-${i}`} b={b} />
        ))}
      </div>
    </div>
  );
}

export function Audience() {
  const row1 = BRANDS.slice(0, 8);
  const row2 = BRANDS.slice(8);
  return (
    <section className="relative overflow-hidden border-y border-line py-24 bg-[linear-gradient(180deg,#EEF4F0,#F3F7F4)]">
      {/* logo wall */}
      <div className="absolute inset-0 flex flex-col justify-center gap-4">
        <Row items={row1} />
        <Row items={row2} reverse />
        <Row items={row2} />
        <Row items={row1} reverse />
      </div>
      {/* soft scrim — only dims directly behind the card so the tiles stay crisp at the edges */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(48%_60%_at_50%_50%,rgba(240,245,242,0.92),rgba(240,245,242,0.35)_60%,transparent_78%)]" />

      <div className="container-x relative">
        <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-white/80 p-8 text-center shadow-lift backdrop-blur-md md:p-12">
          <p className="eyebrow">Where your leads come from</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Source from anywhere. We do the outreach.</h2>
          <p className="mx-auto mt-4 max-w-xl text-ink2">
            Found HRs on LinkedIn, Naukri, Indeed, or a recruiting-agency list? Paste them in — Hiremory
            writes a personalized email to each and sends it from your own inbox. Built for job seekers,
            career switchers, and the agencies that place them.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="tag">No integrations to set up</span>
            <span className="tag">You bring the contacts</span>
            <span className="tag">We write + send each one</span>
          </div>
        </div>
      </div>
    </section>
  );
}
