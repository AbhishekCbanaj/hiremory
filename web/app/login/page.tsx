"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    // Full navigation so the server (proxy) reads the freshly-set session cookie
    // instead of bouncing back to /login on a client-side push.
    window.location.assign("/dashboard");
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";

  return (
    <main className="container-x grid min-h-[80vh] place-items-center">
      <form onSubmit={signIn} className="card w-full max-w-md">
        <h1 className="text-3xl">Welcome back</h1>
        <p className="mt-2 text-ink2">Log in to your Hiremory account.</p>

        <label htmlFor="email" className="mt-6 block text-[13px] text-ink2">Email</label>
        <input id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${input}`} placeholder="you@email.com" />

        <div className="mt-4 flex items-center justify-between">
          <label htmlFor="password" className="text-[13px] text-ink2">Password</label>
          <Link href="/forgot-password" className="text-[13px] text-clay hover:underline">Forgot?</Link>
        </div>
        <input id="password" type="password" required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${input}`} placeholder="••••••••" />

        <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
          {loading ? "Logging in…" : "Log in"}
        </button>
        {err && <p className="mt-4 text-[14px] text-clay">{err}</p>}

        <p className="mt-6 text-center text-[14px] text-ink2">
          New here? <Link href="/signup" className="text-clay hover:underline">Create a free account</Link>
        </p>
      </form>
    </main>
  );
}
