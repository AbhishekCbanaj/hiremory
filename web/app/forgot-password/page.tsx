"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPassword() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setSent(true);
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";

  return (
    <main className="container-x grid min-h-[80vh] place-items-center">
      {sent ? (
        <div className="card w-full max-w-md text-center">
          <div className="text-3xl">✉️</div>
          <h1 className="mt-3 text-2xl">Check your email</h1>
          <p className="mt-3 text-ink2">If an account exists for <span className="text-ink">{email}</span>, we sent a password-reset link.</p>
          <Link href="/login" className="btn-ghost mt-6">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card w-full max-w-md">
          <h1 className="text-3xl">Reset your password</h1>
          <p className="mt-2 text-ink2">Enter your email and we&apos;ll send a reset link.</p>
          <label htmlFor="email" className="mt-6 block text-[13px] text-ink2">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${input}`} placeholder="you@email.com" />
          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? "Sending…" : "Send reset link"}
          </button>
          {err && <p className="mt-4 text-[14px] text-clay">{err}</p>}
          <p className="mt-6 text-center text-[14px] text-ink2">
            <Link href="/login" className="text-clay hover:underline">Back to login</Link>
          </p>
        </form>
      )}
    </main>
  );
}
