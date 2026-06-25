"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Settings() {
  const router = useRouter();
  const supabase = createClient();
  const [plan, setPlan] = useState("free");
  const [credits, setCredits] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles")
        .select("plan, email_credits").eq("id", data.user.id).maybeSingle();
      setPlan(p?.plan ?? "free");
      setCredits(p?.email_credits ?? 0);
    });
    // surfaced after a Stripe redirect back
    const q = new URLSearchParams(window.location.search).get("billing");
    if (q === "success") setMsg("Payment received — your plan updates within a few seconds.");
    if (q === "cancelled") setMsg("Checkout cancelled.");
  }, [supabase, router]);

  async function checkout(kind: "subscription" | "topup") {
    setBusy(kind);
    setMsg("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Checkout failed");
      window.location.assign(data.url); // Stripe hosted checkout
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    if (confirm !== "DELETE") return;
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    setDeleting(false);
    if (res.ok) router.push("/");
    else setMsg("Could not delete account. Try again.");
  }

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Your account</h1>
      {msg && <p className="mt-4 rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[14px] text-ink2">{msg}</p>}

      <div className="mt-10 grid gap-7 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-2xl">Account</h2>
          <p className="mt-2 text-ink2">Manage your profile, sending mailbox, and sign-in.</p>
          <div className="mt-5 flex flex-col gap-2">
            <a href="/onboarding" className="btn-ghost text-center">Edit profile &amp; resume</a>
            <a href="/mailbox" className="btn-ghost text-center">Connected mailbox</a>
            <a href="/resume-analytics" className="btn-ghost text-center">Resume Analytics</a>
            <a href="/forgot-password" className="btn-ghost text-center">Reset password</a>
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl">Plan &amp; credits</h2>
          <p className="mt-2 text-ink2">
            You&apos;re on the <span className="capitalize text-ink">{plan}</span> plan
            {credits > 0 && <> with <span className="text-ink">{credits}</span> top-up credits</>}.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {plan === "free" && (
              <button onClick={() => checkout("subscription")} disabled={busy !== null} className="btn-primary disabled:opacity-50">
                {busy === "subscription" ? "Opening…" : "Upgrade to Pro"}
              </button>
            )}
            <button onClick={() => checkout("topup")} disabled={busy !== null} className="btn-ghost disabled:opacity-50">
              {busy === "topup" ? "Opening…" : "Buy 500 credits"}
            </button>
          </div>
          <a href="/billing" className="btn-ghost mt-4 text-center">Billing &amp; receipts</a>
          <p className="mt-3 text-[13px] text-ink2">
            Payments are processed securely by Stripe.
          </p>
        </div>

        <div className="card !border-clay/40">
          <h2 className="text-2xl text-clay">Danger zone</h2>
          <p className="mt-2 text-ink2">
            Permanently delete your account and all data — profile, contacts, send log, and mailbox
            credentials. This cannot be undone.
          </p>
          <label className="mt-4 block text-[13px] text-ink2">Type DELETE to confirm</label>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-xl2 border border-line bg-paper2 px-4 py-2 text-[15px] outline-none focus:border-clay" />
          <button onClick={deleteAccount} disabled={deleting || confirm !== "DELETE"}
            className="btn mt-4 border border-clay px-6 py-3 text-clay disabled:opacity-40">
            {deleting ? "Deleting…" : "Delete my account & data"}
          </button>
        </div>
      </div>

      <p className="mt-8 text-[14px] text-ink2">
        See our <a href="/privacy" className="text-clay underline">privacy &amp; data policy</a>.
      </p>
    </main>
  );
}
