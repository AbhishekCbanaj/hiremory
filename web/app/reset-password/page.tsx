"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// The recovery link from the email establishes a session (handled by the
// Supabase browser client). With a session present, updateUser sets the new
// password.
export default function ResetPassword() {
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // session arrives via the recovery link; also catch the PASSWORD_RECOVERY event
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => window.location.assign("/dashboard"), 1000);
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";

  return (
    <main className="container-x grid min-h-[80vh] place-items-center">
      <form onSubmit={submit} className="card w-full max-w-md">
        <h1 className="text-3xl">Set a new password</h1>
        {ready ? (
          <>
            <p className="mt-2 text-ink2">Choose a new password for your account.</p>
            <label htmlFor="password" className="mt-6 block text-[13px] text-ink2">New password</label>
            <input id="password" type="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${input}`} placeholder="At least 8 characters" />
            <button type="submit" disabled={loading || done} className="btn-primary mt-6 w-full">
              {done ? "Saved ✓" : loading ? "Saving…" : "Update password"}
            </button>
            {err && <p className="mt-4 text-[14px] text-clay">{err}</p>}
          </>
        ) : (
          <p className="mt-4 text-ink2">
            Open this page from the reset link in your email. If it expired,{" "}
            <Link href="/forgot-password" className="text-clay hover:underline">request a new one</Link>.
          </p>
        )}
      </form>
    </main>
  );
}
