"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally { setBusy(false); }
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";

  return (
    <main className="container-x grid min-h-[80vh] place-items-center">
      <form onSubmit={submit} className="card w-full max-w-sm">
        <p className="eyebrow">Hiremory</p>
        <h1 className="mt-2 text-2xl">Admin access</h1>
        <p className="mt-2 text-[14px] text-ink2">Staff only. This area isn&apos;t for customers.</p>

        <label htmlFor="u" className="mt-6 block text-[13px] text-ink2">Username</label>
        <input id="u" autoComplete="username" value={username}
          onChange={(e) => setUsername(e.target.value)} className={`mt-1 ${input}`} />

        <label htmlFor="p" className="mt-4 block text-[13px] text-ink2">Password</label>
        <div className="relative mt-1">
          <input id="p" type={show ? "text" : "password"} autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={input} />
          <button type="button" onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink2 hover:text-ink">
            {show ? "Hide" : "Show"}
          </button>
        </div>

        <button type="submit" disabled={busy} className="btn-primary mt-6 w-full disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {err && <p className="mt-4 text-[14px] text-clay" role="alert">{err}</p>}
      </form>
    </main>
  );
}
