import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

// pdfjs (via pdf-parse) calls Promise.withResolvers, which only exists on Node 22+.
// engines pins Node 22 on Vercel; this polyfill is a safety net for older runtimes.
type Resolvers<T> = { promise: Promise<T>; resolve: (v: T | PromiseLike<T>) => void; reject: (r?: unknown) => void };
const _P = Promise as unknown as { withResolvers?: <T>() => Resolvers<T> };
if (typeof _P.withResolvers !== "function") {
  _P.withResolvers = function <T>(): Resolvers<T> {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (r?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

// Resume-first onboarding: extract text from the uploaded PDF, then have the AI
// structure it into profile fields. Returns the extracted fields (the client
// fills the form so the user just confirms). Provider precedence matches ai.py.

const SYS =
  "You extract structured profile data from a resume. Use ONLY what's in the resume — never invent. "
  + "Leave a field as an empty string (or empty array) if it isn't present. "
  + "headline = the person's target role/title in a few words. "
  + "intro_line = a single natural sentence summarizing who they are. "
  + "total_experience = e.g. '3 years' if derivable. "
  + "pitch_points = 3-5 of their strongest, ideally quantified achievements, each a short scannable line. "
  + "achievements = optional extra highlights as free text.";

const STD_SCHEMA = {
  type: "object",
  properties: {
    full_name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
    linkedin_url: { type: "string" }, github_url: { type: "string" },
    headline: { type: "string" }, intro_line: { type: "string" },
    total_experience: { type: "string" }, achievements: { type: "string" },
    pitch_points: { type: "array", items: { type: "string" } },
  },
  required: ["full_name"], additionalProperties: false,
};
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    full_name: { type: "STRING" }, email: { type: "STRING" }, phone: { type: "STRING" },
    linkedin_url: { type: "STRING" }, github_url: { type: "STRING" },
    headline: { type: "STRING" }, intro_line: { type: "STRING" },
    total_experience: { type: "STRING" }, achievements: { type: "STRING" },
    pitch_points: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["full_name"],
};

async function structure(text: string): Promise<Record<string, unknown> | null> {
  const user = `RESUME TEXT:\n${text}`;
  if (process.env.AI_API_KEY) {
    const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini", max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS + " Respond as a single JSON object: " + JSON.stringify(STD_SCHEMA.properties) },
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
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1800,
          thinkingConfig: { thinkingBudget: 0 }, responseSchema: GEMINI_SCHEMA },
      }),
    });
    const j = await r.json();
    return JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const resp = await new Anthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", max_tokens: 1500, system: SYS,
      output_config: { format: { type: "json_schema", schema: STD_SCHEMA } },
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
  if (!(await rateLimit(supabase, user.id, "ai_parse", 10, 60))) {
    return NextResponse.json({ error: "Too many uploads in a row — give it a minute." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Upload a PDF resume." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Please upload a PDF." }, { status: 400 });

  let text = "";
  try {
    // unpdf is serverless-friendly; dynamic import so any load/parse error is
    // caught here and returned as JSON (never an HTML 500).
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const result = await extractText(pdf, { mergePages: true });
    text = (result.text || "").trim().slice(0, 12000);
  } catch {
    return NextResponse.json({ error: "Couldn't read that PDF. Try a text-based (not scanned) PDF." }, { status: 422 });
  }
  if (text.length < 40) {
    return NextResponse.json({ error: "That PDF has no readable text (looks scanned/image-only)." }, { status: 422 });
  }

  if (!process.env.AI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Resume parsing needs an AI key." }, { status: 400 });
  }

  try {
    const data = await structure(text);
    if (!data || !data.full_name) {
      return NextResponse.json({ error: "Couldn't extract details — fill them in manually." }, { status: 502 });
    }
    // resume_text (the raw extract) powers the email writer; return it alongside the fields.
    return NextResponse.json({ ...data, resume_text: text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "parse failed" }, { status: 502 });
  }
}
