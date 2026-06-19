"use client";
import { useState } from "react";

// Shows how the outreach email will look, with an editable instructions panel.
// Campaign-wide changes come from `instructions` + your saved memory — the
// worker re-personalizes each contact's email at send time using both.
const TONES = ["Warmer", "More direct", "More formal", "Shorter"];

export function EmailPreview({
  instructions, onInstructions, sampleCompany,
}: {
  instructions: string;
  onInstructions: (s: string) => void;
  sampleCompany?: string;
}) {
  const [company, setCompany] = useState(sampleCompany || "Acme Inc");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setLoading(true); setErr(null);
    const res = await fetch("/api/email/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, first_name: "Hiring Team", instructions }),
    });
    const out = await res.json();
    setLoading(false);
    if (!res.ok) { setErr(out.error ?? "Preview failed"); return; }
    setDraft({ subject: out.subject, body: out.body });
    setSource(out.source);
  }

  function addTone(t: string) {
    const line = `Tone: ${t.toLowerCase()}.`;
    onInstructions(instructions ? `${instructions}\n${line}` : line);
  }

  const input = "w-full rounded-xl2 border border-line bg-paper2 px-4 py-3 text-[15px] outline-none focus:border-clay";

  return (
    <section className="mt-12">
      <p className="eyebrow">Preview &amp; tune</p>
      <h2 className="mt-2 text-2xl">See the email before it sends</h2>
      <p className="mt-1 text-ink2">This is how each recruiter&apos;s email will look. Tune it on the right — your changes apply to every email in this campaign, and the AI tailors each one to the person.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* draft */}
        <div className="card">
          {draft ? (
            <>
              <div className="text-[13px] text-ink2">Subject</div>
              <div className="mt-1 font-display text-lg text-ink">{draft.subject}</div>
              <hr className="my-4 border-line" />
              <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-ink">{draft.body}</pre>
              <p className="mt-4 text-[12px] text-ink2">{source === "ai" ? "✨ AI-personalized preview" : "Template preview (turn on AI to personalize per recipient)"}</p>
            </>
          ) : (
            <div className="grid h-full place-items-center py-16 text-center text-ink2">
              <div>
                <p>Click <span className="text-ink">Generate preview</span> to see your email.</p>
                <p className="mt-1 text-[13px]">Uses your profile + saved memory.</p>
              </div>
            </div>
          )}
        </div>

        {/* controls */}
        <div className="card space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-ink2">Sample company (for the preview)</span>
            <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-ink2">Instructions for the AI (applies to the whole campaign)</span>
            <textarea rows={5} className={`${input} resize-y`} value={instructions}
              onChange={(e) => onInstructions(e.target.value)}
              placeholder={"e.g. Mention I'm open to relocation. Keep it under 120 words. Reference their product if you can."} />
          </label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button key={t} type="button" onClick={() => addTone(t)} className="tag hover:text-ink">{t}</button>
            ))}
          </div>
          <button type="button" onClick={generate} disabled={loading} className="btn-primary w-full">
            {loading ? "Generating…" : draft ? "Regenerate preview" : "Generate preview"}
          </button>
          {err && <p className="text-[14px] text-clay">{err}</p>}
        </div>
      </div>
    </section>
  );
}
