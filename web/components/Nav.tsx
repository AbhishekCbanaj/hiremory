"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Item = { href: string; label: string };
const MENUS: { label: string; items: Item[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/analytics", label: "Analytics" },
      { href: "/replies", label: "Replies" },
    ],
  },
  {
    label: "Features",
    items: [
      { href: "/compose", label: "Quick Paste" },
      { href: "/compose", label: "Bulk Upload" },
      { href: "/resume-analytics", label: "Resume Analytics" },
      { href: "/mailbox", label: "Mailbox" },
    ],
  },
];

export function Nav() {
  const path = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/65 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgba(255,255,255,0.6),0_8px_30px_rgba(17,24,19,0.05)]">
      <div className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-sage to-clayDark text-paper font-display text-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_8px_rgba(4,120,87,0.35)]">H</span>
          <span className="font-display text-xl tracking-tight">Hiremory</span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {MENUS.map((m) => (
            <Dropdown key={m.label} label={m.label} items={m.items} />
          ))}
          <a href="/#pricing" className="rounded-full px-4 py-2 text-[15px] text-ink2 hover:text-ink">Pricing</a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex md:items-center md:gap-3">
            {signedIn ? (
              <Dropdown
                label="Profile"
                items={[{ href: "/onboarding", label: "Edit profile" }, { href: "/billing", label: "Billing" }, { href: "/settings", label: "Settings" }]}
                footer={
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-[14px] text-ink2 hover:bg-paper2 hover:text-ink">Sign out</button>
                  </form>
                }
              />
            ) : (
              <>
                <Link href="/login" className="btn-ghost !py-2 !px-5">Log in</Link>
                <Link href="/signup" className="btn-primary !py-2 !px-5">Sign up</Link>
              </>
            )}
          </div>

          <button type="button" aria-label="Menu" aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink md:hidden">
            <span className="text-xl leading-none">{open ? "✕" : "≡"}</span>
          </button>
        </div>
      </div>

      {/* mobile panel */}
      {open && (
        <nav className="max-h-[80vh] overflow-y-auto border-t border-white/40 bg-white/80 backdrop-blur-xl px-6 py-4 md:hidden">
          {MENUS.map((m) => (
            <div key={m.label} className="mb-3">
              <div className="px-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink2">{m.label}</div>
              <div className="mt-1 flex flex-col">
                {m.items.map((l) => (
                  <Link key={l.label} href={l.href} className="rounded-lg px-3 py-2.5 text-[15px] text-ink2 hover:text-ink">{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
          <a href="/#pricing" className="block rounded-lg px-3 py-2.5 text-[15px] text-ink2">Pricing</a>

          <div className="mt-3 border-t border-line pt-4">
            {signedIn ? (
              <div className="flex flex-col gap-2">
                <Link href="/onboarding" className="btn-ghost block w-full text-center !py-3">Edit profile</Link>
                <Link href="/settings" className="btn-ghost block w-full text-center !py-3">Settings</Link>
                <form action="/auth/signout" method="post"><button type="submit" className="btn-ghost w-full !py-3">Sign out</button></form>
              </div>
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

// Hover dropdown for desktop.
function Dropdown({ label, items, footer }: { label: string; items: Item[]; footer?: React.ReactNode }) {
  return (
    <div className="group relative">
      <button className="flex items-center gap-1 rounded-full px-4 py-2 text-[15px] text-ink2 group-hover:text-ink">
        {label}
        <span className="text-[10px]">▾</span>
      </button>
      <div className="invisible absolute right-0 top-full min-w-[180px] pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
        <div className="glass rounded-xl2 p-2">
          {items.map((l) => (
            <Link key={l.label} href={l.href} className="block rounded-lg px-3 py-2 text-[14px] text-ink2 hover:bg-paper2 hover:text-ink">{l.label}</Link>
          ))}
          {footer && <div className="mt-1 border-t border-line pt-1">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
