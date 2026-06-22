import { Footer } from "@/components/Footer";

export const metadata = { title: "About — Hiremory" };

export default function About() {
  return (
    <>
      <main className="container-x py-16 md:py-24">
        <p className="eyebrow">About</p>
        <h1 className="mt-3 max-w-3xl text-4xl md:text-6xl">
          The job hunt rewards the second touch. We automate it.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink2">
          Hiremory started from a simple frustration: cold applications vanish into the void, and
          the reply almost always comes from the follow-up nobody sends. So we built a tool that
          writes each recruiter a real, personalized note, follows up when they go quiet, and shares
          your resume the moment they say yes — all from your own inbox.
        </p>

        <div className="mt-14 grid gap-7 md:grid-cols-3">
          {[
            ["Personal, not spammy", "Every email is written for the person and company. Volume without the mail-merge smell."],
            ["From your own inbox", "We send as you. Replies land where you already look, and your data stays yours."],
            ["Built to get replies", "Deliverability-first pacing, smart follow-ups, and honest tracking — not a blast cannon."],
          ].map(([h, p]) => (
            <div key={h} className="card">
              <h2 className="font-display text-2xl">{h}</h2>
              <p className="mt-2 text-ink2">{p}</p>
            </div>
          ))}
        </div>

        <div className="mt-16">
          <h2 className="text-2xl">Founder</h2>
          <div className="mt-5 card max-w-2xl">
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-clay font-display text-2xl text-paper">AB</span>
              <div>
                <div className="font-display text-2xl">Abhishek Banaj</div>
                <div className="text-ink2">Founder, Hiremory · Bengaluru, India</div>
              </div>
            </div>
            <p className="mt-5 text-ink2">
              Abhishek started Hiremory after living the job-hunt grind himself — watching good
              applications disappear and realizing the replies came from the follow-ups almost
              nobody sends. He builds the product end to end, from the personalization engine to
              the sending pipeline, with a bias for shipping things that genuinely help people get hired.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="https://www.linkedin.com/in/abhishekbanaj/" target="_blank" rel="noopener noreferrer" className="btn-ghost">LinkedIn</a>
              <a href="https://x.com/Abbby1206" target="_blank" rel="noopener noreferrer" className="btn-ghost">X / Twitter</a>
              <a href="https://github.com/AbhishekCbanaj" target="_blank" rel="noopener noreferrer" className="btn-ghost">GitHub</a>
            </div>
          </div>
          <a href="/careers" className="btn-primary mt-8">We&apos;re hiring →</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
