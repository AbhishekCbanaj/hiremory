"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RazorpayResp = {
  provider: "razorpay";
  kind: "subscription" | "topup";
  keyId: string;
  subscriptionId?: string;
  orderId?: string;
  amount?: number;
  email?: string;
};
type CheckoutResp = { provider: "stripe"; url: string } | RazorpayResp | { error: string };

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("rzp-sdk")) return resolve();
    const s = document.createElement("script");
    s.id = "rzp-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(s);
  });
}

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
      const data: CheckoutResp = await res.json();
      if (!res.ok || "error" in data) throw new Error(("error" in data && data.error) || "Checkout failed");

      if (data.provider === "stripe") {
        window.location.assign(data.url);
        return;
      }
      // Razorpay — open the hosted checkout modal
      await loadRazorpay();
      const Rzp = (window as unknown as {
        Razorpay: new (o: Record<string, unknown>) => { open: () => void };
      }).Razorpay;
      const opts: Record<string, unknown> = {
        key: data.keyId,
        name: "Hiremory",
        description: data.kind === "topup" ? "500 email credits" : "Hiremory Pro (monthly)",
        prefill: { email: data.email },
        theme: { color: "#047857" },
        handler: () => { setMsg("Payment received — updating your account…"); setTimeout(() => location.reload(), 2500); },
      };
      if (data.kind === "subscription") opts.subscription_id = data.subscriptionId;
      else { opts.order_id = data.orderId; opts.amount = data.amount; opts.currency = "INR"; }
      new Rzp(opts).open();
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
          <p className="mt-3 text-[13px] text-ink2">
            Indian cards are billed in ₹ via Razorpay; international cards in $ via Stripe — chosen automatically.
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
