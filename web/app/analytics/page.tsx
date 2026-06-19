"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  contacts: number;
  campaigns: number;
  sent: number;
  replied: number;
  resumeSent: number;
  notNow: number;
  bounced: number;
  suppressed: number;
  onboarded: boolean;
  mailboxes: number;
  plan: string;
};

const PLAN_CAP: Record<string, number> = { free: 50, pro: 1500, teams: 100000 };

export default function Analytics() {
  const router = useRouter();
  const supabase = createClient();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const uid = user.id;
      const [logs, contacts, camps, supp, prof, boxes] = await Promise.all([
        supabase.from("send_log").select("status").eq("user_id", uid),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("suppressions").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("profiles").select("onboarded, plan").eq("id", uid).maybeSingle(),
        supabase.from("mailboxes").select("id", { count: "exact", head: true }).eq("user_id", uid),
      ]);
      const rows = logs.data ?? [];
      const by = (st: string) => rows.filter((r) => r.status === st).length;
      setS({
        contacts: contacts.count ?? 0,
        campaigns: camps.count ?? 0,
        sent: rows.length,
        replied: by("replied"),
        resumeSent: by("resume_sent"),
        notNow: by("not_now"),
        bounced: by("bounced"),
        suppressed: supp.count ?? 0,
        onboarded: !!prof.data?.onboarded,
        mailboxes: boxes.count ?? 0,
        plan: prof.data?.plan ?? "free",
      });
    })();
  }, [supabase, router]);

  if (!s) return <main className="container-x py-14"><p className="text-ink2">Loading…</p></main>;

  const positiveReplies = s.resumeSent; // resume sent == positive replies handled
  const replyRate = s.sent ? Math.round(((s.replied + s.resumeSent + s.notNow) / s.sent) * 100) : 0;
  const cap = PLAN_CAP[s.plan] ?? 50;

  const funnel = [
    { label: "Profile complete", value: s.onboarded ? 1 : 0, of: 1, done: s.onboarded },
    { label: "Mailbox connected", value: s.mailboxes, of: 1, done: s.mailboxes > 0 },
    { label: "Contacts added", value: s.contacts, of: s.contacts, done: s.contacts > 0 },
    { label: "Emails sent", value: s.sent, of: s.contacts || 1, done: s.sent > 0 },
    { label: "Replies", value: s.replied + s.resumeSent + s.notNow, of: s.sent || 1, done: false },
    { label: "Resume sent (positive)", value: positiveReplies, of: s.sent || 1, done: false },
  ];

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Analytics</p>
      <h1 className="mt-3 text-4xl md:text-5xl">How your outreach is doing.</h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {([
          ["Sent", s.sent], ["Replied", s.replied + s.resumeSent + s.notNow],
          ["Resume sent", s.resumeSent], ["Reply rate", `${replyRate}%`],
          ["Bounced", s.bounced], ["Unsubscribed", s.suppressed],
        ] as [string, number | string][]).map(([label, val]) => (
          <div key={label} className="rounded-xl2 border border-line bg-paper2 p-5">
            <div className="text-[12px] uppercase tracking-wide text-ink2">{label}</div>
            <div className="mt-1 font-display text-3xl">{val}</div>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl">Activation funnel</h2>
        <div className="mt-5 space-y-3">
          {funnel.map((f) => {
            const pct = f.of ? Math.min(100, Math.round((f.value / f.of) * 100)) : 0;
            return (
              <div key={f.label} className="rounded-xl2 border border-line bg-paper2 p-4">
                <div className="flex items-center justify-between text-[14px]">
                  <span className={f.done ? "text-sage" : "text-ink"}>{f.done ? "✓ " : ""}{f.label}</span>
                  <span className="text-ink2">{f.value}{f.of > 1 ? ` / ${f.of}` : ""}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
                  <div className="h-full rounded-full bg-clay" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">Plan</h2>
        <div className="mt-4 rounded-xl2 border border-line bg-paper2 p-6">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl capitalize">{s.plan}</span>
            <a href="/#pricing" className="btn-ghost !py-2 !px-5">Upgrade</a>
          </div>
          <p className="mt-2 text-[14px] text-ink2">{s.sent} of {cap} emails sent (lifetime shown; monthly cap = {cap}).</p>
        </div>
      </section>
    </main>
  );
}
