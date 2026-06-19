"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseEmails, parseCsv, type Contact } from "@/lib/parse";
import { EmailPreview } from "@/components/EmailPreview";

type Mode = "quick" | "bulk";

export default function Compose() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(true);
  const [mode, setMode] = useState<Mode>("quick");
  const [name, setName] = useState("");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [jd, setJd] = useState("");
  const [tailored, setTailored] = useState<{ summary: string; sections: { heading: string; bullets: string[] }[] } | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorErr, setTailorErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function previewTailored() {
    setTailoring(true); setTailorErr(null); setTailored(null);
    const res = await fetch("/api/resume/tailor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_description: jd }),
    });
    const out = await res.json();
    setTailoring(false);
    if (!res.ok) { setTailorErr(out.error ?? "Failed"); return; }
    setTailored(out);
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) {
        const { data: row } = await supabase.from("profiles").select("onboarded").eq("id", id).maybeSingle();
        setOnboarded(!!row?.onboarded);
      }
    });
  }, [supabase]);

  const emails = parseEmails(pasted);

  async function readFileContacts(): Promise<Contact[]> {
    if (!file) return [];
    if (!file.name.toLowerCase().endsWith(".csv")) {
      // Honest failure instead of silently accepting a file we never parse.
      throw new Error("Only CSV is supported right now. Export your list as CSV, or paste emails. (PDF/Excel/Word coming soon.)");
    }
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error("No valid emails found in that CSV.");
    return rows;
  }

  async function save() {
    if (!userId) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const contacts: Contact[] = mode === "quick" ? emails : await readFileContacts();
      if (mode === "quick" && emails.length === 0) throw new Error("Add at least one valid email.");
      if (mode === "bulk" && contacts.length === 0) throw new Error("Choose a CSV with at least one email.");

      // 1. campaign
      const { data: camp, error: e1 } = await supabase
        .from("campaigns")
        .insert({
          user_id: userId,
          name: name || (mode === "quick" ? "Quick batch" : file?.name || "Bulk campaign"),
          mode,
          status: "draft",
          instructions: instructions.trim() || null,
          job_description: jd.trim() || null,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      // 2. contacts
      if (contacts.length) {
        const rows = contacts.map((c) => ({ ...c, user_id: userId, campaign_id: camp.id }));
        const { error: e2 } = await supabase.from("contacts").insert(rows);
        if (e2) throw e2;
      }

      // 3. resume upload (optional)
      if (resume) {
        const path = `${userId}/${resume.name}`;
        const { error: e3 } = await supabase.storage
          .from("resumes")
          .upload(path, resume, { upsert: true });
        if (e3) throw e3;
        await supabase.from("resumes").insert({
          user_id: userId, label: resume.name.replace(/\.pdf$/i, ""), storage_path: path,
        });
      }

      const n = contacts.length;
      setMsg(`Saved ${n} contact${n === 1 ? "" : "s"} to “${name || "your campaign"}”.`);
      setPasted(""); setFile(null);
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Compose a campaign</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Who should hear from you?</h1>
      <p className="mt-4 max-w-xl text-ink2">
        Quick mode for a precise handful, bulk for a big list. Your resume is sent
        only when a recruiter asks.
      </p>
      {!userId && (
        <p className="mt-4 rounded-xl2 border border-clay/40 bg-clay/10 px-4 py-3 text-[14px] text-clay">
          You're not signed in. <a href="/login" className="underline">Log in</a> to save a campaign.
        </p>
      )}
      {userId && !onboarded && (
        <p className="mt-4 rounded-xl2 border border-clay/40 bg-clay/10 px-4 py-3 text-[14px] text-clay">
          The worker won&apos;t send until your sender profile is complete.{" "}
          <a href="/onboarding" className="underline">Finish your profile →</a>
        </p>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Campaign name (e.g. Product companies — Mar)"
        className="mt-8 w-full max-w-lg rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay"
      />

      <div className="mt-6 inline-flex rounded-full border border-line bg-paper2 p-1">
        {(["quick", "bulk"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full px-6 py-2 text-[15px] transition-colors ${mode === m ? "bg-ink text-paper" : "text-ink2 hover:text-ink"}`}>
            {m === "quick" ? "Quick paste" : "Bulk upload"}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-7 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          {mode === "quick" ? (
            <>
              <h2 className="text-2xl">Paste emails</h2>
              <p className="mt-1 text-ink2">Commas, spaces, or new lines. 1 to ~30 at a time.</p>
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={9}
                placeholder={"akanksha.puri@sourcefuse.com,\nheena@clevertap.com"}
                className="mt-4 w-full resize-y rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay" />
              <div className="mt-3 text-[14px] text-ink2">{emails.length} valid email{emails.length === 1 ? "" : "s"} detected</div>
            </>
          ) : (
            <>
              <h2 className="text-2xl">Upload a contact list</h2>
              <p className="mt-1 text-ink2">CSV with an <code>email</code> column (name, company, title optional). PDF/Excel/Word coming soon.</p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed border-line bg-paper2 px-6 py-12 text-center hover:border-clay">
                <span className="font-display text-3xl text-clay">↑</span>
                <span className="mt-2 text-ink">{file?.name ?? "Drop a CSV or click to browse"}</span>
                <input type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="text-2xl">Your resume</h2>
          <p className="mt-1 text-ink2">Stored privately. Sent only after a recruiter asks.</p>
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl2 border border-line bg-paper2 px-4 py-3 hover:border-clay">
            <span className="truncate text-[15px] text-ink2">{resume?.name ?? "Choose PDF…"}</span>
            <span className="btn-ghost !py-1.5 !px-4 text-[13px]">Browse</span>
            <input type="file" accept=".pdf" className="hidden"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>

      <EmailPreview instructions={instructions} onInstructions={setInstructions}
        sampleCompany={emails[0]?.company} />

      <section className="mt-12">
        <p className="eyebrow">Tailor your resume</p>
        <h2 className="mt-2 text-2xl">Match your resume to the job</h2>
        <p className="mt-1 text-ink2">Paste the job description. When a recruiter says yes, the worker tailors your resume to it and attaches a PDF. (Needs your resume in <a href="/onboarding" className="text-clay underline">Profile</a> + an AI key.)</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="card">
            <textarea rows={9} className="w-full resize-y rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay"
              value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description here…" />
            <button type="button" onClick={previewTailored} disabled={tailoring || !jd.trim()} className="btn-ghost mt-3">
              {tailoring ? "Tailoring…" : "Preview tailored resume"}
            </button>
            {tailorErr && <p className="mt-2 text-[14px] text-clay">{tailorErr}</p>}
          </div>
          <div className="card">
            {tailored ? (
              <div className="text-[14px]">
                <p className="text-ink2">{tailored.summary}</p>
                {tailored.sections.map((s) => (
                  <div key={s.heading} className="mt-3">
                    <div className="font-display text-ink">{s.heading}</div>
                    <ul className="mt-1 space-y-1 text-ink2">
                      {s.bullets.map((b) => <li key={b}>• {b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid h-full place-items-center py-12 text-center text-ink2">
                <p>Tailored resume preview appears here.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save campaign"}
        </button>
        <a href="/dashboard" className="btn-ghost">Go to dashboard</a>
        {msg && <span className={`text-[14px] ${msg.startsWith("Error") ? "text-clay" : "text-sage"}`}>{msg}</span>}
      </div>
    </main>
  );
}
