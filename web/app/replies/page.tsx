"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; email: string; company: string | null; status: string; last_action_at: string | null };

// Reply statuses the worker sets after scanning + classifying the inbox.
const REPLY_STATUSES = ["replied", "positive", "resume_sent", "not_now"];

const LABEL: Record<string, string> = {
  positive: "Interested", resume_sent: "Resume sent", replied: "Needs you", not_now: "Not now",
};
function tone(v: string) {
  if (v === "positive" || v === "resume_sent") return "bg-sage/15 text-sage";
  if (v === "not_now") return "bg-ink/10 text-ink2";
  return "bg-amber/15 text-amber";
}

export default function Replies() {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("send_log")
        .select("id, email, company, status, last_action_at")
        .eq("user_id", user.id)
        .in("status", REPLY_STATUSES)
        .order("last_action_at", { ascending: false });
      setRows((data ?? []) as Row[]);
    })();
  }, [supabase, router]);

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Replies & auto-resume</p>
      <h1 className="mt-3 text-4xl md:text-5xl">It reads the room, then acts</h1>
      <p className="mt-4 max-w-2xl text-ink2">
        Hiremory scans your threads for replies and sorts them. When a recruiter asks for your resume,
        it sends the role-matched PDF back automatically, in the same conversation. You only step in
        for the gray areas.
      </p>

      {rows === null && <p className="mt-8 text-ink2">Loading…</p>}

      {rows !== null && rows.length === 0 && (
        <div className="mt-8 card text-center">
          <p className="text-ink2">No replies yet. Once your emails go out and recruiters respond, they show up here —
            sorted by interested, needs-you, and not-now.</p>
          <a href="/compose" className="btn-primary mt-5 inline-block">Start a campaign</a>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mt-8 space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg">{r.email}{r.company && <span className="text-ink2"> · {r.company}</span>}</div>
                {r.last_action_at && (
                  <div className="mt-1 text-[13px] text-ink2">{new Date(r.last_action_at).toLocaleString()}</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[13px] ${tone(r.status)}`}>{LABEL[r.status] ?? r.status}</span>
                {r.status === "resume_sent" && <span className="text-[13px] text-sage">resume sent ✓</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
