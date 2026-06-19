"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Settings() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [plan, setPlan] = useState("free");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUid(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("plan").eq("id", data.user.id).maybeSingle();
      setPlan(p?.plan ?? "free");
    });
  }, [supabase, router]);

  // Stripe Payment Link (set NEXT_PUBLIC_STRIPE_PRO_LINK to your link URL).
  const proLink = process.env.NEXT_PUBLIC_STRIPE_PRO_LINK;
  const upgradeUrl = proLink
    ? `${proLink}?client_reference_id=${uid}&prefilled_email=${encodeURIComponent(email)}`
    : null;

  async function deleteAccount() {
    if (confirm !== "DELETE") return;
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    setBusy(false);
    if (res.ok) router.push("/");
    else alert("Could not delete account. Try again.");
  }

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Your account</h1>

      <div className="mt-10 grid gap-7 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-2xl">Plan</h2>
          <p className="mt-2 text-ink2">You&apos;re on the <span className="capitalize text-ink">{plan}</span> plan.</p>
          {plan === "free" && (
            upgradeUrl
              ? <a href={upgradeUrl} className="btn-primary mt-5">Upgrade to Pro</a>
              : <p className="mt-5 text-[14px] text-ink2">Upgrades open soon.</p>
          )}
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
          <button onClick={deleteAccount} disabled={busy || confirm !== "DELETE"}
            className="btn mt-4 border border-clay px-6 py-3 text-clay disabled:opacity-40">
            {busy ? "Deleting…" : "Delete my account & data"}
          </button>
        </div>
      </div>

      <p className="mt-8 text-[14px] text-ink2">
        See our <a href="/privacy" className="text-clay underline">privacy &amp; data policy</a>.
      </p>
    </main>
  );
}
