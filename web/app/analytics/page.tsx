"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Row = { status: string; sent_at: string | null };
type Data = {
  rows: Row[];
  suppressed: number;
  plan: string;
  credits: number;
};

const PLAN_CAP: Record<string, number> = { free: 50, pro: 1500, teams: 100000 };

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export default function Analytics() {
  const router = useRouter();
  const supabase = createClient();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const uid = user.id;
      const [logs, supp, prof] = await Promise.all([
        supabase.from("send_log").select("status, sent_at").eq("user_id", uid),
        supabase.from("suppressions").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("profiles").select("plan, email_credits").eq("id", uid).maybeSingle(),
      ]);
      setD({
        rows: (logs.data ?? []) as Row[],
        suppressed: supp.count ?? 0,
        plan: prof.data?.plan ?? "free",
        credits: prof.data?.email_credits ?? 0,
      });
    })();
  }, [supabase, router]);

  if (!d) return <main className="container-x py-14"><p className="text-ink2">Loading…</p></main>;

  const rows = d.rows;
  const n = (st: string) => rows.filter((r) => r.status === st).length;
  const sent = rows.length;
  const bounced = n("bounced");
  const resumeSent = n("resume_sent");
  const positivePending = n("positive");
  const replied = n("replied");
  const notNow = n("not_now");
  const delivered = sent - bounced;
  const anyReply = replied + notNow + resumeSent + positivePending;
  const positiveTotal = resumeSent + positivePending;

  // 14-day send trend
  const days: { iso: string; label: string; count: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    days.push({
      iso: key,
      label: dt.toLocaleDateString(undefined, { day: "numeric" }),
      count: rows.filter((r) => (r.sent_at ?? "").slice(0, 10) === key).length,
    });
  }
  const peak = Math.max(1, ...days.map((x) => x.count));

  // this-month usage
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const sentThisMonth = rows.filter((r) => (r.sent_at ?? "") >= monthStart).length;
  const allowance = (PLAN_CAP[d.plan] ?? 50) + d.credits;

  const cards: [string, string | number][] = [
    ["Sent", sent],
    ["Reply rate", `${pct(anyReply, sent)}%`],
    ["Positive rate", `${pct(positiveTotal, sent)}%`],
    ["Resume sent", resumeSent],
    ["Bounce rate", `${pct(bounced, sent)}%`],
    ["Unsubscribed", d.suppressed],
  ];

  const funnel: [string, number][] = [
    ["Sent", sent],
    ["Delivered", delivered],
    ["Replied", anyReply],
    ["Positive", positiveTotal],
    ["Resume sent", resumeSent],
  ];
  const funnelTop = Math.max(1, sent);

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Analytics</p>
      <h1 className="mt-3 text-4xl md:text-5xl">How your outreach is doing.</h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, val]) => (
          <div key={label} className="rounded-xl2 border border-line bg-paper2 p-5">
            <div className="text-[12px] uppercase tracking-wide text-ink2">{label}</div>
            <div className="mt-1 font-display text-3xl">{val}</div>
          </div>
        ))}
      </div>

      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl">Outreach funnel</h2>
          <div className="mt-5 space-y-3">
            {funnel.map(([label, value]) => (
              <div key={label} className="rounded-xl2 border border-line bg-paper2 p-4">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-ink">{label}</span>
                  <span className="text-ink2">{value}{label !== "Sent" && sent ? ` · ${pct(value, sent)}%` : ""}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
                  <div className="h-full rounded-full bg-clay" style={{ width: `${pct(value, funnelTop)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl">Sent — last 14 days</h2>
          <div className="mt-5 flex h-40 items-end gap-1.5 rounded-xl2 border border-line bg-paper2 p-4">
            {days.map((day) => (
              <div key={day.iso} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-clay/80"
                  style={{ height: `${Math.max(2, (day.count / peak) * 100)}%` }}
                  title={`${day.count} sent`}
                />
                <span className="text-[10px] text-ink2">{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">Plan &amp; usage</h2>
        <div className="mt-4 rounded-xl2 border border-line bg-paper2 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-display text-2xl capitalize">
              {d.plan}{d.credits > 0 && <span className="ml-2 text-[14px] text-ink2">+ {d.credits} credits</span>}
            </span>
            <a href="/settings" className="btn-ghost !py-2 !px-5">Manage</a>
          </div>
          <p className="mt-2 text-[14px] text-ink2">
            {sentThisMonth} of {allowance} emails used this month
            (plan cap {PLAN_CAP[d.plan] ?? 50}{d.credits > 0 ? ` + ${d.credits} credits` : ""}).
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-clay" style={{ width: `${pct(sentThisMonth, allowance)}%` }} />
          </div>
        </div>
      </section>
    </main>
  );
}
