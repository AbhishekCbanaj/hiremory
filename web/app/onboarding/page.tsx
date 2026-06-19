"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Fields the worker reads to build every email. Kept flat + simple.
type Profile = {
  full_name: string;
  phone: string;
  linkedin_url: string;
  github_url: string;
  location: string;
  headline: string;
  intro_line: string;
  availability: string;
  pitch_text: string; // one bullet per line in the UI; stored as text[]
  ai_notes: string;   // free-form memory the AI uses to personalize
  resume_text: string; // base resume as text, for JD tailoring
};

const EMPTY: Profile = {
  full_name: "", phone: "", linkedin_url: "", github_url: "", location: "",
  headline: "", intro_line: "", availability: "available to join immediately",
  pitch_text: "", ai_notes: "", resume_text: "",
};

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [uid, setUid] = useState<string | null>(null);
  const [p, setP] = useState<Profile>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) { router.push("/login"); return; }
      setUid(user.id);
      const { data: row } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setP({
        full_name: row?.full_name ?? user.user_metadata?.full_name ?? "",
        phone: row?.phone ?? "",
        linkedin_url: row?.linkedin_url ?? "",
        github_url: row?.github_url ?? "",
        location: row?.location ?? "",
        headline: row?.headline ?? "",
        intro_line: row?.intro_line ?? "",
        availability: row?.availability ?? "available to join immediately",
        pitch_text: (row?.pitch_points ?? []).join("\n"),
        ai_notes: row?.ai_notes ?? "",
        resume_text: row?.resume_text ?? "",
      });
    });
  }, [supabase, router]);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  const pitchPoints = p.pitch_text.split("\n").map((s) => s.trim()).filter(Boolean);
  const ready = p.full_name.trim() && p.headline.trim() && pitchPoints.length > 0;

  async function save() {
    if (!uid) return;
    if (!ready) { setMsg("Error: name, headline, and at least one pitch point are required."); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name.trim(),
      phone: p.phone.trim() || null,
      linkedin_url: p.linkedin_url.trim() || null,
      github_url: p.github_url.trim() || null,
      location: p.location.trim() || null,
      headline: p.headline.trim(),
      intro_line: p.intro_line.trim() || null,
      availability: p.availability.trim() || "available to join immediately",
      pitch_points: pitchPoints,
      ai_notes: p.ai_notes.trim() || null,
      resume_text: p.resume_text.trim() || null,
      onboarded: true,
    }).eq("id", uid);
    setBusy(false);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    await supabase.from("events").insert({ user_id: uid, name: "profile_completed" });
    setMsg("Saved! Redirecting to compose…");
    setTimeout(() => router.push("/compose"), 800);
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Your sender profile</p>
      <h1 className="mt-3 text-4xl md:text-5xl">This is who recruiters meet.</h1>
      <p className="mt-4 max-w-xl text-ink2">
        Every email the worker sends is built from this. Write it once; it
        personalizes each message with the recipient&apos;s name and company.
      </p>

      <div className="mt-10 grid gap-7 lg:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="text-2xl">You</h2>
          <Field label="Full name *"><input className={input} value={p.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Abhishek Banaj" /></Field>
          <Field label="Phone"><input className={input} value={p.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></Field>
          <Field label="Location"><input className={input} value={p.location} onChange={(e) => set("location", e.target.value)} placeholder="Bengaluru" /></Field>
          <Field label="LinkedIn URL"><input className={input} value={p.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" /></Field>
          <Field label="GitHub URL"><input className={input} value={p.github_url} onChange={(e) => set("github_url", e.target.value)} placeholder="https://github.com/…" /></Field>
        </div>

        <div className="card space-y-4">
          <h2 className="text-2xl">Your pitch</h2>
          <Field label="Roles you're after * (used in the subject + opening)">
            <input className={input} value={p.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Data / Product Analytics roles" />
          </Field>
          <Field label="One-line intro (opening sentence)">
            <input className={input} value={p.intro_line} onChange={(e) => set("intro_line", e.target.value)} placeholder="a Data Analyst with experience at Practo" />
          </Field>
          <Field label="Availability">
            <input className={input} value={p.availability} onChange={(e) => set("availability", e.target.value)} placeholder="available to join immediately" />
          </Field>
          <Field label="Proof points * (one per line, 3–5 strong bullets)">
            <textarea rows={5} className={`${input} resize-y`} value={p.pitch_text} onChange={(e) => set("pitch_text", e.target.value)}
              placeholder={"Cut reporting turnaround from days to under an hour\nBuilt LTV/CAC models that reshaped pricing\nFound ~₹12L/mo ad-spend leakage"} />
          </Field>
          <div className="text-[13px] text-ink2">{pitchPoints.length} bullet{pitchPoints.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="card mt-7">
        <h2 className="text-2xl">Memory <span className="text-[13px] font-normal text-ink2">(optional)</span></h2>
        <p className="mt-1 text-ink2">Anything you want the AI to remember and weave into your emails — context, preferences, things that make you you. The more you add, the more personal each email gets.</p>
        <textarea rows={5} className={`${input} mt-4 resize-y`} value={p.ai_notes} onChange={(e) => set("ai_notes", e.target.value)}
          placeholder={"e.g. I'm relocating to Bangalore in March. I care about mission-driven teams. I shipped a feature used by 2M users at my last job. Prefer a warm, direct tone — no corporate fluff."} />
      </div>

      <div className="card mt-7">
        <h2 className="text-2xl">Your resume <span className="text-[13px] font-normal text-ink2">(optional — paste as text)</span></h2>
        <p className="mt-1 text-ink2">Paste your full resume here. When you add a job description to a campaign, the AI tailors this to match it and attaches a PDF when a recruiter says yes.</p>
        <textarea rows={8} className={`${input} mt-4 resize-y`} value={p.resume_text} onChange={(e) => set("resume_text", e.target.value)}
          placeholder={"Paste your resume — experience, education, skills, projects. Plain text is fine."} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button onClick={save} disabled={busy || !ready} className="btn-primary">
          {busy ? "Saving…" : "Save profile"}
        </button>
        <a href="/dashboard" className="btn-ghost">Skip for now</a>
        {msg && <span className={`text-[14px] ${msg.startsWith("Error") ? "text-clay" : "text-sage"}`}>{msg}</span>}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-ink2">{label}</span>
      {children}
    </label>
  );
}
