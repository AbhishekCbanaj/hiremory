"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Result = {
  match_score: number;
  summary: string;
  matched_keywords: string[];
  missing_keywords: string[];
  highlights: string[];
  suggestions: string[];
};

export default function ResumeAnalytics() {
  const router = useRouter();
  const supabase = createClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, [supabase]);

  async function analyze() {
    if (!file || jd.trim().length < 40) { setErr("Add your resume PDF and paste the job description."); return; }
    setBusy(true); setErr(null); setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("jd", jd);
      const r = await fetch("/api/resume/analyze", { method: "POST", body: fd });
      const raw = await r.text();
      let out: Partial<Result> & { error?: string };
      try { out = JSON.parse(raw); } catch { throw new Error("Server hiccup — try again in a moment."); }
      if (!r.ok) throw new Error(out.error ?? "Analysis failed");
      setRes(out as Result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  const score = res?.match_score ?? 0;
  const scoreColor = score >= 75 ? "text-sage" : score >= 50 ? "text-amber" : "text-clay";

  return (
    <main className="container-x py-14">
      <p className="eyebrow">Resume Analytics</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Tune your resume to the job.</h1>
      <p className="mt-4 max-w-2xl text-ink2">
        Upload your resume and paste the job description. We read both, score the match, surface the
        keywords recruiters and ATS scan for, and tell you exactly what to highlight or change.
      </p>

      {authed === false && (
        <p className="mt-4 rounded-xl2 border border-clay/40 bg-clay/10 px-4 py-3 text-[14px] text-clay">
          <a href="/login" className="underline">Log in</a> to analyze your resume.
        </p>
      )}

      <div className="mt-8 grid gap-7 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-2xl">Your resume</h2>
          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl2 border border-line bg-paper2 px-4 py-3 hover:border-clay">
            <span className="truncate text-[15px] text-ink2">{file?.name ?? "Choose PDF…"}</span>
            <span className="btn-ghost !py-1.5 !px-4 text-[13px]">Browse</span>
            <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="card">
          <h2 className="text-2xl">Job description</h2>
          <textarea rows={5} value={jd} onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description…"
            className="mt-4 w-full resize-y rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay" />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button onClick={analyze} disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? "Analyzing…" : "Analyze match"}
        </button>
        {err && <span className="text-[14px] text-clay">{err}</span>}
      </div>

      {res && (
        <section className="mt-10 space-y-7">
          <div className="card flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="text-center">
              <div className={`font-display text-6xl ${scoreColor}`}>{score}</div>
              <div className="text-[12px] uppercase tracking-wide text-ink2">match</div>
            </div>
            <p className="text-ink2">{res.summary}</p>
          </div>

          <div className="grid gap-7 lg:grid-cols-2">
            <div className="card">
              <h3 className="text-xl">✓ Keywords you match</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {res.matched_keywords.length
                  ? res.matched_keywords.map((k) => <span key={k} className="rounded-full bg-sage/15 px-3 py-1 text-[13px] text-sage">{k}</span>)
                  : <span className="text-[14px] text-ink2">None detected.</span>}
              </div>
            </div>
            <div className="card">
              <h3 className="text-xl">⚠ Keywords you&apos;re missing</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {res.missing_keywords.length
                  ? res.missing_keywords.map((k) => <span key={k} className="rounded-full bg-amber/15 px-3 py-1 text-[13px] text-amber">{k}</span>)
                  : <span className="text-[14px] text-ink2">Nothing major missing.</span>}
              </div>
            </div>
          </div>

          <div className="grid gap-7 lg:grid-cols-2">
            <div className="card">
              <h3 className="text-xl">Highlight these</h3>
              <ul className="mt-3 space-y-2 text-[15px] text-ink2">
                {res.highlights.map((h) => <li key={h}>• {h}</li>)}
              </ul>
            </div>
            <div className="card">
              <h3 className="text-xl">What to change</h3>
              <ul className="mt-3 space-y-2 text-[15px] text-ink2">
                {res.suggestions.map((s) => <li key={s}>• {s}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
