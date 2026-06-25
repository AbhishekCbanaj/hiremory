"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PLAN_CAP: Record<string, number> = { free: 50, pro: 1500, teams: 100000 };

type Payment = {
  id: string; provider: string; kind: string; amount: number | null;
  currency: string | null; credits_added: number; status: string | null; created_at: string;
};
type Profile = {
  plan: string | null; plan_status: string | null; plan_renews_at: string | null;
  email_credits: number | null; billing_provider: string | null; stripe_customer_id: string | null;
};

function money(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  const sym = (currency || "").toLowerCase() === "inr" ? "₹" : "$";
  return `${sym}${(amount / 100).toLocaleString()}`;
}

export default function Billing() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.push("/login"); return; }
    const [{ data: p }, { data: pay }] = await Promise.all([
      supabase.from("profiles")
        .select("plan, plan_status, plan_renews_at, email_credits, billing_provider, stripe_customer_id")
        .eq("id", u.user.id).maybeSingle(),
      supabase.from("payments")
        .select("id, provider, kind, amount, currency, credits_added, status, created_at")
        .order("created_at", { ascending: false }).limit(50),
    ]);
    setProfile((p ?? {}) as Profile);
    setPayments((pay ?? []) as Payment[]);
  }, [supabase, router]);

  useEffect(() => {
    refresh();
    const q = new URLSearchParams(window.location.search).get("billing");
    if (q === "success") setMsg("Payment received — your plan updates within a few seconds.");
    if (q === "cancelled") setMsg("Checkout cancelled.");
  }, [refresh]);

  async function checkout(kind: "subscription" | "topup") {
    setBusy(kind); setMsg("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Checkout failed");
      window.location.assign(data.url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed"); setBusy(null);
    }
  }

  async function manageBilling() {
    setBusy("portal"); setMsg("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not open billing portal");
      window.location.assign(data.url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not open billing portal"); setBusy(null);
    }
  }

  const plan = profile?.plan ?? "free";
  const credits = profile?.email_credits ?? 0;
  const cap = PLAN_CAP[plan] ?? 50;
  const isPro = plan === "pro";
  const hasStripe = !!profile?.stripe_customer_id;
  const date = (s: string) => new Date(s).toLocaleDateString();

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Billing</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Plan &amp; <span className="grad-text">billing</span></h1>
      {msg && <p className="mt-4 rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[14px] text-ink2" role="status">{msg}</p>}

      <div className="mt-10 grid gap-7 lg:grid-cols-2">
        {/* Current plan */}
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">Current plan</h2>
            <span className="tag capitalize">{plan}{profile?.plan_status && plan !== "free" ? ` · ${profile.plan_status}` : ""}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl2 bg-paper2 p-4">
              <div className="font-display text-3xl">{cap.toLocaleString()}</div>
              <div className="text-[13px] text-ink2">emails / month</div>
            </div>
            <div className="rounded-xl2 bg-paper2 p-4">
              <div className="font-display text-3xl">{credits.toLocaleString()}</div>
              <div className="text-[13px] text-ink2">top-up credits</div>
            </div>
          </div>
          {profile?.plan_renews_at && isPro && (
            <p className="mt-4 text-[13px] text-ink2">Renews {date(profile.plan_renews_at)}.</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {!isPro && (
              <button onClick={() => checkout("subscription")} disabled={busy !== null} className="btn-primary disabled:opacity-50">
                {busy === "subscription" ? "Opening…" : "Upgrade to Pro"}
              </button>
            )}
            <button onClick={() => checkout("topup")} disabled={busy !== null} className="btn-ghost disabled:opacity-50">
              {busy === "topup" ? "Opening…" : "Buy 500 credits"}
            </button>
            {hasStripe && (
              <button onClick={manageBilling} disabled={busy !== null} className="btn-ghost disabled:opacity-50">
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </button>
            )}
          </div>
          <p className="mt-4 text-[13px] text-ink2">
            Cards are billed securely via Stripe. Cancel or update your card anytime under “Manage billing”.
          </p>
        </div>

        {/* Receipts */}
        <div className="card">
          <h2 className="text-2xl">Receipts</h2>
          <p className="mt-2 text-ink2">Your payment history.</p>
          {payments.length === 0 ? (
            <div className="mt-5 rounded-xl2 border border-dashed border-line bg-paper2 p-6 text-center text-[14px] text-ink2">
              No payments yet. Your receipts will appear here after your first purchase.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[14px]">
                <thead className="text-[12px] uppercase tracking-wide text-ink2">
                  <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Amount</th><th className="py-2">Status</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-3 pr-4 text-ink2">{date(p.created_at)}</td>
                      <td className="py-3 pr-4 capitalize">{p.kind === "topup" ? `${p.credits_added} credits` : "Pro (monthly)"}</td>
                      <td className="py-3 pr-4 tabular-nums">{money(p.amount, p.currency)}</td>
                      <td className="py-3 capitalize text-ink2">{p.status || "paid"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasStripe && (
            <p className="mt-4 text-[13px] text-ink2">
              Need an invoice PDF? Open <button onClick={manageBilling} className="text-clay underline">Manage billing</button>.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
