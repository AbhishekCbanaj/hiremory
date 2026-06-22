"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseEmails, parseCsv, type Contact } from "@/lib/parse";

type Mode = "quick" | "bulk";

const EMAIL_TYPES: { value: string; label: string }[] = [
  { value: "posting", label: "Applying after seeing a job posting" },
  { value: "speculative", label: "Speculative application (no posting)" },
  { value: "referral", label: "Referral-based application" },
];

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

  // email type + the few extras its template needs
  const [emailType, setEmailType] = useState("posting");
  const [roleTitle, setRoleTitle] = useState("");
  const [applySource, setApplySource] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [jd, setJd] = useState("");

  // read-only preview
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function generatePreview() {
    setPreviewing(true); setPreviewErr(null); setPreview(null);
    try {
      const res = await fetch("/api/email/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_type: emailType,
          role_title: roleTitle || null,
          apply_source: applySource || null,
          referrer_name: referrerName || null,
          job_description: jd || null,
          company: emails[0]?.company || "Acme Inc",
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Could not generate preview");
      setPreview({ subject: out.subject, body: out.body });
    } catch (e) {
      setPreviewErr(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function readFileContacts(): Promise<Contact[]> {
    if (!file) return [];
    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new Error("Only CSV is supported right now. Export your list as CSV, or paste emails.");
    }
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error("No valid emails found in that CSV.");
    return rows;
  }

  async function save() {
    if (!userId) { router.push("/login"); return; }
    setBusy(true);
    setMsg(null);
    try {
      const contacts: Contact[] = mode === "quick" ? emails : await readFileContacts();
      if (mode === "quick" && emails.length === 0) throw new Error("Add at least one valid email.");
      if (mode === "bulk" && contacts.length === 0) throw new Error("Choose a CSV with at least one email.");

      const { data: camp, error: e1 } = await supabase
        .from("campaigns")
        .insert({
          user_id: userId,
          name: name || (mode === "quick" ? "Quick batch" : file?.name || "Bulk campaign"),
          mode,
          status: "draft",
          email_type: emailType,
          role_title: roleTitle.trim() || null,
          apply_source: applySource.trim() || null,
          referrer_name: referrerName.trim() || null,
          job_description: jd.trim() || null,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      if (contacts.length) {
        const rows = contacts.map((c) => ({ ...c, user_id: userId, campaign_id: camp.id }));
        const { error: e2 } = await supabase.from("contacts").insert(rows);
        if (e2) throw e2;
      }

      if (resume) {
        const path = `${userId}/${resume.name}`;
        const { error: e3 } = await supabase.storage.from("resumes").upload(path, resume, { upsert: true });
        if (e3) throw e3;
        await supabase.from("resumes").insert({
          user_id: userId, label: resume.name.replace(/\.pdf$/i, ""), storage_path: path,
        });
      }

      const n = contacts.length;
      setMsg(`Saved ${n} contact${n === 1 ? "" : "s"} to “${name || "your campaign"}”. The worker sends them shortly.`);
      setPasted(""); setFile(null);
    } catch (err: unknown) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const needsRole = emailType === "posting" || emailType === "referral";
  const needsSource = emailType === "posting";
  const needsReferrer = emailType === "referral";

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Compose a campaign</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Who should hear from you?</h1>
      <p className="mt-4 max-w-xl text-ink2">
        Pick an email type, add your recipients, and we tailor a proven template to each person and
        company. Your resume is sent only when a recruiter asks.
      </p>

      {!userId && (
        <p className="mt-4 rounded-xl2 border border-clay/40 bg-clay/10 px-4 py-3 text-[14px] text-clay">
          You're not signed in. <a href="/login" className="underline">Log in</a> to save a campaign.
        </p>
      )}
      {userId && !onboarded && (
        <p className="mt-4 rounded-xl2 border border-clay/40 bg-clay/10 px-4 py-3 text-[14px] text-clay">
          The worker won&apos;t send until your profile is set.{" "}
          <a href="/onboarding" className="underline">Finish your profile →</a>
        </p>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Campaign name (e.g. Product companies — Mar)"
        className="mt-8 w-full max-w-lg rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay"
      />

      {/* email type + its extras */}
      <div className="mt-6 card max-w-3xl">
        <h2 className="text-2xl">Email type</h2>
        <p className="mt-1 text-ink2">We tailor the right template to each recipient — you don&apos;t write the email.</p>
        <select
          value={emailType}
          onChange={(e) => { setEmailType(e.target.value); setPreview(null); }}
          className="mt-4 w-full max-w-md rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay"
        >
          {EMAIL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {needsRole && (
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Role you're applying for (e.g. Data Analyst)"
              className="rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay" />
          )}
          {needsSource && (
            <input value={applySource} onChange={(e) => setApplySource(e.target.value)}
              placeholder="Where you saw it (e.g. LinkedIn, company site)"
              className="rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay" />
          )}
          {needsReferrer && (
            <input value={referrerName} onChange={(e) => setReferrerName(e.target.value)}
              placeholder="Who referred you (e.g. Priya Sharma)"
              className="rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay" />
          )}
        </div>

        <div className="mt-5">
          <div className="text-[13px] text-ink2">Job description <span className="text-ink2/70">(optional)</span></div>
          <p className="mt-1 text-[13px] text-ink2">Paste it and the AI tailors the email to this exact role — reading the JD against your resume to spell out why you&apos;re a strong fit.</p>
          <textarea value={jd} onChange={(e) => { setJd(e.target.value); setPreview(null); }} rows={5}
            placeholder="Paste the job description here…"
            className="mt-2 w-full resize-y rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay" />
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-line bg-paper2 p-1">
        {(["quick", "bulk"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full px-6 py-2 text-[15px] transition-colors ${mode === m ? "bg-ink text-paper" : "text-ink2 hover:text-ink"}`}>
            {m === "quick" ? "Quick paste" : "Bulk upload"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-[1.4fr_1fr]">
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
              <p className="mt-1 text-ink2">CSV with an <code>email</code> column (name, company, title optional).</p>
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

      {/* read-only preview */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">Preview the email</h2>
          <button type="button" onClick={generatePreview} disabled={previewing} className="btn-ghost disabled:opacity-50">
            {previewing ? "Generating…" : "Generate preview"}
          </button>
        </div>
        <p className="mt-1 text-ink2">A sample of what each recipient gets — tailored to them automatically. No editing needed.</p>
        <div className="mt-4 card">
          {previewErr && <p className="text-[14px] text-clay">{previewErr}</p>}
          {!previewErr && !preview && (
            <p className="py-10 text-center text-ink2">Click “Generate preview” to see your tailored email.</p>
          )}
          {preview && (
            <div className="text-[15px]">
              <div className="text-[13px] uppercase tracking-wide text-ink2">Subject</div>
              <div className="mt-1 font-display text-xl">{preview.subject}</div>
              <div className="mt-4 whitespace-pre-wrap leading-relaxed text-ink2">{preview.body}</div>
            </div>
          )}
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
