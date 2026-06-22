import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Resume Analytics: compare a resume to a job description and return an ATS-style
// match — score, matched/missing keywords, strengths to highlight, and concrete
// edits to make the application stronger. Provider precedence matches ai.py.

const SYS =
  "You are an ATS analyzer + resume coach. Compare the candidate's RESUME to the JOB DESCRIPTION. "
  + "Return: match_score (0-100 integer, how well the resume fits this JD); summary (2-3 sentences, "
  + "honest); matched_keywords (important skills/keywords from the JD that ARE in the resume); "
  + "missing_keywords (important ones from the JD NOT found in the resume); highlights (the candidate's "
  + "strongest, most relevant points to emphasize for THIS role); suggestions (concrete, truthful edits "
  + "to strengthen the resume for this JD — rewording, surfacing skills they already have, sections to "
  + "add). Never invent experience the candidate doesn't have, and never tell them to lie.";

const STD = {
  type: "object",
  properties: {
    match_score: { type: "integer" }, summary: { type: "string" },
    matched_keywords: { type: "array", items: { type: "string" } },
    missing_keywords: { type: "array", items: { type: "string" } },
    highlights: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["match_score", "summary", "matched_keywords", "missing_keywords", "highlights", "suggestions"],
  additionalProperties: false,
};
const GEM = {
  type: "OBJECT",
  properties: {
    match_score: { type: "INTEGER" }, summary: { type: "STRING" },
    matched_keywords: { type: "ARRAY", items: { type: "STRING" } },
    missing_keywords: { type: "ARRAY", items: { type: "STRING" } },
    highlights: { type: "ARRAY", items: { type: "STRING" } },
    suggestions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["match_score", "summary", "matched_keywords", "missing_keywords", "highlights", "suggestions"],
};

async function analyze(resume: string, jd: string): Promise<Record<string, unknown> | null> {
  const user = `RESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jd}`;
  if (process.env.AI_API_KEY) {
    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini", max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS + " Respond as one JSON object with keys: " + Object.keys(STD.properties).join(", ") },
          { role: "user", content: user },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`AI provider error ${r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 300)}`);
    const content = j?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`AI returned no content: ${JSON.stringify(j).slice(0, 300)}`);
    return JSON.parse(content);
  }
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYS }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2200,
          thinkingConfig: { thinkingBudget: 0 }, responseSchema: GEM },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Gemini error ${r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 300)}`);
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Gemini returned no content: ${JSON.stringify(j).slice(0, 300)}`);
    return JSON.parse(text);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const resp = await new Anthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", max_tokens: 2000, system: SYS,
      output_config: { format: { type: "json_schema", schema: STD } },
      messages: [{ role: "user", content: user }],
    } as Anthropic.Messages.MessageCreateParamsNonStreaming);
    const tb = resp.content.find((x) => x.type === "text");
    return JSON.parse(tb && "text" in tb ? tb.text : "{}");
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!(await rateLimit(supabase, user.id, "ai_analyze", 10, 60))) {
    return NextResponse.json({ error: "Too many analyses in a row — give it a minute." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const jd = String(form?.get("jd") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ error: "Upload your resume PDF." }, { status: 400 });
  if (jd.length < 40) return NextResponse.json({ error: "Paste the job description (a bit more detail helps)." }, { status: 400 });

  let resume = "";
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const result = await extractText(pdf, { mergePages: true });
    resume = (result.text || "").trim().slice(0, 12000);
  } catch {
    return NextResponse.json({ error: "Couldn't read that PDF. Try a text-based (not scanned) PDF." }, { status: 422 });
  }
  if (resume.length < 40) return NextResponse.json({ error: "That PDF has no readable text (looks scanned)." }, { status: 422 });

  if (!process.env.AI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Resume analysis needs an AI key." }, { status: 400 });
  }

  try {
    const data = await analyze(resume, jd.slice(0, 6000));
    if (!data || typeof data.match_score === "undefined") {
      return NextResponse.json({ error: "Couldn't analyze — try again." }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 502 });
  }
}
