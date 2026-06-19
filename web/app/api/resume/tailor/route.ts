import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// Tailor the user's resume_text to a job description. Preview only — the worker
// regenerates + renders the PDF at send time. Needs an AI key (Gemini or Claude);
// tailoring can't be done by a static template.
const SYS = "You are an expert resume writer + ATS optimizer. Tailor the candidate's resume to the job "
  + "description. STRICT rules: TRUTHFUL ONLY — use only content from the candidate's resume, never invent "
  + "jobs, skills, degrees, dates, or metrics. ATS-FRIENDLY — mirror the JD's exact keywords/skills the "
  + "candidate genuinely has; standard headings (Summary, Experience, Skills, Projects, Education); no tables. "
  + "LENGTH — judge seniority: fresher/entry (≤2 yrs) → ONE page (~3-4 sections, 3-5 bullets each); senior (5+) → up to two pages. "
  + "BULLETS — action verb + what you did + quantified result; concise and scannable. TONE — human and confident, not robotic. "
  + "Return a short professional summary plus structured sections with bullets.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const jd = String(b.job_description ?? "").trim();
  if (!jd) return NextResponse.json({ error: "Paste a job description first." }, { status: 400 });

  const { data: p } = await supabase.from("profiles").select("resume_text").eq("id", user.id).maybeSingle();
  const resume = (p?.resume_text ?? "").trim();
  if (!resume) return NextResponse.json({ error: "Add your resume text in Profile first." }, { status: 400 });

  const provider = process.env.GEMINI_API_KEY ? "gemini"
    : process.env.ANTHROPIC_API_KEY ? "claude" : null;
  if (!provider) return NextResponse.json({ error: "Resume tailoring needs an AI key (add a free Gemini key)." }, { status: 400 });

  const userMsg = `CANDIDATE RESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jd}\n`;
  try {
    let data: { summary?: string; sections?: { heading: string; bullets: string[] }[] } = {};
    if (provider === "gemini") {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYS }] },
          contents: [{ role: "user", parts: [{ text: userMsg }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000,
            thinkingConfig: { thinkingBudget: 0 },
            responseSchema: { type: "OBJECT", properties: {
              summary: { type: "STRING" },
              sections: { type: "ARRAY", items: { type: "OBJECT", properties: {
                heading: { type: "STRING" }, bullets: { type: "ARRAY", items: { type: "STRING" } } },
                required: ["heading", "bullets"] } } }, required: ["summary", "sections"] } },
        }),
      });
      const j = await r.json();
      data = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    } else {
      const resp = await new Anthropic().messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", max_tokens: 1600, system: SYS,
        output_config: { format: { type: "json_schema", schema: {
          type: "object", properties: {
            summary: { type: "string" },
            sections: { type: "array", items: { type: "object", properties: {
              heading: { type: "string" }, bullets: { type: "array", items: { type: "string" } } },
              required: ["heading", "bullets"], additionalProperties: false } } },
          required: ["summary", "sections"], additionalProperties: false } } },
        messages: [{ role: "user", content: userMsg }],
      } as Anthropic.Messages.MessageCreateParamsNonStreaming);
      const tb = resp.content.find((x) => x.type === "text");
      data = JSON.parse(tb && "text" in tb ? tb.text : "{}");
    }
    if (data.sections?.length) return NextResponse.json(data);
    return NextResponse.json({ error: "Could not tailor — try again." }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "tailoring failed" }, { status: 502 });
  }
}
