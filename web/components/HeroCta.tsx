"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Auth-aware landing CTAs. Signed-in visitors see "Go to dashboard" instead of
// "Sign up free", matching the nav. Defaults to the signed-out (marketing) view
// until auth state is known, to avoid a flash of the wrong button.
export function HeroCta({ variant = "hero" }: { variant?: "hero" | "cta" }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const primary = signedIn
    ? <Link href="/dashboard" className="btn-primary">Go to dashboard</Link>
    : <Link href="/signup" className="btn-primary">Sign up free</Link>;

  if (variant === "cta") {
    return <div className="mt-9 flex justify-center">{primary}</div>;
  }

  return (
    <>
      <div className="mt-9 flex flex-wrap items-center gap-4">
        {primary}
        <a href="#how" className="btn-ghost">See how it works</a>
      </div>
      {!signedIn && (
        <p className="mt-3 text-[13px] text-ink2">
          Free to start, no card required. Already have an account?{" "}
          <Link href="/login" className="text-clay hover:underline">Log in</Link>.
        </p>
      )}
    </>
  );
}
