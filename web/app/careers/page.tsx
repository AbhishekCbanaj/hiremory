import { Footer } from "@/components/Footer";

export const metadata = { title: "Careers — Hiremory" };

const ROLES = [
  {
    title: "Founding Full-Stack Engineer",
    type: "Full-time · Remote / Bengaluru",
    blurb: "Own features end-to-end across Next.js, Supabase, and our Python sending worker. You like shipping and talking to users.",
  },
  {
    title: "AI Engineer (LLM Applications)",
    type: "Full-time · Remote / Bengaluru",
    blurb: "Push the personalization engine — prompts, evals, provider routing, and cost. You've shipped real LLM features, not just demos.",
  },
  {
    title: "Growth / Founder's Associate",
    type: "Contract → Full-time",
    blurb: "Help job-seekers find us and succeed. Part content, part community, part scrappy experiments.",
  },
];

export default function Careers() {
  return (
    <>
      <main className="container-x py-16 md:py-24">
        <p className="eyebrow">Careers</p>
        <h1 className="mt-3 max-w-3xl text-4xl md:text-6xl">Help people get hired — for a living.</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink2">
          We&apos;re early and small, which means high ownership and fast shipping. If you care about
          craft and want your work in users&apos; hands this week, not next quarter, we should talk.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r.title} className="lift card">
              <span className="tag">{r.type}</span>
              <h2 className="mt-4 font-display text-2xl">{r.title}</h2>
              <p className="mt-2 text-ink2">{r.blurb}</p>
              <a
                href={`mailto:Hiremory@gmail.com?subject=${encodeURIComponent("Application — " + r.title)}`}
                className="btn-ghost mt-5"
              >
                Apply
              </a>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-xl2 border border-line bg-paper2 p-8">
          <h2 className="text-2xl">Don&apos;t see your role?</h2>
          <p className="mt-2 max-w-2xl text-ink2">
            We hire exceptional people ahead of openings. Tell us what you&apos;re great at and what
            you&apos;d want to build here.
          </p>
          <a href="mailto:Hiremory@gmail.com?subject=General%20application" className="btn-primary mt-5">
            Email Hiremory@gmail.com
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
