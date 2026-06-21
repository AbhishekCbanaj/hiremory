"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/compose", label: "Compose" },
  { href: "/analytics", label: "Analytics" },
  { href: "/replies", label: "Replies" },
  { href: "/mailbox", label: "Mailbox" },
  { href: "/onboarding", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

const MARKETING_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#methods", label: "Two ways to send" },
  { href: "/#pricing", label: "Pricing" },
];

export function Nav() {
  const path = usePathname();
  const onApp = APP_LINKS.some((l) => path.startsWith(l.href));
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session?.user),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { setOpen(false); }, [path]); // close the menu on navigation

  const links = onApp ? APP_LINKS : MARKETING_LINKS;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-clay text-paper font-display text-lg">H</span>
          <span className="font-display text-xl tracking-tight">Hiremory</span>
        </Link>

        {/* desktop nav */}
        {onApp ? (
          <nav className="hidden items-center gap-1 md:flex">
            {APP_LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
                  path.startsWith(l.href) ? "bg-ink text-paper" : "text-ink2 hover:text-ink"}`}>
                {l.label}
              </Link>
            ))}
          </nav>
        ) : (
          <nav className="hidden items-center gap-7 text-[15px] text-ink2 md:flex">
            {MARKETING_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="link-grow hover:text-ink">{l.label}</a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {/* desktop auth action */}
          <div className="hidden md:flex md:items-center md:gap-3">
            {signedIn ? (
              <>
                {!onApp && <Link href="/dashboard" className="btn-ghost !py-2 !px-5">Go to dashboard</Link>}
                <form action="/auth/signout" method="post">
                  <button type="submit" className="btn-ghost !py-2 !px-5">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost !py-2 !px-5">Log in</Link>
                <Link href="/signup" className="btn-primary !py-2 !px-5">Sign up</Link>
              </>
            )}
          </div>

          {/* mobile hamburger */}
          <button type="button" aria-label="Menu" aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink md:hidden">
            <span className="text-xl leading-none">{open ? "✕" : "≡"}</span>
          </button>
        </div>
      </div>

      {/* mobile panel */}
      {open && (
        <nav className="border-t border-line bg-paper px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={`rounded-lg px-3 py-3 text-[15px] ${
                  onApp && path.startsWith(l.href) ? "bg-paper2 text-ink" : "text-ink2"}`}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            {signedIn ? (
              <form action="/auth/signout" method="post">
                <button type="submit" className="btn-ghost w-full !py-3">Sign out</button>
              </form>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/signup" className="btn-primary block w-full text-center !py-3">Sign up</Link>
                <Link href="/login" className="btn-ghost block w-full text-center !py-3">Log in</Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
