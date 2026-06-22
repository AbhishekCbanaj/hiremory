import Link from "next/link";
import { HeroCta } from "@/components/HeroCta";
import { Reveal } from "@/components/Reveal";
import { Hero3D } from "@/components/Hero3D";
import { Footer } from "@/components/Footer";
import { Proof } from "@/components/Proof";

export default function Landing() {
  return (
    <main className="overflow-clip">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="container-x relative pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="absolute right-[-8rem] top-10 -z-10 h-[28rem] w-[28rem] rounded-full bg-clay/10 blur-3xl animate-floaty" />
        <div className="absolute left-[-10rem] top-40 -z-10 h-[24rem] w-[24rem] rounded-full bg-amber/10 blur-3xl animate-floaty" style={{ animationDelay: "1.5s" }} />
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow animate-rise">For job seekers who hate the spray-and-pray</p>
            <h1 className="mt-5 text-5xl leading-[1.03] animate-rise md:text-6xl lg:text-7xl" style={{ animationDelay: "60ms" }}>
              Reach every recruiter with a
              <span className="grad-text"> letter</span>, not a blast.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink2 animate-rise md:text-xl" style={{ animationDelay: "140ms" }}>
              Hiremory sends each HR a personalized email, follows up when they go quiet,
              and shares your resume the moment they say yes. You write once; it works for weeks.
            </p>
            <div className="animate-rise" style={{ animationDelay: "220ms" }}>
              <HeroCta />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-ink2 animate-rise" style={{ animationDelay: "300ms" }}>
              <span className="tag">Sends from your own inbox</span>
              <span className="tag">Warms up &amp; paces to stay out of spam</span>
              <span className="tag">Auto follow-ups + auto-resume</span>
            </div>
          </div>
          {/* interactive 3D centerpiece */}
          <div className="relative h-[340px] animate-rise md:h-[460px]" style={{ animationDelay: "120ms" }}>
            <Hero3D />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- THE GAP */}
      <section className="border-y border-line bg-paper2">
        <div className="container-x grid gap-10 py-16 md:grid-cols-3">
          {[
            ["The old way", "Copy, paste, rename, attach, send. Repeat 800 times. Forget who you mailed. Never follow up."],
            ["The honest truth", "One cold email gets ignored. The reply comes from the second touch — which nobody ever sends."],
            ["The Hiremory way", "Upload once. It personalizes, paces, follows up, tracks replies, and sends your resume on a yes."],
          ].map(([h, p], i) => (
            <Reveal key={h} delay={i * 0.08}>
              <div className="font-display text-2xl">{h}</div>
              <p className="mt-3 text-ink2">{p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- HOW IT WORKS */}
      <section id="how" className="container-x py-24">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-2xl text-4xl md:text-5xl">Four steps. Then it runs itself.</h2>
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl2 border border-line bg-line md:grid-cols-2">
          {[
            ["01", "Create an account & connect your mailbox", "Sign up, then connect any provider (Gmail, Outlook, Zoho) with an app password. Hiremory sends from your real inbox, so replies land where you already look."],
            ["02", "Add recipients & resume", "Upload an HR list as CSV for bulk, or paste a handful of emails for a targeted batch. Drop in your resume."],
            ["03", "Review the one email", "We draft a personalized, recruiter-tested email. Tweak the wording once; every send is tailored to the person and company."],
            ["04", "Let the loop close", "It drips safely, nudges non-repliers after a few days, classifies replies, and auto-sends your resume when asked."],
          ].map(([n, h, p], i) => (
            <Reveal key={n} delay={i * 0.07} className="lift bg-paper2 p-8 md:p-10">
              <div className="font-display text-3xl text-clay">{n}</div>
              <h3 className="mt-3 text-2xl">{h}</h3>
              <p className="mt-2 text-ink2">{p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- TWO METHODS */}
      <section id="methods" className="border-y border-line bg-paper2 py-24">
        <div className="container-x">
          <p className="eyebrow">Two ways to send</p>
          <h2 className="mt-3 max-w-2xl text-4xl md:text-5xl">Bulk a thousand, or pick a precise ten.</h2>
          <div className="mt-12 grid gap-7 md:grid-cols-2">
            <div className="card">
              <span className="tag">Bulk mode</span>
              <h3 className="mt-4 text-2xl">Upload a list</h3>
              <p className="mt-2 text-ink2">
                Drop a CSV of HR contacts (PDF/Excel coming soon). Hiremory reads names,
                emails, titles and companies, removes junk and duplicate companies, and
                queues them for safe, paced sending over days or weeks.
              </p>
              <ul className="mt-5 space-y-2 text-[15px] text-ink2">
                <li>• Auto-detects columns, validates emails</li>
                <li>• Strips role-less inboxes (info@, hr@…) and dupes</li>
                <li>• Never emails the same person twice</li>
              </ul>
            </div>
            <div className="card">
              <span className="tag">Quick mode</span>
              <h3 className="mt-4 text-2xl">Paste a few emails</h3>
              <p className="mt-2 text-ink2">
                Found 10 great companies on LinkedIn this morning? Paste the emails into a
                box, separated by commas or new lines. Hiremory sends each a personalized
                note in seconds. No file, no setup.
              </p>
              <ul className="mt-5 space-y-2 text-[15px] text-ink2">
                <li>• 1 to ~30 emails at a time</li>
                <li>• Same personalization and tracking</li>
                <li>• Perfect for targeted, same-day outreach</li>
              </ul>
            </div>
          </div>
          <div className="mt-8">
            <Link href="/compose" className="btn-primary">Try the composer</Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- FEATURES */}
      <section className="container-x py-24">
        <div className="grid gap-12 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow">Why it lands</p>
            <h2 className="mt-3 text-4xl md:text-5xl">Built to get replies, not just hit send.</h2>
            <p className="mt-5 max-w-md text-lg text-ink2">
              Volume tools get you blocked. Hiremory is tuned for deliverability and
              the human on the other side: real personalization, gentle pacing, and a
              follow-up that does the heavy lifting.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["Personalized, every time", "Name, company, and role woven into each email. No mail-merge smell."],
              ["Smart follow-ups", "A polite nudge after a few days of silence, inside the same thread."],
              ["Auto-resume on a yes", "Detects “sure, send it” and replies with your role-matched resume."],
              ["Honest tracking", "Sent, replied, resume sent, bounced. Know exactly where you stand."],
            ].map(([h, p], i) => (
              <Reveal key={h} delay={i * 0.07} className="lift rounded-xl2 border border-line bg-paper2 p-6">
                <h3 className="text-lg">{h}</h3>
                <p className="mt-2 text-[15px] text-ink2">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Proof />

      {/* --------------------------------------------------------------- PRICING */}
      <section id="pricing" className="border-t border-line bg-paper2 py-24">
        <div className="container-x">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Start free. Upgrade when it works.</h2>
          <div className="mt-12 grid gap-7 md:grid-cols-3">
            {[
              ["Free", "₹0", "For your first real campaign.", ["50 emails / month", "1 resume", "Quick + bulk mode", "Basic tracking"], false],
              ["Pro", "₹499/mo", "For an active job hunt.", ["1,500 emails / month", "Role-matched resumes", "Auto follow-ups + auto-resume", "Full dashboard"], true],
              ["Teams", "Let's talk", "For placement cells & agencies.", ["Multiple senders", "Shared templates", "Analytics & exports", "Priority support"], false],
            ].map(([name, price, blurb, feats, hot]) => (
              <div key={name as string} className={`lift rounded-xl2 border p-8 ${hot ? "border-clay bg-paper2 shadow-glow" : "border-line bg-paper2"}`}>
                {hot ? <span className="tag !border-clay !bg-clay/10 !text-clay">Most popular</span> : <span className="text-[13px] text-ink2">{name}</span>}
                <div className="mt-4 font-display text-4xl">{price}</div>
                <p className="mt-1 text-ink2">{blurb}</p>
                <ul className="mt-5 space-y-2 text-[15px] text-ink2">
                  {(feats as string[]).map((f) => <li key={f}>• {f}</li>)}
                </ul>
                <Link href={name === "Teams" ? "mailto:Abhishekbanaj01@gmail.com" : "/signup"} className={`mt-7 w-full ${hot ? "btn-primary" : "btn-ghost"}`}>
                  {name === "Teams" ? "Contact us" : "Get started"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="container-x py-28 text-center">
        <h2 className="mx-auto max-w-3xl text-4xl md:text-6xl">
          Stop pasting. Start <span className="grad-text">hearing back</span>.
        </h2>
        <HeroCta variant="cta" />
      </section>

      <Footer />
    </main>
  );
}
