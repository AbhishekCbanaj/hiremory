import { Footer } from "@/components/Footer";

export const metadata = { title: "Contact — Hiremory" };

const CHANNELS = [
  { label: "General & support", email: "Abhishekbanaj01@gmail.com" },
  { label: "Careers", email: "Abhishekbanaj01@gmail.com" },
  { label: "Sales / teams", email: "Abhishekbanaj01@gmail.com" },
];

export default function Contact() {
  return (
    <>
      <main className="container-x py-16 md:py-24">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 max-w-3xl text-4xl md:text-6xl">Talk to us.</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink2">
          Questions, feedback, partnerships, or trouble with a send — we read everything and usually
          reply within one business day.
        </p>

        <div className="mt-12 grid gap-7 lg:grid-cols-[1.3fr_1fr]">
          <div className="grid gap-5 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <div key={c.email} className="lift card">
                <div className="text-[12px] uppercase tracking-wide text-ink2">{c.label}</div>
                <a href={`mailto:${c.email}`} className="link-grow mt-2 block break-all text-[15px] text-clay">
                  {c.email}
                </a>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="text-2xl">Where we are</h2>
            <p className="mt-3 text-ink2">
              Hiremory<br />
              Bengaluru, Karnataka<br />
              India
            </p>
            <p className="mt-4 text-[14px] text-ink2">Remote-first. Hours: Mon–Fri, 10:00–19:00 IST.</p>
            <a href="mailto:Abhishekbanaj01@gmail.com" className="btn-primary mt-6">Email us</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
