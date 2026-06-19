"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    // If email confirmation is off, a session is returned → go straight in.
    // Full navigation so the server sees the new session cookie immediately.
    if (data.session) { window.location.assign("/onboarding"); return; }
    setSent(true);
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";

  if (sent) {
    return (
      <main className="container-x grid min-h-[80vh] place-items-center">
        <div className="card w-full max-w-md text-center">
          <div className="text-3xl">✉️</div>
          <h1 className="mt-3 text-2xl">Check your email</h1>
          <p className="mt-3 text-ink2">We sent a confirmation link to <span className="text-ink">{email}</span>. Click it to activate your account, then log in.</p>
          <Link href="/login" className="btn-ghost mt-6">Go to login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-x grid min-h-[80vh] place-items-center">
      <form onSubmit={signUp} className="card w-full max-w-md">
        <h1 className="text-3xl">Create your account</h1>
        <p className="mt-2 text-ink2">Free to start. No card required.</p>

        <label htmlFor="name" className="mt-6 block text-[13px] text-ink2">Full name</label>
        <input id="name" required autoComplete="name" value={name}
          onChange={(e) => setName(e.target.value)} className={`mt-1 ${input}`} placeholder="Abhishek Banaj" />

        <label htmlFor="email" className="mt-4 block text-[13px] text-ink2">Email</label>
        <input id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${input}`} placeholder="you@email.com" />

        <label htmlFor="password" className="mt-4 block text-[13px] text-ink2">Password</label>
        <input id="password" type="password" required autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${input}`} placeholder="At least 8 characters" />

        <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
          {loading ? "Creating…" : "Create free account"}
        </button>
        {err && <p className="mt-4 text-[14px] text-clay">{err}</p>}

        <p className="mt-6 text-center text-[14px] text-ink2">
          Already have an account? <Link href="/login" className="text-clay hover:underline">Log in</Link>
        </p>
        <p className="mt-4 text-center text-[12px] text-ink2">
          By signing up you agree to send only to people it&apos;s lawful for you to contact. See our{" "}
          <Link href="/privacy" className="underline">privacy policy</Link>.
        </p>
      </form>
    </main>
  );
}
