import Link from "next/link";

// Social-proof section. Hiremory is new, so instead of fabricating "10,000 emails
// sent" or fake quotes, this is honest: a real founder note + an open invitation
// for early users to become the first testimonials. Swap the placeholder cards
// for real quotes (name, role, photo) as users send them in.
const TESTIMONIALS: { quote: string; name: string; role: string }[] = [
  // e.g. { quote: "Landed 3 interviews in a week.", name: "…", role: "Frontend dev" }
];

export function Proof() {
  return (
    <section className="container-x py-24">
      <div className="text-center">
        <p className="eyebrow">Early days, honest start</p>
        <h2 className="mt-3 text-4xl md:text-5xl">No fake numbers. Just the <span className="grad-text">first ones in</span>.</h2>
        <p className="mx-auto mt-4 max-w-xl text-ink2">
          Hiremory is new. Rather than invent testimonials, we&apos;d rather earn yours —
          use it for your hunt, and if it lands you replies, tell us.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.length > 0
          ? TESTIMONIALS.map((t) => (
              <figure key={t.name} className="card">
                <blockquote className="text-lg text-ink">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-[14px] text-ink2">
                  <span className="font-semibold text-ink">{t.name}</span> · {t.role}
                </figcaption>
              </figure>
            ))
          : [
              "Your reply rate, in your words.",
              "How many interviews it opened.",
              "What you'd tell another job seeker.",
            ].map((hint) => (
              <div key={hint} className="rounded-xl2 border border-dashed border-line bg-paper2/60 p-7 text-center">
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-clay shadow-soft" aria-hidden>“”</div>
                <p className="mt-4 text-[15px] text-ink2">{hint}</p>
                <p className="mt-2 text-[12px] uppercase tracking-wide text-ink2">Your story here</p>
              </div>
            ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/signup" className="btn-primary">Be one of the first</Link>
      </div>
    </section>
  );
}
