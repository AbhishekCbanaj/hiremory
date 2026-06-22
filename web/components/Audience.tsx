// Animated marquee of the platforms our users source recruiters/HRs from.
// Honest framing: Hiremory doesn't "integrate" with these — it works alongside
// your job hunt across all of them (you bring the contacts, we do the outreach).

const ROW1 = ["LinkedIn", "Naukri", "Indeed", "Glassdoor", "Wellfound", "Instahyre", "Hirist", "Foundit"];
const ROW2 = ["Recruiting agencies", "Company career pages", "AngelList", "Cutshort", "Internshala", "Shine", "Referrals", "Job fairs"];

function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div
      className="flex w-max gap-3 animate-marquee motion-reduce:animate-none"
      style={reverse ? { animationDirection: "reverse" } : undefined}
    >
      {doubled.map((p, i) => (
        <span key={`${p}-${i}`} className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl2 border border-line bg-paper px-5 py-3 text-[15px] text-ink2 shadow-soft">
          <span className="h-2 w-2 rounded-full bg-clay/60" />
          {p}
        </span>
      ))}
    </div>
  );
}

export function Audience() {
  return (
    <section className="overflow-hidden border-y border-line bg-paper2 py-20">
      <div className="container-x text-center">
        <p className="eyebrow">Where your leads come from</p>
        <h2 className="mt-3 text-4xl md:text-5xl">Source from anywhere. We do the outreach.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-ink2">
          Found HRs on LinkedIn, Naukri, Indeed, or a recruiting-agency list? Paste them in — Hiremory
          writes a personalized email to each and sends from your own inbox. Built for job seekers,
          career switchers, and the agencies that place them.
        </p>
      </div>
      <div className="mt-12 flex flex-col gap-4">
        <div className="overflow-hidden"><Row items={ROW1} /></div>
        <div className="overflow-hidden"><Row items={ROW2} reverse /></div>
      </div>
    </section>
  );
}
