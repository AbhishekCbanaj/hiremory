import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminLogout } from "@/components/AdminLogout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function iso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}

type Signup = { email: string | null; full_name: string | null; plan: string | null; created_at: string };
type Pay = { amount: number | null; currency: string | null; kind: string | null; status: string | null; created_at: string };

function Kpi({ label, value, sub }: Readonly<{ label: string; value: string | number; sub?: string }>) {
  return (
    <div className="card">
      <div className="text-[13px] text-ink2">{label}</div>
      <div className="mt-1 font-display text-4xl tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[13px] text-sage">{sub}</div>}
    </div>
  );
}

export default async function AdminHome() {
  if (!(await isAdmin())) redirect("/admin/login");
  const db = createAdminClient();
  const head = { count: "exact" as const, head: true };

  const [u, u7, u30, pro, camp, cont, sl, rep, rs, bnc] = await Promise.all([
    db.from("profiles").select("id", head),
    db.from("profiles").select("id", head).gte("created_at", iso(7)),
    db.from("profiles").select("id", head).gte("created_at", iso(30)),
    db.from("profiles").select("id", head).eq("plan", "pro"),
    db.from("campaigns").select("id", head),
    db.from("contacts").select("id", head),
    db.from("send_log").select("id", head),
    db.from("send_log").select("id", head).in("status", ["replied", "resume_sent", "not_now"]),
    db.from("send_log").select("id", head).eq("status", "resume_sent"),
    db.from("send_log").select("id", head).eq("status", "bounced"),
  ]);

  const users = u.count ?? 0;
  const sent = sl.count ?? 0;
  const replied = rep.count ?? 0;
  const replyRate = sent ? Math.round((replied / sent) * 100) : 0;

  const { data: pays } = await db.from("payments")
    .select("amount,currency,kind,status,created_at,user_id")
    .order("created_at", { ascending: false }).limit(500);
  const revenue = { inr: 0, usd: 0 };
  for (const p of (pays ?? []) as Pay[]) {
    const cur = (p.currency || "").toLowerCase();
    if (cur === "inr") revenue.inr += p.amount || 0;
    else if (cur === "usd") revenue.usd += p.amount || 0;
  }
  const recentPays = ((pays ?? []) as Pay[]).slice(0, 8);

  const { data: signupsRaw } = await db.from("profiles")
    .select("email,full_name,plan,created_at")
    .order("created_at", { ascending: false }).limit(8);
  const signups = (signupsRaw ?? []) as Signup[];

  const money = (minor: number, sym: string) => `${sym}${(minor / 100).toLocaleString()}`;
  const date = (s: string) => new Date(s).toLocaleDateString();

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Admin · internal</p>
          <h1 className="mt-2 text-4xl">Hiremory <span className="grad-text">control room</span></h1>
        </div>
        <AdminLogout />
      </div>

      {/* KPIs */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total users" value={users.toLocaleString()} sub={`+${u7.count ?? 0} this week · +${u30.count ?? 0} this month`} />
        <Kpi label="Pro users" value={(pro.count ?? 0).toLocaleString()} sub={users ? `${Math.round(((pro.count ?? 0) / users) * 100)}% of users` : undefined} />
        <Kpi label="Campaigns" value={(camp.count ?? 0).toLocaleString()} />
        <Kpi label="Contacts" value={(cont.count ?? 0).toLocaleString()} />
        <Kpi label="Emails sent" value={sent.toLocaleString()} />
        <Kpi label="Reply rate" value={`${replyRate}%`} sub={`${replied.toLocaleString()} replies`} />
        <Kpi label="Resumes sent" value={(rs.count ?? 0).toLocaleString()} sub={`${(bnc.count ?? 0).toLocaleString()} bounced`} />
        <Kpi label="Revenue" value={money(revenue.inr, "₹")} sub={revenue.usd ? `+ ${money(revenue.usd, "$")}` : "lifetime, paid"} />
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-2">
        {/* Recent signups */}
        <div className="card">
          <h2 className="text-2xl">Recent signups</h2>
          {signups.length === 0 ? (
            <p className="mt-4 text-ink2">No users yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[14px]">
                <thead className="text-[12px] uppercase tracking-wide text-ink2">
                  <tr><th className="py-2 pr-4">User</th><th className="py-2 pr-4">Plan</th><th className="py-2">Joined</th></tr>
                </thead>
                <tbody>
                  {signups.map((s) => (
                    <tr key={(s.email ?? "") + s.created_at} className="border-t border-line">
                      <td className="py-3 pr-4">
                        <div className="text-ink">{s.full_name || "—"}</div>
                        <div className="text-[13px] text-ink2">{s.email}</div>
                      </td>
                      <td className="py-3 pr-4 capitalize">{s.plan || "free"}</td>
                      <td className="py-3 text-ink2">{date(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className="card">
          <h2 className="text-2xl">Recent payments</h2>
          {recentPays.length === 0 ? (
            <p className="mt-4 text-ink2">No payments yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[14px]">
                <thead className="text-[12px] uppercase tracking-wide text-ink2">
                  <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Amount</th><th className="py-2">Status</th></tr>
                </thead>
                <tbody>
                  {recentPays.map((p, i) => (
                    <tr key={p.created_at + i} className="border-t border-line">
                      <td className="py-3 pr-4 text-ink2">{date(p.created_at)}</td>
                      <td className="py-3 pr-4 capitalize">{p.kind === "topup" ? "Top-up" : "Pro"}</td>
                      <td className="py-3 pr-4 tabular-nums">{money(p.amount || 0, (p.currency || "").toLowerCase() === "usd" ? "$" : "₹")}</td>
                      <td className="py-3 capitalize text-ink2">{p.status || "paid"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
