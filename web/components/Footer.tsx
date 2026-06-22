import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Two ways to send", href: "/#methods" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Compose", href: "/compose" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-paper2">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-clay text-paper font-display text-lg">H</span>
              <span className="font-display text-xl tracking-tight">Hiremory</span>
            </Link>
            <p className="mt-4 max-w-xs text-[14px] text-ink2">
              Reach every recruiter with a personalized letter, not a blast. Sends from your own
              inbox — your data stays yours.
            </p>
            <p className="mt-4 text-[13px] text-ink2">Bengaluru, India</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink2">{col.title}</div>
              <ul className="mt-4 space-y-2.5 text-[15px]">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="link-grow text-ink2 hover:text-ink">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-[13px] text-ink2 md:flex-row">
          <span>© {year} Hiremory. All rights reserved.</span>
          <span className="flex items-center gap-4">
            <a href="mailto:hello@hiremory.com" className="link-grow hover:text-ink">hello@hiremory.com</a>
            <Link href="/privacy" className="link-grow hover:text-ink">Privacy</Link>
            <Link href="/terms" className="link-grow hover:text-ink">Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
