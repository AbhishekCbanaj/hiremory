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

        <div className="mt-14 max-w-2xl">
          <h2 className="text-2xl">Who's behind it</h2>
          <p className="mt-3 text-ink2">
            Hiremory is a small, early team building from Bengaluru, India. We care about craft,
            honesty, and shipping things that actually help people get hired.
          </p>
          <a href="/careers" className="btn-primary mt-6">We&apos;re hiring →</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
