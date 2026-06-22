"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string; phone: string; linkedin_url: string; github_url: string; location: string;
  headline: string; intro_line: string; availability: string; pitch_text: string;
  total_experience: string; current_salary: string; expected_salary: string;
  notice_period: string; open_to_relocation: boolean; achievements: string;
  resume_text: string; // filled from the parsed PDF, not shown as a textarea
};

const EMPTY: Profile = {
  full_name: "", phone: "", linkedin_url: "", github_url: "", location: "",
  headline: "", intro_line: "", availability: "available to join immediately", pitch_text: "",
  total_experience: "", current_salary: "", expected_salary: "", notice_period: "",
  open_to_relocation: false, achievements: "", resume_text: "",
};

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const [uid, setUid] = useState<string | null>(null);
  const [p, setP] = useState<Profile>(EMPTY);
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) { router.push("/login"); return; }
      setUid(user.id);
      const { data: row } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (row) setP((prev) => ({
        ...prev,
        full_name: row.full_name ?? "", phone: row.phone ?? "",
        linkedin_url: row.linkedin_url ?? "", github_url: row.github_url ?? "", location: row.location ?? "",
        headline: row.headline ?? "", intro_line: row.intro_line ?? "",
        availability: row.availability ?? "available to join immediately",
        pitch_text: (row.pitch_points ?? []).join("\n"),
        total_experience: row.total_experience ?? "", current_salary: row.current_salary ?? "",
        expected_salary: row.expected_salary ?? "", notice_period: row.notice_period ?? "",
        open_to_relocation: !!row.open_to_relocation, achievements: row.achievements ?? "",
        resume_text: row.resume_text ?? "",
      }));
    });
  }, [supabase, router]);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  async function onResume(file: File) {
    setResumeName(file.name);
    setParsing(true); setParseErr(null); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/parse", { method: "POST", body: fd });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Couldn't read that resume");
      setP((prev) => ({
        ...prev,
        full_name: out.full_name || prev.full_name,
        phone: out.phone || prev.phone,
        linkedin_url: out.linkedin_url || prev.linkedin_url,
        github_url: out.github_url || prev.github_url,
        headline: out.headline || prev.headline,
        intro_line: out.intro_line || prev.intro_line,
        total_experience: out.total_experience || prev.total_experience,
        achievements: out.achievements || prev.achievements,
        pitch_text: (out.pitch_points?.length ? out.pitch_points.join("\n") : prev.pitch_text),
        resume_text: out.resume_text || prev.resume_text,
      }));
      setMsg("Read your resume — review below and save. Edit anything that's off.");
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "Parsing failed");
    } finally {
      setParsing(false);
    }
  }

  const pitchPoints = p.pitch_text.split("\n").map((s) => s.trim()).filter(Boolean);
  const ready = !!(p.full_name.trim() && p.headline.trim());

  async function save() {
    if (!uid) return;
    if (!ready) { setMsg("Error: name and the role you're after are required."); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name.trim(), phone: p.phone.trim() || null,
      linkedin_url: p.linkedin_url.trim() || null, github_url: p.github_url.trim() || null,
      location: p.location.trim() || null, headline: p.headline.trim(),
      intro_line: p.intro_line.trim() || null,
      availability: p.availability.trim() || "available to join immediately",
      pitch_points: pitchPoints, resume_text: p.resume_text.trim() || null,
      total_experience: p.total_experience.trim() || null,
      current_salary: p.current_salary.trim() || null,
      expected_salary: p.expected_salary.trim() || null,
      notice_period: p.notice_period.trim() || null,
      open_to_relocation: p.open_to_relocation, achievements: p.achievements.trim() || null,
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
      <p className="eyebrow">Your profile</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Drop your resume. We do the rest.</h1>
      <p className="mt-4 max-w-xl text-ink2">
        Upload your resume and we&apos;ll fill in your details automatically — just glance over them and save.
      </p>

      {/* upload + parse */}
      <div className="card mt-8 max-w-3xl">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl2 border-2 border-dashed border-line bg-paper2 px-6 py-10 text-center hover:border-clay">
          <span className="font-display text-3xl text-clay">↑</span>
          <span className="mt-2 text-ink">{resumeName ?? "Drop your resume PDF, or click to browse"}</span>
          <span className="mt-1 text-[13px] text-ink2">{parsing ? "Reading your resume…" : "We auto-fill name, contact, experience & achievements"}</span>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onResume(f); }} />
        </label>
        {parseErr && <p className="mt-3 text-[14px] text-clay">{parseErr} — you can still fill the fields below manually.</p>}
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-2">
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
          <Field label="One-line intro">
            <input className={input} value={p.intro_line} onChange={(e) => set("intro_line", e.target.value)} placeholder="a Data Analyst with 3 years' experience" />
          </Field>
          <Field label="Top achievements (one per line)">
            <textarea rows={4} className={`${input} resize-y`} value={p.pitch_text} onChange={(e) => set("pitch_text", e.target.value)}
              placeholder={"Cut reporting turnaround from days to under an hour\nBuilt LTV/CAC models that reshaped pricing"} />
          </Field>
        </div>
      </div>

      {/* job preferences */}
      <div className="card mt-7">
        <h2 className="text-2xl">Job preferences</h2>
        <p className="mt-1 text-ink2">The things recruiters always ask. All optional — fill what you&apos;re comfortable sharing.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Total experience"><input className={input} value={p.total_experience} onChange={(e) => set("total_experience", e.target.value)} placeholder="3 years" /></Field>
          <Field label="Notice period"><input className={input} value={p.notice_period} onChange={(e) => set("notice_period", e.target.value)} placeholder="30 days / immediate" /></Field>
          <Field label="Current salary"><input className={input} value={p.current_salary} onChange={(e) => set("current_salary", e.target.value)} placeholder="₹ — / yr" /></Field>
          <Field label="Expected salary"><input className={input} value={p.expected_salary} onChange={(e) => set("expected_salary", e.target.value)} placeholder="₹ — / yr" /></Field>
        </div>
        <label className="mt-4 flex items-center gap-3">
          <input type="checkbox" checked={p.open_to_relocation} onChange={(e) => set("open_to_relocation", e.target.checked)}
            className="h-5 w-5 rounded border-line text-clay focus:ring-clay" />
          <span className="text-[15px] text-ink">Open to relocation</span>
        </label>
        <Field label="Other highlights (optional)">
          <textarea rows={3} className={`${input} resize-y`} value={p.achievements} onChange={(e) => set("achievements", e.target.value)}
            placeholder="Anything else worth surfacing — awards, certifications, notable projects." />
        </Field>
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
