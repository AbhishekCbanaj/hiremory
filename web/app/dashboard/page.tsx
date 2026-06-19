"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Campaign = { id: string; name: string; mode: string; status: string; created_at: string };

export default function Dashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data: camps } = await supabase
        .from("campaigns").select("*").order("created_at", { ascending: false });
      const { count: contacts } = await supabase
        .from("contacts").select("id", { count: "exact", head: true });
      const { data: logs } = await supabase.from("send_log").select("status");
      const counts: Record<string, number> = {};
      (logs ?? []).forEach((l: { status: string }) => {
        counts[l.status] = (counts[l.status] ?? 0) + 1;
      });
      setCampaigns(camps ?? []);
      setContactCount(contacts ?? 0);
      setStatusCounts(counts);
      setLoading(false);
    })();
  }, [supabase]);

  function campaignsTable() {
    if (loading) return <div className="px-6 py-8 text-ink2">Loading…</div>;
    if (campaigns.length === 0)
      return (
        <div className="px-6 py-10 text-center text-ink2">
          No campaigns yet. <a href="/compose" className="text-clay link-grow">Create your first one →</a>
        </div>
      );
    return (
      <table className="w-full text-left text-[15px]">
        <thead className="text-[13px] uppercase tracking-wider text-ink2">
          <tr className="border-b border-line">
            <th className="px-6 py-3 font-medium">Name</th>
            <th className="px-6 py-3 font-medium">Mode</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-b border-line/60 last:border-0">
              <td className="px-6 py-4">{c.name}</td>
              <td className="px-6 py-4 capitalize text-ink2">{c.mode}</td>
              <td className="px-6 py-4">
                <span className="inline-flex rounded-full bg-paper2 px-3 py-1 text-[13px] capitalize text-ink2">{c.status.replace("_", " ")}</span>
              </td>
              <td className="px-6 py-4 text-ink2">{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const sent = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const metrics = [
    ["Campaigns", String(campaigns.length)],
    ["Contacts", String(contactCount)],
    ["Sent", String(sent)],
    ["Replied", String((statusCounts.replied ?? 0) + (statusCounts.resume_sent ?? 0))],
    ["Resume sent", String(statusCounts.resume_sent ?? 0)],
  ];

  return (
    <main className="container-x py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-3 text-4xl md:text-5xl">Where you stand</h1>
        </div>
        <a href="/compose" className="btn-primary">New campaign</a>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value], i) => (
          <div key={label} className="rounded-xl2 border border-line bg-paper2 p-6 shadow-soft animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="text-[13px] uppercase tracking-wider text-ink2">{label}</div>
            <div className="mt-2 font-display text-4xl">{loading ? "·" : value}</div>
          </div>
        ))}
      </div>

      <div className="mt-12 overflow-hidden rounded-xl2 border border-line bg-paper2">
        <div className="border-b border-line px-6 py-4"><h2 className="text-xl">Campaigns</h2></div>
        {campaignsTable()}
      </div>

      <p className="mt-6 text-[13px] text-ink2">
        Sending stats fill in once the worker (next milestone) starts delivering and tracking replies.
      </p>
    </main>
  );
}
